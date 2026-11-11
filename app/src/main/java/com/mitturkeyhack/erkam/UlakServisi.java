package com.mitturkeyhack.erkam;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/** Sunucudan gelen ulak bildirimlerini telefonun bildirim çubuğunda gösterir. */
public class UlakServisi extends FirebaseMessagingService {

    @Override
    public void onNewToken(String token) {
        getSharedPreferences(ErkamUygulama.TERCIH, MODE_PRIVATE).edit().putString("token", token).apply();
        MainActivity.tokenBildir(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        if (d == null || d.isEmpty()) return;
        if (MainActivity.onde) return;   // uygulama açıkken uygulama içi bildirim yeterli
        goster(this, d);
    }

    static void kanallar(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel a = new NotificationChannel("mesaj", "Mesajlar", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("Yoldaşlarından gelen mesajlar");
        NotificationChannel b = new NotificationChannel("meclis", "Meclis bildirimleri", NotificationManager.IMPORTANCE_HIGH);
        b.setDescription("Tasdik, cevap, etiket ve yoldaşlık bildirimleri");
        nm.createNotificationChannel(a);
        nm.createNotificationChannel(b);
    }

    static void goster(Context c, Map<String, String> d) {
        kanallar(c);
        String tur = d.get("tur") == null ? "" : d.get("tur");
        String grup = d.get("grup") == null ? "genel" : d.get("grup");
        String baslik = d.get("baslik") == null ? "ERKAM" : d.get("baslik");
        String govde = d.get("govde") == null ? "" : d.get("govde");

        Intent ac = new Intent(c, MainActivity.class);
        ac.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        ac.putExtra("hedef", d.get("hedef") == null ? "" : d.get("hedef"));
        PendingIntent pi = PendingIntent.getActivity(c, grup.hashCode(), ac,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "mesaj".equals(tur) ? "mesaj" : "meclis")
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(0xFF059669)
            .setContentTitle(baslik)
            .setContentText(govde)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(govde))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory("mesaj".equals(tur) ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_SOCIAL)
            .setContentIntent(pi);
        Bitmap av = yuvarlakResim(d.get("avatar"));
        if (av != null) b.setLargeIcon(av);
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.notify(grup.hashCode(), b.build());
        } catch (SecurityException e) { /* bildirim izni yok */ }
    }

    static Bitmap yuvarlakResim(String adres) {
        if (adres == null || adres.isEmpty()) return null;
        try {
            HttpURLConnection h = (HttpURLConnection) new URL(adres).openConnection();
            h.setConnectTimeout(4000); h.setReadTimeout(4000);
            InputStream in = h.getInputStream();
            Bitmap b = BitmapFactory.decodeStream(in);
            in.close();
            if (b == null) return null;
            int s = Math.min(b.getWidth(), b.getHeight());
            Bitmap kare = Bitmap.createBitmap(b, (b.getWidth() - s) / 2, (b.getHeight() - s) / 2, s, s);
            Bitmap k = Bitmap.createScaledBitmap(kare, 192, 192, true);
            Bitmap o = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setShader(new BitmapShader(k, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            new Canvas(o).drawCircle(96, 96, 96, p);
            return o;
        } catch (Throwable e) {
            return null;
        }
    }
}
