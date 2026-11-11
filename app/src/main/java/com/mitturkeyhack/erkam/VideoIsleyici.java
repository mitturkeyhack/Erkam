package com.mitturkeyhack.erkam;

import android.app.Activity;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultEncoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;
import androidx.media3.transformer.VideoEncoderSettings;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Bir videoyu seçildikten sonra işler: kapak karesi çıkarır, telefonun donanım kodlayıcısıyla
 * 720p / ~2 Mbit'e sıkıştırır ve Supabase deposuna ilerleme bildirerek yükler.
 * Her adım sayfaya window.E_video({...}) olarak bildirilir.
 */
class VideoIsleyici {
    interface Bildirici { void bildir(JSONObject o); }

    static final long EN_BUYUK = 50L * 1024 * 1024;

    private final Activity akt;
    private final Uri kaynak;
    private final Bildirici bildirici;
    private final String id, url, anahtar, token, klasor;
    private final int enUzunSn;
    private final Handler ana = new Handler(Looper.getMainLooper());
    private volatile boolean iptal = false;
    private Transformer transformer;
    private File cikti, kapak;
    private long ilkBoyut;
    private int genislik, yukseklik;
    private double sureSn;

    VideoIsleyici(Activity akt, Uri kaynak, String ayarJson, Bildirici b) throws Exception {
        this.akt = akt;
        this.kaynak = kaynak;
        this.bildirici = b;
        JSONObject a = new JSONObject(ayarJson);
        id = a.getString("id");
        url = a.getString("url");
        anahtar = a.getString("anahtar");
        token = a.getString("token");
        klasor = a.getString("klasor");
        enUzunSn = a.optInt("enUzun", 60);
    }

    String kimlik() { return id; }

    void iptalEt() {
        iptal = true;
        ana.post(() -> {
            try { if (transformer != null) transformer.cancel(); } catch (Throwable ignored) { }
            temizle();
        });
    }

    void basla() {
        new Thread(() -> {
            try {
                bilgiTopla();
            } catch (Throwable e) {
                hata("Bu video açılamadı.");
            }
        }, "erkam-video-bilgi").start();
    }

