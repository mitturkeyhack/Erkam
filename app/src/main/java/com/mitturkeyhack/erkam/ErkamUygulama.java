package com.mitturkeyhack.erkam;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.json.JSONObject;

/** Firebase'i (google-services eklentisi olmadan) kayıtlı istemci ayarıyla başlatır. */
public class ErkamUygulama extends Application {
    static final String TERCIH = "erkam_bildirim";

    @Override
    public void onCreate() {
        super.onCreate();
        try { UlakServisi.kanallar(this); } catch (Throwable ignored) { }
        firebaseBaslat(this, null);
    }

    /** ayar null ise kayıtlıyı kullanır. Başarılıysa true. */
    static boolean firebaseBaslat(Context c, String ayar) {
        try {
            SharedPreferences sp = c.getSharedPreferences(TERCIH, MODE_PRIVATE);
            if (ayar != null) sp.edit().putString("ayar", ayar).apply();
            else ayar = sp.getString("ayar", null);
            if (ayar == null) return false;
            if (!FirebaseApp.getApps(c).isEmpty()) return true;
            JSONObject o = new JSONObject(ayar);
            FirebaseOptions s = new FirebaseOptions.Builder()
                .setApplicationId(o.getString("appId"))
                .setApiKey(o.getString("apiKey"))
                .setProjectId(o.getString("projectId"))
                .setGcmSenderId(o.getString("senderId"))
                .build();
            FirebaseApp.initializeApp(c, s);
            return true;
        } catch (Throwable e) {
            return false;
        }
    }
}
