package com.mitturkeyhack.erkam;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;

/**
 * ERKAM — uygulama kabuğu. Arayüz assets/www içindeki sayfadır; bu sınıf onu güvenli bir
 * https kökünden sunar ve telefona özgü işleri (dosya seçme, biyometrik mühür, tema) köprüler.
 */
public class MainActivity extends Activity {
    static final String ALAN = "appassets.androidplatform.net";
    static final String KOK = "https://" + ALAN + "/";
    static final String HATA_DOSYASI = "son_hata.txt";
    static final int DOSYA_ISTEGI = 41;
    static final int VIDEO_ISTEGI = 42;
    static final int KOYU = 0xFF0F172A;
    static final int ACIK = 0xFFF1F5F9;

    private WebView web;
    private FrameLayout kok;
    private boolean sayfaHazir = false;
    private ValueCallback<Uri[]> dosyaGeri;
    private boolean gorselIstegi = false;
    static volatile boolean onde = false;
    static MainActivity simdiki;
    private String bekleyenHedef = null;
    static final int BILDIRIM_IZNI = 43;

    static void tokenBildir(String t) {
        MainActivity a = simdiki;
        if (a == null || a.web == null) return;
        final String js = "window.E_bildirimToken&&window.E_bildirimToken(" + org.json.JSONObject.quote(t) + ")";
        a.runOnUiThread(() -> { if (a.web != null) a.web.evaluateJavascript(js, null); });
    }
    private String videoAyar;
    private VideoIsleyici video;