    private void bilgiTopla() throws Exception {
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        try {
            r.setDataSource(akt, kaynak);
            long ms = sayi(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            int w = (int) sayi(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            int h = (int) sayi(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            int don = (int) sayi(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
            if (don == 90 || don == 270) { int t = w; w = h; h = t; }
            genislik = w; yukseklik = h; sureSn = ms / 1000.0;
            if (ms > (enUzunSn + 1) * 1000L) { hata("Video en fazla 1 dakika olabilir."); return; }

            Bitmap kare = r.getFrameAtTime(Math.min(1_000_000L, ms * 500L), MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (kare == null) kare = r.getFrameAtTime();
            String onizleme = null;
            if (kare != null) {
                kapak = new File(akt.getCacheDir(), "kapak_" + id + ".jpg");
                Bitmap buyuk = olcekle(kare, 720);
                FileOutputStream fo = new FileOutputStream(kapak);
                buyuk.compress(Bitmap.CompressFormat.JPEG, 80, fo);
                fo.close();
                Bitmap kucuk = olcekle(kare, 360);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                kucuk.compress(Bitmap.CompressFormat.JPEG, 70, bo);
                onizleme = "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            }
            ilkBoyut = boyutBul();

            JSONObject o = olay("secildi");
            o.put("sure", sureSn);
            o.put("g", genislik);
            o.put("y", yukseklik);
            o.put("boyut", ilkBoyut);
            if (onizleme != null) o.put("kapak", onizleme);
            bildirici.bildir(o);
        } finally {
            try { r.release(); } catch (Throwable ignored) { }
        }
        if (!iptal) ana.post(this::sikistir);
    }

    /** Ana iş parçacığında çalışır (Transformer bunu ister). */
    private void sikistir() {
        if (iptal) return;
        try {
            cikti = new File(akt.getCacheDir(), "video_" + id + ".mp4");
            if (cikti.exists()) cikti.delete();

            List<Effect> etkiler = new ArrayList<>();
            int kisa = Math.min(genislik, yukseklik);
            if (kisa > 720) {
                // kısa kenar 720 olacak şekilde küçült
                int hedefY = yukseklik >= genislik ? Math.round(yukseklik * 720f / genislik) : 720;
                etkiler.add(Presentation.createForHeight(hedefY - (hedefY % 2)));
            }
            EditedMediaItem oge = new EditedMediaItem.Builder(MediaItem.fromUri(kaynak))
                    .setEffects(new Effects(new ArrayList<AudioProcessor>(), etkiler))
                    .build();

            transformer = new Transformer.Builder(akt)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .setEncoderFactory(new DefaultEncoderFactory.Builder(akt.getApplicationContext())
                            .setRequestedVideoEncoderSettings(new VideoEncoderSettings.Builder().setBitrate(2_000_000).build())
                            .build())
                    .addListener(new Transformer.Listener() {
                        @Override
                        public void onCompleted(Composition composition, ExportResult sonuc) {
                            if (iptal) return;
                            yuklemeyeGec(cikti);
                        }

                        @Override
                        public void onError(Composition composition, ExportResult sonuc, ExportException e) {
                            if (iptal) return;
                            // sıkıştırma olmazsa, sınırı aşmıyorsa videoyu olduğu gibi yükle
                            if (ilkBoyut > 0 && ilkBoyut <= EN_BUYUK) yuklemeyeGec(null);
                            else hata("Video sıkıştırılamadı.");
                        }
                    })
                    .build();
            transformer.start(oge, cikti.getAbsolutePath());
            ilerlemeyiIzle();
        } catch (Throwable e) {
            if (ilkBoyut > 0 && ilkBoyut <= EN_BUYUK) yuklemeyeGec(null);
            else hata("Video sıkıştırılamadı.");
        }
    }

    private void ilerlemeyiIzle() {
        final ProgressHolder tut = new ProgressHolder();
        ana.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (iptal || transformer == null) return;
                int d = transformer.getProgress(tut);
                if (d == Transformer.PROGRESS_STATE_NOT_STARTED) return;
                if (d == Transformer.PROGRESS_STATE_AVAILABLE) {
                    try {
                        JSONObject o = olay("sikistiriliyor");
                        o.put("yuzde", tut.progress);
                        bildirici.bildir(o);
                    } catch (Throwable ignored) { }
                }
                ana.postDelayed(this, 400);
            }
        }, 300);
    }

    private void yuklemeyeGec(final File dosya) {
        transformer = null;
        new Thread(() -> {
            try {
                long boyut = dosya != null ? dosya.length() : ilkBoyut;
                if (boyut > EN_BUYUK) { hata("Video sıkıştırıldıktan sonra da 50 MB'tan büyük."); return; }
                JSONObject s = olay("sikistirildi");
                s.put("boyut", boyut);
                bildirici.bildir(s);

                long zaman = System.currentTimeMillis();
                String videoYol = klasor + "/video-" + Long.toString(zaman, 36) + ".mp4";
                InputStream giris = dosya != null ? new FileInputStream(dosya) : akt.getContentResolver().openInputStream(kaynak);
                yukle(giris, boyut, videoYol, "video/mp4", true);

                String kapakYol = null;
                if (kapak != null && kapak.exists()) {
                    kapakYol = klasor + "/kapak-" + Long.toString(zaman, 36) + ".jpg";
                    yukle(new FileInputStream(kapak), kapak.length(), kapakYol, "image/jpeg", false);
                }
                if (iptal) return;
                JSONObject t = olay("tamam");
                t.put("yol", videoYol);
                if (kapakYol != null) t.put("kapak_yol", kapakYol);
                bildirici.bildir(t);
            } catch (Throwable e) {
                if (!iptal) hata("Video yüklenemedi. İnternetini kontrol edip tekrar dene.");
            } finally {
                temizle();
            }
        }, "erkam-video-yukle").start();
    }

    private void yukle(InputStream giris, long boyut, String yol, String tur, boolean ilerlemeli) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/storage/v1/object/gorseller/" + yol).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setConnectTimeout(20000);
            c.setReadTimeout(120000);
            c.setFixedLengthStreamingMode(boyut);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("apikey", anahtar);
            c.setRequestProperty("Content-Type", tur);
            c.setRequestProperty("x-upsert", "true");
            OutputStream cik = c.getOutputStream();
            byte[] tampon = new byte[64 * 1024];
            long giden = 0;
            int son = -1, n;
            while ((n = giris.read(tampon)) > 0) {
                if (iptal) throw new Exception("iptal");
                cik.write(tampon, 0, n);
                giden += n;
                int y = (int) (giden * 95 / Math.max(1, boyut));
                if (ilerlemeli && y != son) {
                    son = y;
                    JSONObject o = olay("yukleniyor");
                    o.put("yuzde", y);
                    bildirici.bildir(o);
                }
            }
            cik.flush();
            cik.close();
            giris.close();
            int kod = c.getResponseCode();
            if (kod / 100 != 2) throw new Exception("HTTP " + kod);
        } finally {
            c.disconnect();
        }
    }

    private void hata(String mesaj) {
        try {
            JSONObject o = olay("hata");
            o.put("mesaj", mesaj);
            bildirici.bildir(o);
        } catch (Throwable ignored) { }
        temizle();
    }

    private void temizle() {
        try { if (cikti != null) cikti.delete(); } catch (Throwable ignored) { }
        try { if (kapak != null) kapak.delete(); } catch (Throwable ignored) { }
    }

    private JSONObject olay(String durum) throws Exception {
        JSONObject o = new JSONObject();
        o.put("id", id);
        o.put("durum", durum);
        return o;
    }

    private long boyutBul() {
        try (Cursor k = akt.getContentResolver().query(kaynak, new String[]{OpenableColumns.SIZE}, null, null, null)) {
            if (k != null && k.moveToFirst() && !k.isNull(0)) return k.getLong(0);
        } catch (Throwable ignored) { }
        return 0;
    }

    private static long sayi(String s) {
        try { return s == null ? 0 : Long.parseLong(s.trim()); } catch (Throwable e) { return 0; }
    }

    private static Bitmap olcekle(Bitmap b, int enUzun) {
        int w = b.getWidth(), h = b.getHeight();
        float o = Math.min(1f, enUzun / (float) Math.max(w, h));
        if (o >= 1f) return b;
        return Bitmap.createScaledBitmap(b, Math.max(1, Math.round(w * o)), Math.max(1, Math.round(h * o)), true);
    }
}
