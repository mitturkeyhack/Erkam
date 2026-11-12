// ERKAM — Ulak Bildirim: yeni bildirim/mesaj olunca alıcının telefonlarına FCM ile gönderir.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

let hizmet: any = null;
let erisim: { token: string; bitis: number } | null = null;

// Firebase hizmet hesabı Supabase'in gizli ayarlarında (FIREBASE_HIZMET) durur
function hizmetAl() {
  if (hizmet) return hizmet;
  const ham = Deno.env.get("FIREBASE_HIZMET");
  if (!ham) throw new Error("FIREBASE_HIZMET yok");
  hizmet = JSON.parse(ham);
  return hizmet;
}

function b64url(b: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Hizmet hesabıyla Google OAuth erişim anahtarı al
async function erisimAl(h: any) {
  if (erisim && erisim.bitis > Date.now() + 60_000) return erisim.token;
  const simdi = Math.floor(Date.now() / 1000);
  const bas = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const yuk = b64url(JSON.stringify({
    iss: h.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: simdi, exp: simdi + 3600,
  }));
  const pem = h.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const anahtar = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const imza = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", anahtar, new TextEncoder().encode(bas + "." + yuk));
  const jwt = bas + "." + yuk + "." + b64url(imza);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("oauth: " + JSON.stringify(j));
  erisim = { token: j.access_token, bitis: Date.now() + (j.expires_in || 3600) * 1000 };
  return erisim.token;
}

function metinler(v: any): { baslik: string; govde: string; hedef: string; grup: string } {
  const kim = v.isim || "Bir yoldaş";
  const km = v.metin ? "“" + String(v.metin).replace(/\s+/g, " ").slice(0, 120) + "”" : "";
  switch (v.tur) {
    case "mesaj": return { baslik: kim, govde: v.metin || "Yeni mesaj", hedef: "sohbet:" + v.kunye, grup: "mesaj-" + v.kunye };
    case "tasdik": return { baslik: kim + " kelamını tasdikledi ☪", govde: km || "Kelamın tasdik aldı.", hedef: "kelam:" + v.kelam, grup: "kelam-" + v.kelam };
    case "cevap": return { baslik: kim + " kelamına cevap verdi", govde: km || "Kelamına yeni bir cevap var.", hedef: "kelam:" + v.kelam, grup: "kelam-" + v.kelam };
    case "etiket": return { baslik: kim + " seni bir kelamda andı", govde: km || "Bir kelamda etiketlendin.", hedef: "kelam:" + v.kelam, grup: "kelam-" + v.kelam };
    case "yoldas": return { baslik: "Yeni yoldaş", govde: kim + " (@" + v.kunye + ") seni yoldaş edindi.", hedef: "profil:" + v.kunye, grup: "yoldas" };
    case "istek": return { baslik: "Yoldaşlık isteği", govde: kim + " (@" + v.kunye + ") yoldaşın olmak istiyor.", hedef: "profil:" + v.kunye, grup: "yoldas" };
    case "kabul": return { baslik: "İstek tasdiklendi", govde: kim + " (@" + v.kunye + ") yoldaşlık isteğini kabul etti.", hedef: "profil:" + v.kunye, grup: "yoldas" };
    case "nakil": return { baslik: kim + " kelamını nakletti", govde: km || "Kelamın yoldaşlara nakledildi.", hedef: "kelam:" + v.kelam, grup: "kelam-" + v.kelam };
    case "iktibas": return { baslik: kim + " kelamını iktibas etti", govde: km || "Kelamın iktibas edildi.", hedef: "kelam:" + v.kelam, grup: "kelam-" + v.kelam };
    case "oda": return { baslik: v.oda_ad || "Meclis odası", govde: (v.isim ? v.isim + ": " : "") + (v.metin || "Yeni mesaj"), hedef: "oda:" + v.oda, grup: "oda-" + v.oda };
    case "duyuru": return { baslik: "📣 ERKAM Duyurusu", govde: v.metin || "Meclisten yeni bir duyuru var.", hedef: "", grup: "duyuru" };
    case "uyari": return { baslik: "Yönetimden bildirim", govde: v.metin || "Hesabınla ilgili bir gelişme var.", hedef: "", grup: "uyari" };
    default: return { baslik: "ERKAM", govde: "Mecliste yeni bir gelişme var.", hedef: "", grup: "genel" };
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("yok", { status: 405 });
    const { tur, id } = await req.json();
    if ((tur !== "bildirim" && tur !== "mesaj" && tur !== "oda") || !Number.isInteger(id)) return new Response("gecersiz", { status: 400 });
    // ulak_icerik her kaydı yalnızca bir kez ve sadece taze iken verir; başkası çağırsa da sahte bildirim gidemez
    const h = hizmetAl();
    const { data: v, error } = await db.rpc("ulak_icerik", { p_tur: tur, p_id: id });
    if (error) throw error;
    if (!v || !v.tokenler?.length) return new Response("alici_yok");
    const m = metinler(v);
    const avatar = v.avatar ? URL_ + "/storage/v1/object/public/gorseller/" + String(v.avatar).split("/").map(encodeURIComponent).join("/") : "";
    const tok = await erisimAl(h);
    const proje = h.project_id;
    let gitti = 0;
    for (const t of v.tokenler as string[]) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${proje}/messages:send`, {
        method: "POST",
        headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: t,
            // notification bloğu: uygulama kapalı/temizlenmiş olsa bile bildirimi sistem gösterir
            notification: { title: m.baslik, body: m.govde },
            android: {
              priority: "HIGH", ttl: "86400s",
              notification: {
                channel_id: String(v.tur) === "mesaj" || String(v.tur) === "oda" ? "mesaj" : "meclis",
                icon: "ic_bildirim", color: "#059669", tag: m.grup, sound: "default",
                default_vibrate_timings: true, notification_priority: "PRIORITY_HIGH",
              },
            },
            data: {
              baslik: m.baslik, govde: m.govde, hedef: m.hedef, grup: m.grup, tur: String(v.tur),
              avatar, kisi: String(v.isim || ""), sayi: String(v.okunmamis ?? ""),
            },
          },
        }),
      });
      if (r.ok) gitti++;
      else {
        const j = await r.json().catch(() => ({}));
        const kod = j?.error?.details?.[0]?.errorCode || j?.error?.status;
        if (r.status === 404 || kod === "UNREGISTERED") await db.rpc("cihaz_dusur", { p_token: t });
        console.log("fcm hata", r.status, JSON.stringify(j).slice(0, 300));
      }
    }
    return new Response(JSON.stringify({ gitti }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("ulak hata", String(e));
    return new Response("hata", { status: 500 });
  }
});
