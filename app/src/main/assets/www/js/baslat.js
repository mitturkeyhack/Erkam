// ERKAM — açılış: oturum, giriş/kayıt, canlı bağlantı, biyometrik mühür
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;
  var kanal = null, nabiz = null, girisModu = 'giris', girenKimlik = null;

  // ---------- Giriş / Kayıt ----------
  function girisCiz(mesaj, tur) {
    var g = E.$('#giris');
    var kayit = girisModu === 'kayit';
    g.innerHTML = '<div class="logo">' + ikon('star-crescent') + '</div><h1>ERKAM</h1>' +
      (mesaj ? '<div class="' + (tur || 'hata') + '">' + esc(mesaj) + '</div>' : '') +
      (kayit ? '<input class="alan" id="g-isim" placeholder="İsim Soyisim" maxlength="40" autocomplete="name">' +
        '<input class="alan" id="g-kunye" placeholder="Künye (kullanıcı adı)" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false">' +
        '<div class="not" id="g-kunye-not">Küçük harf, rakam ve alt çizgi; 3-20 karakter.</div>' : '') +
      '<input class="alan" id="g-eposta" type="email" placeholder="E-posta" autocapitalize="none" autocomplete="email" spellcheck="false">' +
      '<input class="alan" id="g-sifre" type="password" placeholder="Şifre" autocomplete="' + (kayit ? 'new-password' : 'current-password') + '">' +
      '<button class="dugme" id="g-dugme">' + (kayit ? 'Meclise Katıl' : 'Meclise Gir') + '</button>' +
      '<button class="gecis" id="g-gecis">' + (kayit ? 'Zaten yoldaş mısın? <b>Meclise Gir</b>' : 'Henüz yoldaş değil misin? <b>Meclise Katıl</b>') + '</button>';
    g.hidden = false;
    E.$('#g-gecis').onclick = function () { girisModu = kayit ? 'giris' : 'kayit'; girisCiz(); };
    E.$('#g-dugme').onclick = kayit ? kayitOl : girisYap;
    E.$('#g-sifre').onkeydown = function (o) { if (o.key === 'Enter') E.$('#g-dugme').click(); };
    if (kayit) {
      var bekle = null, sayac = 0;
      E.$('#g-kunye').oninput = function () {
        var el = E.$('#g-kunye'), not = E.$('#g-kunye-not');
        var v = el.value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
        if (v !== el.value) el.value = v;
        clearTimeout(bekle);
        not.className = 'not';
        if (v.length < 3) { not.textContent = 'Küçük harf, rakam ve alt çizgi; 3-20 karakter.'; return; }
        not.textContent = 'Künye sorgulanıyor...';
        bekle = setTimeout(function () {
          var s = ++sayac;
          E.rpc('kunye_musait', { p_kunye: v }).then(function (bos) {
            if (s !== sayac || !E.$('#g-kunye-not')) return;
            not.className = 'not ' + (bos ? 'iyi' : 'kotu');
            not.textContent = bos ? '@' + v + ' müsait.' : 'Bu künye başka bir yoldaşa ait.';
          }).catch(function () { if (s === sayac && E.$('#g-kunye-not')) not.textContent = 'Künye şu an sorgulanamadı.'; });
        }, 350);
      };
    }
  }
  function mesgul(evet, metin) {
    var d = E.$('#g-dugme');
    if (!d) return;
    d.disabled = evet;
    d.textContent = evet ? metin : (girisModu === 'kayit' ? 'Meclise Katıl' : 'Meclise Gir');
  }
  function girisYap() {
    var eposta = E.$('#g-eposta').value.trim(), sifre = E.$('#g-sifre').value;
    if (!eposta || !sifre) { girisCiz('E-posta ve şifreni yaz.'); return; }
    mesgul(true, 'Meclise giriliyor...');
    E.sb.auth.signInWithPassword({ email: eposta, password: sifre }).then(function (r) {
      if (r.error) throw r.error;
      // devamı oturum dinleyicisinde
    }).catch(function (h) {
      girisCiz(E.hataMetni(h));
      var g = E.$('#g-eposta'); if (g) g.value = eposta;
    });
  }
  function kayitOl() {
    var isim = E.$('#g-isim').value.trim(), kunye = E.$('#g-kunye').value.trim().toLowerCase();
    var eposta = E.$('#g-eposta').value.trim(), sifre = E.$('#g-sifre').value;
    function geri(m) {
      girisCiz(m);
      E.$('#g-isim').value = isim; E.$('#g-kunye').value = kunye; E.$('#g-eposta').value = eposta;
    }
    if (isim.length < 2) return geri('İsim soyisim en az 2 karakter olmalı.');
    if (!/^[a-z0-9_]{3,20}$/.test(kunye)) return geri('Künye 3-20 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi.');
    if (!/^\S+@\S+\.\S+$/.test(eposta)) return geri('Geçerli bir e-posta adresi yaz.');
    if (sifre.length < 6) return geri('Şifre en az 6 karakter olmalı.');
    mesgul(true, 'Künyen nakşediliyor...');
    E.rpc('kunye_musait', { p_kunye: kunye }).then(function (bos) {
      if (!bos) throw new Error('kunye_dolu');
      return E.sb.auth.signUp({ email: eposta, password: sifre, options: { data: { isim: isim, kunye: kunye } } });
    }).then(function (r) {
      if (r.error) throw r.error;
      var u = r.data && r.data.user;
      if (u && u.identities && u.identities.length === 0) throw new Error('already registered');
      if (!(r.data && r.data.session)) {
        // e-posta tasdiki açık: oturum henüz yok
        girisModu = 'giris';
        girisCiz('Künyen nakşedildi. ' + eposta + ' adresine bir tasdik bağlantısı gönderdik. Bağlantıya dokunduktan sonra buradan meclise gir.', 'bilgi');
        var g = E.$('#g-eposta'); if (g) g.value = eposta;
      }
      // oturum geldiyse devamı dinleyicide
    }).catch(function (h) { geri(E.hataMetni(h)); });
  }

  // ---------- Oturum ----------
  function iceriAl(oturum) {
    if (girenKimlik && oturum.user && girenKimlik === oturum.user.id) { E.oturum = oturum; return; }
    girenKimlik = oturum.user ? oturum.user.id : null;
    E.oturum = oturum;
    E.$('#acilis').hidden = false;
    E.$('#giris').hidden = true;
    profiliBekle(0);
  }
  function profiliBekle(deneme) {
    E.rpc('ben').then(function (b) {
      if (!b) {
        // profil tetikleyicisi birkaç yüz ms gecikebilir
        if (deneme < 4) return setTimeout(function () { profiliBekle(deneme + 1); }, 700);
        throw new Error('Künyen bulunamadı.');
      }
      E.ben = b;
      E.$('#acilis').hidden = true;
      E.ekran = 'sura';
      E.kabukCiz();
      E.git('sura');
      canliBaslat();
      if (E.tercih('biyometrik') === '1') kilitle();
    }).catch(function (h) {
      E.$('#acilis').hidden = true;
      if (/giris_gerekli|JWT|token|401/i.test(String(h && h.message))) { E.cikisYap(); return; }
      var a = E.$('#acilis');
      a.hidden = false;
      a.innerHTML = ikon('wifi-off') + '<span>' + esc(E.hataMetni(h)) + '</span><button class="tekrar" id="a-tekrar">Tekrar dene</button><button class="tekrar" id="a-cik" style="margin-top:0">Çıkış yap</button>';
      E.$('#a-tekrar').onclick = function () { a.innerHTML = ikon('star-crescent') + '<span>Meclise bağlanılıyor...</span>'; profiliBekle(0); };
      E.$('#a-cik').onclick = function () { E.cikisYap(); };
    });
  }
  function disariAl() {
    canliDurdur();
    E.oturum = null; E.ben = null; girenKimlik = null;
    E.veri.sura = null; E.veri.sohbetler = null; E.veri.suffe = null;
    E.tumKatmanlariKapat(); E.tumSayfalariKapat(); E.cekmeceKapat();
    var k = E.$('#kabuk'); k.hidden = true; k.innerHTML = '';
    var kl = E.$('.muhurlu'); if (kl) kl.parentNode.removeChild(kl);
    var a = E.$('#acilis'); a.hidden = true; a.innerHTML = ikon('star-crescent') + '<span>Meclise bağlanılıyor...</span>';
    girisModu = 'giris';
    girisCiz();
  }
  E.cikisYap = function () {
    return E.sb.auth.signOut().catch(function () { /* yine de yerelde kapat */ }).then(function () { if (E.oturum || !E.$('#g-dugme')) disariAl(); });
  };

  // ---------- Canlı bağlantı + nabız ----------
  function bildir(metin) {
    if (E.tercih('bildirim') === '0') return;
    E.tost(metin, 'iyi');
    try { if (window.Android && Android.titret) Android.titret(30); } catch (e) { /* köprü yok */ }
  }
  function canliBaslat() {
    canliDurdur();
    var kimlik = E.ben.id;
    try {
      kanal = E.sb.channel('yoldas-' + kimlik)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: 'alici=eq.' + kimlik }, function () {
          var ust = E.yigin[E.yigin.length - 1];
          if (ust && ust.ad === 'sohbet' && ust.yenile) ust.yenile();
          else bildir('Yeni bir mesajın var yoldaş.');
          E.beniYenile();
          if (E.ekran === 'mesajlar') E.sohbetleriYukle();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirimler', filter: 'alici=eq.' + kimlik }, function () {
          E.beniYenile();
        })
        .subscribe();
    } catch (e) { kanal = null; }
    // canlı bağlantı kopsa bile sayaçlar güncel kalsın
    nabiz = setInterval(function () {
      if (document.hidden || !E.oturum) return;
      var onceki = E.ben ? E.ben.okunmamis_mesaj : 0;
      E.beniYenile().then(function () {
        if (E.ben && E.ben.okunmamis_mesaj > onceki && E.ekran === 'mesajlar' && !E.yigin.length) E.sohbetleriYukle();
      });
    }, 30000);
  }
  function canliDurdur() {
    clearInterval(nabiz); nabiz = null;
    if (kanal) { try { E.sb.removeChannel(kanal); } catch (e) { /* kapalı */ } kanal = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && E.oturum && E.ben) {
      E.beniYenile();
      var ust = E.yigin[E.yigin.length - 1];
      if (ust && ust.ad === 'sohbet' && ust.yenile) ust.yenile();
    }
  });

  // ---------- Biyometrik mühür ----------
  var biyoGeri = null;
  window.E_biyometrikSonuc = function (tamam) {
    var f = biyoGeri; biyoGeri = null;
    if (f) f(!!tamam);
  };
  E.biyometrikSor = function (geri) {
    biyoGeri = geri;
    try {
      if (window.Android && Android.biyometrikSor) { Android.biyometrikSor(); return; }
    } catch (e) { /* köprü yok */ }
    biyoGeri = null; geri(false);
  };
  function kilitle() {
    if (E.$('.muhurlu')) return;
    var durum = 'yok';
    try { if (window.Android && Android.biyometrikDurum) durum = Android.biyometrikDurum(); } catch (e) { /* köprü yok */ }
    if (durum !== 'var') return; // donanım yoksa kullanıcıyı dışarıda bırakma
    var el = document.createElement('div');
    el.className = 'muhurlu';
    el.innerHTML = ikon('fingerprint') + '<h3>ERKAM: Kimliğini Tasdik Et</h3><p>Meclise girmek için biyometrik mührünü bas.</p>' +
      '<button id="m-ac">Mührü Bas</button><button class="ince" id="m-cik">Şifre Kullan (çıkış yap)</button>';
    E.$('#uyg').appendChild(el);
    function dene() {
      E.biyometrikSor(function (tamam) { if (tamam && el.parentNode) el.parentNode.removeChild(el); });
    }
    E.$('#m-ac', el).onclick = dene;
    E.$('#m-cik', el).onclick = function () { E.cikisYap(); };
    setTimeout(dene, 250);
  }

  // ---------- Başlat ----------
  function baslat() {
    E.temaUygula();
    E.$('#acilis').innerHTML = ikon('star-crescent') + '<span>Meclise bağlanılıyor...</span>';
    if (!window.supabase || !window.supabase.createClient) {
      E.$('#acilis').innerHTML = ikon('alert-circle-outline') + '<span>Uygulama dosyaları eksik yüklendi. Uygulamayı yeniden kur.</span>';
      return;
    }
    if (!window.ERKAM_AYAR || /^__/.test(window.ERKAM_AYAR.anahtar || '')) {
      E.$('#acilis').innerHTML = ikon('wifi-off') + '<span>Sunucu anahtarı henüz eklenmedi. Bu sürüm meclise bağlanamaz.</span>';
      return;
    }
    E.baglan();
    E.sb.auth.onAuthStateChange(function (olay, oturum) {
      // dinleyici içinde doğrudan sunucu çağrısı yapma: bir sonraki tura bırak
      setTimeout(function () {
        if (olay === 'SIGNED_OUT' || !oturum) { if (E.oturum || E.$('#acilis') && !E.$('#acilis').hidden && !E.$('#g-dugme')) disariAl(); return; }
        if (olay === 'TOKEN_REFRESHED' || olay === 'USER_UPDATED') { E.oturum = oturum; return; }
        iceriAl(oturum);
      }, 0);
    });
    E.sb.auth.getSession().then(function (r) {
      var o = r && r.data && r.data.session;
      if (o) iceriAl(o);
      else { E.$('#acilis').hidden = true; girisCiz(); }
    }).catch(function () { E.$('#acilis').hidden = true; girisCiz(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
})();
