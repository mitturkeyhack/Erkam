// ERKAM — çekirdek: yardımcılar, sunucu bağlantısı, gezinme altyapısı
(function () {
  'use strict';

  var E = window.E = {
    ben: null,          // profilim (ben() sonucu)
    oturum: null,       // supabase oturumu
    ekran: 'sura',      // kabuktaki etkin ekran
    yigin: [],          // üst üste açılan tam ekran sayfalar
    katmanlar: [],      // alt sayfalar / pencereler
    ayar: {}
  };

  // ---------- küçük yardımcılar ----------
  E.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  E.ikon = function (ad, sinif) {
    var d = (window.IKON || {})[ad] || (window.IKON || {})['alert-circle-outline'] || '';
    return '<svg class="ik' + (sinif ? ' ' + sinif : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  };
  E.$ = function (sec, kok) { return (kok || document).querySelector(sec); };
  E.$$ = function (sec, kok) { return Array.prototype.slice.call((kok || document).querySelectorAll(sec)); };

  E.gorselUrl = function (yol) {
    if (!yol) return '';
    return E.ayar.url + '/storage/v1/object/public/gorseller/' + yol.split('/').map(encodeURIComponent).join('/');
  };
  E.avatar = function (kisi, ek) {
    var ic = kisi && kisi.avatar_yol
      ? '<img src="' + E.esc(E.gorselUrl(kisi.avatar_yol)) + '" alt="" loading="lazy">'
      : E.ikon('account-circle');
    return '<span class="avatar' + (ek ? ' ' + ek : '') + '">' + ic + '</span>';
  };

  var AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  function iki(n) { return (n < 10 ? '0' : '') + n; }
  E.saat = function (t) { var d = new Date(t); return iki(d.getHours()) + ':' + iki(d.getMinutes()); };
  // "10 dk önce", "1 saat önce", "1 gün önce"
  E.once = function (t) {
    var d = new Date(t), sn = (Date.now() - d.getTime()) / 1000;
    if (sn < 60) return 'Şimdi';
    if (sn < 3600) return Math.floor(sn / 60) + ' dk önce';
    if (sn < 86400) return Math.floor(sn / 3600) + ' saat önce';
    if (sn < 86400 * 7) return Math.floor(sn / 86400) + ' gün önce';
    return d.getDate() + ' ' + AYLAR[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  };
  // kelam kartı için X tarzı kısa süre: şimdi, 5dk, 3s, 11 Kas, 11 Kas 2025
  E.kelamSure = function (t) {
    var d = new Date(t), sn = (Date.now() - d.getTime()) / 1000;
    if (isNaN(sn)) return '';
    if (sn < 60) return 'şimdi';
    if (sn < 3600) return Math.floor(sn / 60) + 'dk';
    if (sn < 86400) return Math.floor(sn / 3600) + 's';
    return d.getDate() + ' ' + AYLAR[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  };
  // kelam detayı için tam zaman: "00:44 · 12 Kas 2026"
  E.tamZaman = function (t) {
    var d = new Date(t);
    return '<b>' + E.saat(t) + '</b> · ' + d.getDate() + ' ' + AYLAR[d.getMonth()] + ' ' + d.getFullYear();
  };
  // sohbet listesi için: "10:45", "Dün", "Pzt", "3 Kas"
  E.kisaZaman = function (t) {
    var d = new Date(t), b = new Date();
    var gun = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (gun <= 0) return E.saat(t);
    if (gun === 1) return 'Dün';
    if (gun < 7) return GUNLER[d.getDay()];
    return d.getDate() + ' ' + AYLAR[d.getMonth()];
  };
  E.gunAdi = function (t) {
    var d = new Date(t), b = new Date();
    var gun = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (gun <= 0) return 'Bugün';
    if (gun === 1) return 'Dün';
    return d.getDate() + ' ' + AYLAR[d.getMonth()] + ' ' + d.getFullYear();
  };

  // ---------- tost ----------
  E.tost = function (metin, tur) {
    var kutu = E.$('#tost');
    if (!kutu) return;
    // aynı uyarı zaten ekrandaysa ikinci kez gösterme
    for (var i = 0; i < kutu.children.length; i++) if (kutu.children[i].textContent === metin) return;
    var el = document.createElement('div');
    if (tur) el.className = tur;
    el.textContent = metin;
    kutu.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  };

  // ---------- hata çevirisi ----------
  var HATA = {
    giris_gerekli: 'Oturumun kapanmış. Meclise yeniden gir.',
    cok_hizli: 'Çok hızlısın yoldaş. Biraz soluklan, sonra tekrar dene.',
    kunye_dolu: 'Bu künye başka bir yoldaşa ait.',
    kunye_gecersiz: 'Künye 3-20 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi.',
    isim_gecersiz: 'İsim 2-40 karakter olmalı.',
    biyografi_uzun: 'Biyografi en fazla 160 karakter olabilir.',
    kelam_yok: 'Aradığın kelam mecliste bulunamadı.',
    yetki_yok: 'Bu kelamı görme yetkin yok.',
    yoldas_yok: 'Yoldaş bulunamadı.',
    kendin: 'Bunu kendine yapamazsın.',
    yol_gecersiz: 'Görsel yüklenemedi.',
    bos_kelam: 'Bir şey yaz ya da bir fotoğraf ekle.',
    medya_gecersiz: 'Bir kelamda en fazla 4 fotoğraf ya da 1 video olabilir.',
    susturuldun: 'Yönetim seni bir süreliğine susturdu; şu an kelam ve mesaj gönderemezsin.',
    uzaklastirildin: 'Meclisten uzaklaştırıldın.',
    duyuru_gecersiz: 'Duyuru 3-600 karakter olmalı.',
    baslik_gecersiz: 'Başlık en az 2 karakter olmalı.',
    islem_gecersiz: 'Bu işlem yapılamadı.',
    uzlette: 'Bu yoldaş şu an uzlette; mesaj alamıyor.',
    istisare_bitti: 'Bu istişare sonuçlandı.',
    engelli: 'Bu yoldaşla aranızda engel var.',
    istisare_secenek: 'En az iki farklı seçenek yazmalısın (en çok dört).',
    istisare_yok: 'Bu istişare artık yok.',
    oda_yok: 'Bu meclis odasına erişimin yok.',
    oda_adi: 'Oda adı 2-40 karakter olmalı.',
    oda_cok: 'En fazla 20 oda kurabilirsin.',
    tadil_suresi: 'Tadil süresi (15 dakika) doldu.',
    gizli_hesap: 'Gizli hesabın kelamı naklolunamaz.',
    bos_mesaj: 'Boş mesaj gönderilemez.',
    kunye_ayrilmis: 'Bu künye ERKAM\'a ayrılmıştır; başka bir künye seç.',
    onay_eksik: 'Devam etmek için metinleri onaylaman gerekiyor.',
    yas_kucuk: '15 yaşından küçükler meclise katılamaz.',
    dogum_gecersiz: 'Geçerli bir doğum tarihi seç.',
    basvuru_cok: 'Cevap bekleyen 3 başvurun var.',
    cevap_kisa: 'Cevap en az 5 karakter olmalı.'
  };
  E.hataMetni = function (h) {
    var m = (h && (h.message || h.error_description || h.msg)) || String(h || '');
    for (var k in HATA) if (m.indexOf(k) !== -1) return HATA[k];
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Bağlantı kurulamadı. İnternetini kontrol et.';
    if (/Invalid login credentials/i.test(m)) return 'E-posta veya şifre hatalı.';
    if (/Token has expired|otp_expired|invalid.*otp|otp.*invalid/i.test(m)) return 'Kod hatalı ya da süresi dolmuş. Kontrol et ya da yeni kod iste.';
    if (/Email not confirmed/i.test(m)) return 'E-postan henüz tasdik edilmemiş.';
    if (/you can only request this after (\d+)/i.test(m)) return 'Yeni kod için ' + m.match(/after (\d+)/i)[1] + ' saniye bekle.';
    if (/Error sending|sending (confirmation|recovery|magic)/i.test(m)) return 'E-posta gönderilemedi. Biraz sonra tekrar dene.';
    if (/User not found/i.test(m)) return 'Bu e-postayla kayıtlı bir yoldaş yok.';
    if (/already registered|already been registered/i.test(m)) return 'Bu e-posta ile zaten bir yoldaş kayıtlı.';
    if (/Password should be at least/i.test(m)) return 'Şifre en az 6 karakter olmalı.';
    if (/valid email|invalid format|is invalid/i.test(m)) return 'Geçerli bir e-posta adresi yaz.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.';
    if (/different from the old/i.test(m)) return 'Yeni şifre eskisinden farklı olmalı.';
    if (/check constraint|violates/i.test(m)) return 'Girdiğin bilgi kabul edilmedi.';
    if (/JWT|token/i.test(m)) return 'Oturumun kapanmış. Meclise yeniden gir.';
    return 'Sistem Hatası: ' + m.slice(0, 140);
  };

  // ---------- sunucu ----------
  E.baglan = function () {
    E.ayar = window.ERKAM_AYAR || {};
    E.sb = window.supabase.createClient(E.ayar.url, E.ayar.anahtar, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'erkam-oturum' }
    });
    return E.sb;
  };
  E.rpc = function (ad, p) {
    return E.sb.rpc(ad, p || {}).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  };

  // ---------- yerel tercih ----------
  E.tercih = function (ad, deger) {
    try {
      if (arguments.length === 1) return localStorage.getItem('erkam_' + ad);
      if (deger == null) localStorage.removeItem('erkam_' + ad);
      else localStorage.setItem('erkam_' + ad, String(deger));
    } catch (e) { /* depolama kapalıysa sessiz geç */ }
    return deger;
  };
  E.temaUygula = function () {
    var acik = E.tercih('fecr') !== '0'; // varsayılan: Fecr Modu (açık tema)
    document.documentElement.setAttribute('data-tema', acik ? 'acik' : 'koyu');
    try { if (window.Android && Android.tema) Android.tema(acik ? 'acik' : 'koyu'); } catch (e) { /* köprü yok */ }
  };

  // ---------- görsel hazırlama (küçült + JPEG) ----------
  E.gorselHazirla = function (dosya, enBuyuk) {
    return new Promise(function (coz, red) {
      if (!dosya || !/^image\//.test(dosya.type || '')) return red(new Error('Bu dosya bir görsel değil.'));
      var url = URL.createObjectURL(dosya);
      var img = new Image();
      img.onload = function () {
        var o = Math.min(1, enBuyuk / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * o)), h = Math.max(1, Math.round(img.height * o));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? coz(b) : red(new Error('Görsel işlenemedi.')); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Görsel açılamadı.')); };
      img.src = url;
    });
  };
  E.gorselYukle = function (dosya, ad, enBuyuk) {
    return E.gorselHazirla(dosya, enBuyuk).then(function (blob) {
      var yol = E.ben.id + '/' + ad + '-' + Date.now().toString(36) + '.jpg';
      return E.sb.storage.from('gorseller').upload(yol, blob, { contentType: 'image/jpeg', upsert: true })
        .then(function (r) { if (r.error) throw r.error; return yol; });
    });
  };
  E.dosyaSec = function () {
    return new Promise(function (coz) {
      var g = document.createElement('input');
      g.type = 'file'; g.accept = 'image/*'; g.style.display = 'none';
      g.onchange = function () { coz(g.files && g.files[0] ? g.files[0] : null); if (g.parentNode) g.parentNode.removeChild(g); };
      g.addEventListener('cancel', function () { coz(null); if (g.parentNode) g.parentNode.removeChild(g); });
      document.body.appendChild(g);
      g.click();
    });
  };

  // ---------- katmanlar (alt sayfa / pencere) ----------
  E.katmanAc = function (html, sinif) {
    var kok = E.$('#katman');
    var sar = document.createElement('div');
    sar.innerHTML = '<div class="perde" data-is="katman-kapat"></div><div class="' + (sinif || 'yaprak') + '">' + html + '</div>';
    kok.appendChild(sar);
    E.katmanlar.push(sar);
    return sar.lastChild;
  };
  E.katmanKapat = function () {
    var s = E.katmanlar.pop();
    if (s && s.parentNode) s.parentNode.removeChild(s);
    if (s && s._kapaninca) s._kapaninca();
  };
  E.tumKatmanlariKapat = function () { while (E.katmanlar.length) E.katmanKapat(); };

  // evet/hayır penceresi
  E.sor = function (baslik, metin, evet, kirmizi) {
    return new Promise(function (coz) {
      var p = E.katmanAc('<h3>' + E.esc(baslik) + '</h3><p>' + E.esc(metin) + '</p><div class="dgm">' +
        '<button class="cerceve" data-c="0">İptal</button>' +
        '<button class="' + (kirmizi ? 'kirmizi' : 'dolu') + '" data-c="1">' + E.esc(evet) + '</button></div>', 'pencere');
      var bitti = false;
      p.parentNode._kapaninca = function () { if (!bitti) coz(false); };
      p.addEventListener('click', function (o) {
        var b = o.target.closest('[data-c]');
        if (!b) return;
        bitti = true; E.katmanKapat(); coz(b.getAttribute('data-c') === '1');
      });
    });
  };

  // ---------- tam ekran sayfalar ----------
  // tanim: { ad, html, kur(el), kapaninca() }
  E.sayfaAc = function (tanim) {
    var el = document.createElement('div');
    el.className = 'sayfa';
    el.innerHTML = tanim.html;
    E.$('#sayfalar').appendChild(el);
    tanim.el = el;
    E.yigin.push(tanim);
    if (tanim.kur) tanim.kur(el);
    return el;
  };
  E.sayfaKapat = function () {
    var t = E.yigin.pop();
    if (!t) return;
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    if (t.kapaninca) t.kapaninca();
    var ust = E.yigin[E.yigin.length - 1];
    if (ust && ust.donunce) ust.donunce();
    else if (!ust && E.kabukYenile) E.kabukYenile(true);
  };
  E.tumSayfalariKapat = function () {
    while (E.yigin.length) {
      var t = E.yigin.pop();
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
      if (t.kapaninca) t.kapaninca();
    }
  };
  E.sayfaBasligi = function (ic, sag) {
    return '<div class="ust"><button class="ikb yesil" data-is="geri" aria-label="Geri">' + E.ikon('arrow-left') + '</button>' +
      ic + (sag || '<span class="bos"></span>') + '</div>';
  };

  // Android geri tuşu: true dönerse uygulama içinde bir şey kapandı
  window.handleBack = function () {
    if (E.$('.muhurlu')) return true;
    if (E.katmanlar.length) { E.katmanKapat(); return true; }
    if (E.$('#cekmece-kok') && E.$('#cekmece-kok').firstChild) { E.cekmeceKapat(); return true; }
    if (E.yigin.length) { E.sayfaKapat(); return true; }
    if (E.oturum && E.ekran !== 'sura') { E.git('sura'); return true; }
    return false;
  };

  // ---------- tıklama dağıtımı ----------
  E.is = {};
  document.addEventListener('click', function (o) {
    var el = o.target.closest('[data-is]');
    if (!el || el.disabled) return;
    var f = E.is[el.getAttribute('data-is')];
    if (f) {
      try {
        var s = f(el, o);
        if (s && s.catch) s.catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
      } catch (h) { E.tost(E.hataMetni(h), 'kotu'); }
    }
  });
  E.is['katman-kapat'] = function () { E.katmanKapat(); };
  E.is.geri = function () { E.sayfaKapat(); };

  // beklenmeyen hatalar görünür olsun
  window.addEventListener('unhandledrejection', function (o) {
    try { console.error('ERKAM', o.reason); } catch (e) { /* yok */ }
  });
})();