    // ---------- çökme yakalayıcı: hata olursa bir sonraki açılışta ekranda gösterilir ----------
    private void cokmeYakalayiciKur() {
        final Thread.UncaughtExceptionHandler onceki = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            hatayiKaydet("Uygulama çöktü (" + t.getName() + ")", e);
            if (onceki != null) onceki.uncaughtException(t, e);
        });
    }

    private void hatayiKaydet(String baslik, Throwable e) {
        try {
            StringWriter sw = new StringWriter();
            if (e != null) e.printStackTrace(new PrintWriter(sw));
            String txt = baslik + "\nAndroid " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + "), "
                    + Build.MANUFACTURER + " " + Build.MODEL + "\n\n" + sw;
            FileOutputStream fo = openFileOutput(HATA_DOSYASI, MODE_PRIVATE);
            fo.write(txt.getBytes("UTF-8"));
            fo.close();
        } catch (Throwable ignored) { }
    }

    private String hatayiOku() {
        File f = new File(getFilesDir(), HATA_DOSYASI);
        if (!f.exists()) return null;
        try {
            FileInputStream in = new FileInputStream(f);
            byte[] b = new byte[(int) Math.min(f.length(), 20000)];
            int n = in.read(b);
            in.close();
            f.delete();
            return n > 0 ? new String(b, 0, n, "UTF-8") : null;
        } catch (Throwable t) { f.delete(); return null; }
    }

    private void hataGoster(final String metin) {
        LinearLayout kutu = new LinearLayout(this);
        kutu.setOrientation(LinearLayout.VERTICAL);
        kutu.setBackgroundColor(KOYU);
        int p = (int) (20 * getResources().getDisplayMetrics().density);
        kutu.setPadding(p, p * 2, p, p);
        TextView h = new TextView(this);
        h.setText("Bir hata oluştu.\nAşağıdaki yazının ekran görüntüsünü alıp Claude'a gönder.");
        h.setTextColor(0xFF10B981);
        h.setTextSize(17);
        kutu.addView(h);
        ScrollView sv = new ScrollView(this);
        TextView tv = new TextView(this);
        tv.setText(metin);
        tv.setTextColor(0xFFF8FAFC);
        tv.setTextSize(11);
        tv.setTextIsSelectable(true);
        tv.setPadding(0, p, 0, p);
        sv.addView(tv);
        kutu.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1f));
        Button tekrar = new Button(this);
        tekrar.setText("Kopyala ve tekrar dene");
        tekrar.setOnClickListener(v -> {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("hata", metin));
            } catch (Throwable ignored) { }
            recreate();
        });
        kutu.addView(tekrar);
        setContentView(kutu);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        simdiki = this;
        hedefAl(getIntent());
        cokmeYakalayiciKur();
        String son = hatayiOku();
        if (son != null) { hataGoster(son); return; }
        try {
            arayuzuKur();
        } catch (Throwable e) {
            StringWriter sw = new StringWriter();
            e.printStackTrace(new PrintWriter(sw));
            hataGoster("Açılış hatası\nAndroid " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")\n\n" + sw);
        }
    }

    private void arayuzuKur() {
        Window w = getWindow();
        kok = new FrameLayout(this);
        kok.setBackgroundColor(KOYU);
        web = new WebView(this);
        web.setBackgroundColor(KOYU);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        kok.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(kok);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::geriTusu);
        }

        try {
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= 30) {
                w.setDecorFitsSystemWindows(false);
            } else {
                w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            }
        } catch (Throwable ignored) { }

        // Durum çubuğu, gezinme çubuğu ve klavye için boşluk bırak
        kok.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        kok.requestApplyInsets();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Kopru(this), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest istek) {
                Uri u = istek.getUrl();
                if (u == null || !ALAN.equals(u.getHost())) return null;
                return varlikSun(u.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest istek) {
                Uri u = istek.getUrl();
                if (u != null && ALAN.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Throwable ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                sayfaHazir = true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detay) {
                hatayiKaydet("Sayfa çöktü (didCrash=" + (detay != null && detay.didCrash()) + ")", null);
                runOnUiThread(() -> recreate());
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> geri, FileChooserParams p) {
                if (dosyaGeri != null) dosyaGeri.onReceiveValue(null);
                dosyaGeri = geri;
                try {
                    String tur = "image/*";
                    String[] turler = p != null ? p.getAcceptTypes() : null;
                    if (turler != null && turler.length > 0 && turler[0] != null && turler[0].startsWith("video")) tur = "video/*";
                    gorselIstegi = tur.startsWith("image");
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(tur);
                    if (p != null && p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(Intent.createChooser(i, tur.startsWith("video") ? "Video seç" : "Fotoğraf seç"), DOSYA_ISTEGI);
                } catch (ActivityNotFoundException e) {
                    dosyaGeri = null;
                    geri.onReceiveValue(null);
                }
                return true;
            }
        });

        web.loadUrl(KOK + "index.html");
    }

    /** assets/www altındaki dosyayı https kökünden sunar. */
    private WebResourceResponse varlikSun(String yol) {
        if (yol == null || yol.isEmpty() || "/".equals(yol)) yol = "/index.html";
        Map<String, String> baslik = new HashMap<>();
        baslik.put("Cache-Control", "no-cache");
        if (yol.contains("..")) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", baslik, new ByteArrayInputStream(new byte[0]));
        }
        try {
            InputStream in = getAssets().open("www" + yol);
            String mime = "application/octet-stream", kod = null;
            if (yol.endsWith(".html")) { mime = "text/html"; kod = "UTF-8"; }
            else if (yol.endsWith(".js")) { mime = "application/javascript"; kod = "UTF-8"; }
            else if (yol.endsWith(".css")) { mime = "text/css"; kod = "UTF-8"; }
            else if (yol.endsWith(".json")) { mime = "application/json"; kod = "UTF-8"; }
            else if (yol.endsWith(".svg")) { mime = "image/svg+xml"; kod = "UTF-8"; }
            else if (yol.endsWith(".png")) mime = "image/png";
            else if (yol.endsWith(".jpg") || yol.endsWith(".jpeg")) mime = "image/jpeg";
            else if (yol.endsWith(".webp")) mime = "image/webp";
            return new WebResourceResponse(mime, kod, 200, "OK", baslik, in);
        } catch (Throwable e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", baslik, new ByteArrayInputStream(new byte[0]));
        }
    }

    @Override
    protected void onActivityResult(int istek, int sonuc, Intent veri) {
        super.onActivityResult(istek, sonuc, veri);
        if (istek == VIDEO_ISTEGI) { videoSecildi(sonuc == RESULT_OK && veri != null ? veri.getData() : null); return; }
        if (istek != DOSYA_ISTEGI) return;
        ValueCallback<Uri[]> geri = dosyaGeri;
        dosyaGeri = null;
        if (geri == null) return;
        Uri[] secilen = null;
        if (sonuc == RESULT_OK && veri != null) {
            if (veri.getClipData() != null && veri.getClipData().getItemCount() > 0) {
                int n = veri.getClipData().getItemCount();
                secilen = new Uri[n];
                for (int k = 0; k < n; k++) secilen[k] = veri.getClipData().getItemAt(k).getUri();
            } else if (veri.getData() != null) {
                secilen = new Uri[]{veri.getData()};
            }
        }
        if (secilen == null || !gorselIstegi) { geri.onReceiveValue(secilen); return; }
        // Fotoğrafları telefonda çöz: HEIC/HEIF ve çok büyük (50 MP) kamera fotoğraflarını
        // 2400 piksele indirip JPEG'e çevir; WebView bunları her zaman açabilsin.
        final Uri[] liste = secilen;
        new Thread(() -> {
            File kl = new File(getCacheDir(), "secim");
            if (!kl.exists()) kl.mkdirs();
            File[] eski = kl.listFiles();
            if (eski != null) for (File f : eski) if (System.currentTimeMillis() - f.lastModified() > 600000) f.delete();
            Uri[] sonucUri = new Uri[liste.length];
            for (int k = 0; k < liste.length; k++) sonucUri[k] = gorselHazirla(liste[k], kl, k);
            runOnUiThread(() -> geri.onReceiveValue(sonucUri));
        }).start();
    }

    private Uri gorselHazirla(Uri uri, File kl, int sira) {
        try {
            String mime = getContentResolver().getType(uri);
            if (mime != null && mime.equals("image/gif")) return uri;
            if (Build.VERSION.SDK_INT < 28) return uri;
            android.graphics.ImageDecoder.Source kaynak = android.graphics.ImageDecoder.createSource(getContentResolver(), uri);
            android.graphics.Bitmap bmp = android.graphics.ImageDecoder.decodeBitmap(kaynak, (d, bilgi, src) -> {
                int w = bilgi.getSize().getWidth(), h = bilgi.getSize().getHeight();
                float o = Math.min(1f, 2400f / Math.max(w, h));
                if (o < 1f) d.setTargetSize(Math.max(1, Math.round(w * o)), Math.max(1, Math.round(h * o)));
                d.setAllocator(android.graphics.ImageDecoder.ALLOCATOR_SOFTWARE);
            });
            File f = new File(kl, "g" + System.currentTimeMillis() + "_" + sira + ".jpg");
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
                bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 92, out);
            }
            bmp.recycle();
            return androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".dosya", f);
        } catch (Throwable e) {
            return uri;  // çevrilemezse aslını gönder
        }
    }

    // ---------- güncelleme indirme ----------
    private volatile boolean guncellemeIptal = false;
    private File guncellemeDosyasi() {
        File kl = new File(getCacheDir(), "secim");
        if (!kl.exists()) kl.mkdirs();
        return new File(kl, "erkam-guncelleme.apk");
    }
    private void guncellemeBildir(String tur, int yuzde, String hata) {
        try {
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("tur", tur); o.put("yuzde", yuzde);
            if (hata != null) o.put("hata", hata);
            final String js = "window.E_guncelleme&&window.E_guncelleme(" + o + ")";
            runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
        } catch (Exception e) { /* yok */ }
    }
    private void guncellemeyiIndir(String adres) {
        guncellemeIptal = false;
        File hedef = guncellemeDosyasi(), gecici = new File(hedef.getPath() + ".part");
        try {
            java.net.URL url = new java.net.URL(adres);
            java.net.HttpURLConnection h = null;
            for (int i = 0; i < 6; i++) {           // github → objects.githubusercontent.com yönlendirmesi
                h = (java.net.HttpURLConnection) url.openConnection();
                h.setInstanceFollowRedirects(false);
                h.setConnectTimeout(15000); h.setReadTimeout(20000);
                int kod = h.getResponseCode();
                if (kod >= 300 && kod < 400) { url = new java.net.URL(url, h.getHeaderField("Location")); h.disconnect(); continue; }
                if (kod != 200) throw new java.io.IOException("Sunucu " + kod + " döndü");
                break;
            }
            long boy = h.getContentLengthLong(), alinan = 0;
            int son = -1;
            try (java.io.InputStream in = h.getInputStream(); java.io.FileOutputStream out = new java.io.FileOutputStream(gecici)) {
                byte[] tampon = new byte[64 * 1024];
                int n;
                while ((n = in.read(tampon)) > 0) {
                    if (guncellemeIptal) throw new java.io.IOException("iptal");
                    out.write(tampon, 0, n);
                    alinan += n;
                    int y = boy > 0 ? (int) (alinan * 100 / boy) : -1;
                    if (y != son) { son = y; guncellemeBildir("ilerleme", y, null); }
                }
            }
            if (hedef.exists()) hedef.delete();
            if (!gecici.renameTo(hedef)) throw new java.io.IOException("Dosya kaydedilemedi");
            guncellemeBildir("indi", 100, null);
            runOnUiThread(this::guncellemeyiKur);
        } catch (Throwable e) {
            gecici.delete();
            guncellemeBildir("hata", 0, "iptal".equals(e.getMessage()) ? "iptal" : String.valueOf(e.getMessage()));
        }
    }
    private void guncellemeyiKur() {
        if (BuildConfig.PLAY) return; // Play sürümünü yalnızca Play günceller
        File f = guncellemeDosyasi();
        if (!f.exists()) { guncellemeBildir("hata", 0, "Dosya bulunamadı"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            guncellemeBildir("izin", 100, null);
            try {
                startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())));
            } catch (Throwable e) { /* ayar açılamadı */ }
            return;
        }
        try {
            Uri uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".dosya", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            guncellemeBildir("kurulum", 100, null);
        } catch (Throwable e) {
            guncellemeBildir("hata", 0, String.valueOf(e.getMessage()));
        }
    }

    // ---------- bildirime dokununca ----------
    private void hedefAl(Intent i) {
        if (i == null) return;
        String h = i.getStringExtra("hedef");
        if (h != null && !h.isEmpty()) { bekleyenHedef = h; i.removeExtra("hedef"); }
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        hedefAl(i);
        if (bekleyenHedef != null && web != null)
            web.evaluateJavascript("window.E_bildirimAc&&window.E_bildirimAc()", null);
    }

    @Override
    protected void onDestroy() {
        if (simdiki == this) simdiki = null;
        super.onDestroy();
    }

    // ---------- video ----------
    private void videoBildir(org.json.JSONObject o) {
        final String js = "window.E_video&&window.E_video(" + o.toString() + ")";
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    private void videoSecildi(Uri uri) {
        String ayar = videoAyar;
        videoAyar = null;
        if (ayar == null) return;
        try {
            if (uri == null) {
                org.json.JSONObject a = new org.json.JSONObject(ayar);
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("id", a.optString("id"));
                o.put("durum", "iptal");
                videoBildir(o);
                return;
            }
            if (video != null) video.iptalEt();
            video = new VideoIsleyici(this, uri, ayar, this::videoBildir);
            video.basla();
        } catch (Throwable e) {
            hatayiKaydet("Video başlatılamadı", e);
        }
    }

    private void geriTusu() {
        if (web == null || !sayfaHazir) { finish(); return; }
        web.evaluateJavascript("(window.handleBack&&window.handleBack())?'1':'0'", r -> {
            if (r == null || !r.contains("1")) finish();
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        geriTusu();
    }

    @Override
    protected void onResume() {
        super.onResume();
        onde = true;
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        onde = false;
        if (web != null) web.onPause();
        super.onPause();
    }

    private void biyometrikSonuc(final boolean tamam) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("window.E_biyometrikSonuc&&window.E_biyometrikSonuc(" + tamam + ")", null);
        });
    }

    /** Sayfanın çağırdığı telefon işlevleri. */
    public class Kopru {
        private final Context ctx;
        Kopru(Context c) { ctx = c.getApplicationContext(); }

        @JavascriptInterface
        public void videoSec(final String ayarJson) {
            runOnUiThread(() -> {
                try {
                    videoAyar = ayarJson;
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("video/*");
                    startActivityForResult(Intent.createChooser(i, "Video seç"), VIDEO_ISTEGI);
                } catch (Throwable e) {
                    videoSecildi(null);
                }
            });
        }

        @JavascriptInterface
        public void videoIptal(final String id) {
            runOnUiThread(() -> {
                if (video != null && video.kimlik().equals(id)) { video.iptalEt(); video = null; }
            });
        }

        // ---------- uygulama içi güncelleme ----------
        @JavascriptInterface
        public void guncellemeIndir(String adres) {
            if (BuildConfig.PLAY) return;
            new Thread(() -> guncellemeyiIndir(adres)).start();
        }

        @JavascriptInterface
        public void guncellemeKur() { runOnUiThread(() -> guncellemeyiKur()); }

        @JavascriptInterface
        public void guncellemeIptal() { guncellemeIptal = true; }

        @JavascriptInterface
        public void bildirimBaslat(String ayar) {
            if (!ErkamUygulama.firebaseBaslat(getApplicationContext(), ayar)) return;
            UlakServisi.kanallar(MainActivity.this);
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, BILDIRIM_IZNI));
            }
            try {
                com.google.firebase.messaging.FirebaseMessaging.getInstance().setAutoInitEnabled(true);
                com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
                    .addOnSuccessListener(t -> { if (t != null) tokenBildir(t); });
            } catch (Throwable e) { /* firebase hazır değil */ }
        }

        @JavascriptInterface
        public void bildirimDurdur() {
            try {
                com.google.firebase.messaging.FirebaseMessaging.getInstance().setAutoInitEnabled(false);
                com.google.firebase.messaging.FirebaseMessaging.getInstance().deleteToken();
            } catch (Throwable e) { /* yok */ }
        }

        @JavascriptInterface
        public String bildirimIzni() {
            if (Build.VERSION.SDK_INT < 33) return "var";
            return checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED ? "var" : "yok";
        }

        @JavascriptInterface
        public String bekleyenHedef() {
            String h = bekleyenHedef;
            bekleyenHedef = null;
            return h == null ? "" : h;
        }

        @JavascriptInterface
        public void paylas(String metin, String resim64) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.putExtra(Intent.EXTRA_TEXT, metin);
                    Uri uri = null;
                    if (resim64 != null && !resim64.isEmpty()) {
                        File kl = new File(getCacheDir(), "secim");
                        if (!kl.exists()) kl.mkdirs();
                        File f = new File(kl, "ulak.jpg");
                        try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
                            out.write(android.util.Base64.decode(resim64, android.util.Base64.DEFAULT));
                        }
                        uri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".dosya", f);
                    }
                    if (uri != null) {
                        i.setType("image/jpeg");
                        i.putExtra(Intent.EXTRA_STREAM, uri);
                        i.setClipData(ClipData.newRawUri("ERKAM", uri));
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } else {
                        i.setType("text/plain");
                    }
                    Intent secici = Intent.createChooser(i, "Ulakla gönder");
                    secici.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(secici);
                } catch (Throwable e) { /* paylaşılamadı */ }
            });
        }

        /** Metin dosyasını İndirilenler klasörüne kaydeder (Android 10+); eskilerde paylaşım penceresiyle verir. */
        @JavascriptInterface
        public boolean dosyaKaydet(String ad, String icerik, String tur) {
            try {
                String guvenliAd = ad.replaceAll("[^A-Za-z0-9._-]", "_");
                byte[] veri = icerik.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    android.content.ContentValues d = new android.content.ContentValues();
                    d.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, guvenliAd);
                    d.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, tur);
                    d.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);
                    Uri u = ctx.getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, d);
                    if (u == null) return false;
                    try (java.io.OutputStream o = ctx.getContentResolver().openOutputStream(u)) {
                        if (o == null) return false;
                        o.write(veri);
                    }
                    return true;
                }
                File kl = new File(getCacheDir(), "secim");
                if (!kl.exists()) kl.mkdirs();
                File f = new File(kl, guvenliAd);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(veri); }
                final Uri uri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".dosya", f);
                runOnUiThread(() -> {
                    try {
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType(tur);
                        i.putExtra(Intent.EXTRA_STREAM, uri);
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(i, "Verilerimi kaydet"));
                    } catch (Throwable ignored) { }
                });
                return true;
            } catch (Throwable e) { return false; }
        }

        /** Oturum açık cihazlar listesi için telefonun adı, markası, modeli ve Android sürümü. */
        @JavascriptInterface
        public String cihazBilgi() {
            try {
                String ad = null;
                try { ad = android.provider.Settings.Global.getString(ctx.getContentResolver(), "device_name"); } catch (Throwable ignored) { }
                if (ad == null || ad.isEmpty()) {
                    try { ad = android.provider.Settings.Secure.getString(ctx.getContentResolver(), "bluetooth_name"); } catch (Throwable ignored) { }
                }
                org.json.JSONObject j = new org.json.JSONObject();
                j.put("marka", Build.MANUFACTURER);
                j.put("model", Build.MODEL);
                j.put("ad", ad == null ? "" : ad);
                j.put("android", Build.VERSION.RELEASE);
                return j.toString();
            } catch (Throwable e) { return "{}"; }
        }

        @JavascriptInterface
        public boolean playSurumu() { return BuildConfig.PLAY; }

        @JavascriptInterface
        public String surum() {
            try {
                PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
                return p.versionName;
            } catch (Exception e) { return "0.1"; }
        }

        @JavascriptInterface
        public void titret(int ms) {
            try {
                Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(ms, 200)), 120));
            } catch (Exception ignored) { }
        }

        /** Açık temada durum çubuğu simgelerini koyulaştırır. */
        @JavascriptInterface
        public void tema(final String ad) {
            final boolean acik = "acik".equals(ad);
            runOnUiThread(() -> {
                try {
                    if (kok != null) kok.setBackgroundColor(acik ? ACIK : KOYU);
                    if (web != null) web.setBackgroundColor(acik ? ACIK : KOYU);
                    Window w = getWindow();
                    if (Build.VERSION.SDK_INT >= 30) {
                        WindowInsetsController c = w.getInsetsController();
                        if (c != null) {
                            int maske = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                            c.setSystemBarsAppearance(acik ? maske : 0, maske);
                        }
                    } else {
                        int f = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                        if (acik) f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        w.getDecorView().setSystemUiVisibility(f);
                    }
                } catch (Throwable ignored) { }
            });
        }

        /** var | kayitsiz | yok */
        @JavascriptInterface
        public String biyometrikDurum() {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    BiometricManager bm = (BiometricManager) ctx.getSystemService(Context.BIOMETRIC_SERVICE);
                    if (bm == null) return "yok";
                    int r = bm.canAuthenticate();
                    if (r == BiometricManager.BIOMETRIC_SUCCESS) return "var";
                    if (r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) return "kayitsiz";
                    return "yok";
                }
                if (Build.VERSION.SDK_INT >= 28) {
                    return ctx.getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT) ? "var" : "yok";
                }
            } catch (Throwable ignored) { }
            return "yok";
        }

        @JavascriptInterface
        public void biyometrikSor() {
            if (Build.VERSION.SDK_INT < 28) { biyometrikSonuc(false); return; }
            runOnUiThread(() -> {
                try {
                    BiometricPrompt istem = new BiometricPrompt.Builder(MainActivity.this)
                            .setTitle("ERKAM: Kimliğini Tasdik Et")
                            .setSubtitle("Meclise girmek için biyometrik mührünü bas")
                            .setNegativeButton("İptal", getMainExecutor(), (d, hangi) -> biyometrikSonuc(false))
                            .build();
                    istem.authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult sonuc) {
                            biyometrikSonuc(true);
                        }

                        @Override
                        public void onAuthenticationError(int kod, CharSequence mesaj) {
                            biyometrikSonuc(false);
                        }
                    });
                } catch (Throwable e) {
                    biyometrikSonuc(false);
                }
            });
        }
    }
}
