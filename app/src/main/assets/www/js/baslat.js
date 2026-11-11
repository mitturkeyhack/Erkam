// ERKAM — açılış: oturum, giriş/kayıt, canlı bağlantı, biyometrik mühür
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;
  var kanal = null, nabiz = null, girisModu = 'giris', girenKimlik = null;

  // ---------- Giriş / Kayıt / Kod / Şifre sıfırlama ----------
  var KOD_BOY = 6, kodBilgi = null, sifreYenile = false, sayacZ = null;

  function sifreAlani(id, ph, oto) {
    return '<label class="sifre-kap"><input class="alan" id="' + id + '" type="password" placeholder="' + ph + '" autocomplete="' + oto + '">' +
      '<button type="button" class="goz" data-goz="' + id + '" aria-label="Şifreyi göster">' + ikon('eye-outline') + '</button></label>';
  }
  function gozBagla(g) {
    [].forEach.call(g.querySelectorAll('[data-goz]'), function (b) {
      b.onclick = function () {
        var i = E.$('#' + b.getAttribute('data-goz')), ac = i.type === 'password';
        i.type = ac ? 'text' : 'password';
        b.innerHTML = ikon(ac ? 'eye-off-outline' : 'eye-outline');
      };
    });
  }
  function ust(mesaj, tur) {
    return (mesaj ? '<div class="' + (tur || 'hata') + '">' + esc(mesaj) + '</div>' : '');
  }

  function girisCiz(mesaj, tur) {
    if (girisModu === 'kod') return kodCiz(mesaj, tur);
    if (girisModu === 'unuttum') return unuttumCiz(mesaj, tur);
    if (girisModu === 'yeniSifre') return yeniSifreCiz(mesaj, tur);
    var g = E.$('#giris');
    var kayit = girisModu === 'kayit';
    g.innerHTML = '<div class="logo">' + ikon('star-crescent') + '</div><h1>ERKAM</h1>' + ust(mesaj, tur) +
      (kayit ? '<input class="alan" id="g-isim" placeholder="İsim Soyisim" maxlength="40" autocomplete="name">' +
        '<input class="alan" id="g-kunye" placeholder="Künye (kullanıcı adı)" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false">' +
        '<div class="not" id="g-kunye-not">Küçük harf, rakam ve alt çizgi; 3-20 karakter.</div>' : '') +
      '<input class="alan" id="g-eposta" type="email" placeholder="E-posta" autocapitalize="none" autocomplete="email" spellcheck="false">' +
      sifreAlani('g-sifre', 'Şifre', kayit ? 'new-password' : 'current-password') +
      (kayit ? '<div class="guc"><i></i><span>En az 8 karakter; harf ve rakam karıştır.</span></div>'
        : '<button class="unuttum" id="g-unuttum">Şifreni mi unuttun?</button>') +
      '<button class="dugme" id="g-dugme">' + (kayit ? 'Meclise Katıl' : 'Meclise Gir') + '</button>' +
      '<button class="gecis" id="g-gecis">' + (kayit ? 'Zaten yoldaş mısın? <b>Meclise Gir</b>' : 'Henüz yoldaş değil misin? <b>Meclise Katıl</b>') + '</button>';
    g.hidden = false;
    gozBagla(g);
    E.$('#g-gecis').onclick = function () { girisModu = kayit ? 'giris' : 'kayit'; girisCiz(); };
    E.$('#g-dugme').onclick = kayit ? kayitOl : girisYap;
    E.$('#g-sifre').onkeydown = function (o) { if (o.key === 'Enter') E.$('#g-dugme').click(); };
    if (!kayit) E.$('#g-unuttum').onclick = function () {
      var e = E.$('#g-eposta').value.trim();
      girisModu = 'unuttum'; girisCiz(); if (e) E.$('#g-eposta').value = e;
    };
    if (kayit) {
      E.$('#g-sifre').oninput = function () { gucCiz(E.$('#g-sifre').value, E.$('.guc', g)); };
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

  // şifre gücü çubuğu
  function gucPuan(s) {
    var p = 0;
    if (s.length >= 8) p++;
    if (s.length >= 12) p++;
    if (/[a-zçğıöşü]/.test(s) && /[A-ZÇĞİÖŞÜ]/.test(s)) p++;
    if (/\d/.test(s)) p++;
    if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(s)) p++;
    return s.length < 6 ? 0 : Math.max(1, Math.min(4, p));
  }
  function gucCiz(s, el) {
    if (!el) return;
    var p = gucPuan(s), ad = ['', 'Zayıf', 'İdare eder', 'Güçlü', 'Çok güçlü'];
    el.className = 'guc g' + p;
    E.$('span', el).textContent = s ? (p ? 'Şifre gücü: ' + ad[p] : 'En az 6 karakter olmalı.') : 'En az 8 karakter; harf ve rakam karıştır.';
  }

  function mesgul(evet, metin) {
    var d = E.$('#g-dugme');
    if (!d) return;
    if (!d._ilk) d._ilk = d.textContent;
    d.disabled = evet;
    d.textContent = evet ? metin : d._ilk;
  }
  function girisYap() {
    var eposta = E.$('#g-eposta').value.trim(), sifre = E.$('#g-sifre').value;
    if (!eposta || !sifre) { girisCiz('E-posta ve şifreni yaz.'); return; }
    mesgul(true, 'Meclise giriliyor...');
    E.sb.auth.signInWithPassword({ email: eposta, password: sifre }).then(function (r) {
      if (r.error) throw r.error;
      // devamı oturum dinleyicisinde
    }).catch(function (h) {
      if (/Email not confirmed/i.test(String(h && h.message))) {
        // tasdik edilmemiş: yeni kod gönder ve kod ekranına geç
        kodBilgi = { eposta: eposta, tur: 'signup' };
        girisModu = 'kod';
        return E.sb.auth.resend({ type: 'signup', email: eposta }).then(function (r) {
          girisCiz(r.error ? E.hataMetni(r.error) : 'E-postan henüz tasdik edilmemiş. Yeni bir kod gönderdik.', r.error ? 'hata' : 'bilgi');
          if (!r.error) sayacBaslat();
        });
      }
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
        kodBilgi = { eposta: eposta, tur: 'signup' };
        girisModu = 'kod';
        girisCiz();
        sayacBaslat();
      }
      // oturum geldiyse devamı dinleyicide
    }).catch(function (h) { geri(E.hataMetni(h)); });
  }

  // ---- kod ekranı ----
  function sayacBaslat() {
    if (kodBilgi) kodBilgi.bitis = Date.now() + 60000;
    clearInterval(sayacZ);
    sayacZ = setInterval(sayacCiz, 1000);
    sayacCiz();
  }
  function sayacCiz() {
    var b = E.$('#k-tekrar');
    if (!b || !kodBilgi) { clearInterval(sayacZ); return; }
    var kalan = Math.max(0, Math.ceil(((kodBilgi.bitis || 0) - Date.now()) / 1000));
    b.disabled = kalan > 0;
    b.innerHTML = kalan > 0 ? 'Yeni kodu <b>' + kalan + ' sn</b> sonra isteyebilirsin' : 'Kod gelmedi mi? <b>Yeniden gönder</b>';
    if (!kalan) clearInterval(sayacZ);
  }
  function kodCiz(mesaj, tur) {
    var g = E.$('#giris'), kayit = kodBilgi.tur === 'signup';
    var kutular = '';
    for (var i = 0; i < KOD_BOY; i++) kutular += '<span></span>';
    g.innerHTML = '<div class="kod-simge">' + ikon(kayit ? 'email-check-outline' : 'lock-reset') + '</div>' +
      '<h2>' + (kayit ? 'E-postanı tasdik et' : 'Şifreni sıfırla') + '</h2>' +
      '<p class="kod-acik"><b>' + esc(kodBilgi.eposta) + '</b> adresine ' + KOD_BOY + ' haneli bir kod gönderdik. Gelen kutunu ve gereksiz klasörünü kontrol et.</p>' +
      ust(mesaj, tur) +
      '<label class="kod-kap"><input id="k-kod" inputmode="numeric" autocomplete="one-time-code" maxlength="' + KOD_BOY + '" aria-label="Kod">' +
      '<div class="kod-kutu">' + kutular + '</div></label>' +
      '<button class="dugme" id="g-dugme" disabled>' + (kayit ? 'Tasdik Et ve Meclise Gir' : 'Devam Et') + '</button>' +
      '<button class="gecis" id="k-tekrar"></button>' +
      '<button class="gecis ince" id="k-geri">' + ikon('arrow-left') + (kayit ? 'Farklı bir e-posta kullan' : 'Girişe dön') + '</button>';
    g.hidden = false;
    var inp = E.$('#k-kod'), kutu = E.$('.kod-kutu', g), dgm = E.$('#g-dugme');
    function ciz() {
      var v = inp.value;
      [].forEach.call(kutu.children, function (k, i) {
        k.textContent = v[i] || '';
        k.className = (i === v.length && document.activeElement === inp ? 'imlec' : '') + (v[i] ? ' dolu' : '');
      });
      dgm.disabled = v.length !== KOD_BOY;
    }
    inp.oninput = function () {
      var v = inp.value.replace(/\D/g, '').slice(0, KOD_BOY);
      if (v !== inp.value) inp.value = v;
      ciz();
      if (v.length === KOD_BOY) dogrula();
    };
    inp.onfocus = inp.onblur = ciz;
    dgm.onclick = dogrula;
    E.$('#k-tekrar').onclick = tekrarGonder;
    E.$('#k-geri').onclick = function () {
      clearInterval(sayacZ);
      var e = kodBilgi.eposta;
      girisModu = kayit ? 'kayit' : 'giris'; kodBilgi = null; girisCiz();
      var x = E.$('#g-eposta'); if (x) x.value = e;
    };
    sayacCiz(); ciz();
    setTimeout(function () { inp.focus(); }, 200);
  }
  function dogrula() {
    var inp = E.$('#k-kod'), kod = inp ? inp.value : '';
    if (!kodBilgi || kod.length !== KOD_BOY) return;
    var kayit = kodBilgi.tur === 'signup';
    mesgul(true, 'Kod tasdik ediliyor...');
    inp.disabled = true;
    if (!kayit) sifreYenile = true;
    E.sb.auth.verifyOtp({ email: kodBilgi.eposta, token: kod, type: kayit ? 'signup' : 'recovery' }).then(function (r) {
      if (r.error) throw r.error;
      if (kayit) { clearInterval(sayacZ); kodBilgi = null; }   // oturum geldi: dinleyici meclise alır
      else { girisModu = 'yeniSifre'; girisCiz(); }
    }).catch(function (h) {
      sifreYenile = false;
      girisCiz(E.hataMetni(h));
      var k = E.$('.kod-kutu'); if (k) { k.classList.add('salla'); setTimeout(function () { k.classList.remove('salla'); }, 500); }
    });
  }
  function tekrarGonder() {
    if (!kodBilgi) return;
    var b = E.$('#k-tekrar'); if (b) b.disabled = true;
    var is = kodBilgi.tur === 'signup'
      ? E.sb.auth.resend({ type: 'signup', email: kodBilgi.eposta })
      : E.sb.auth.resetPasswordForEmail(kodBilgi.eposta);
    is.then(function (r) {
      if (r && r.error) throw r.error;
      girisCiz('Yeni kod gönderildi.', 'bilgi');
      sayacBaslat();
    }).catch(function (h) { girisCiz(E.hataMetni(h)); });
  }

  // ---- şifremi unuttum ----
  function unuttumCiz(mesaj, tur) {
    var g = E.$('#giris');
    g.innerHTML = '<div class="kod-simge">' + ikon('lock-question') + '</div><h2>Şifreni mi unuttun?</h2>' +
      '<p class="kod-acik">Kayıtlı e-posta adresini yaz, sana şifreni sıfırlaman için bir kod gönderelim.</p>' + ust(mesaj, tur) +
      '<input class="alan" id="g-eposta" type="email" placeholder="E-posta" autocapitalize="none" autocomplete="email" spellcheck="false">' +
      '<button class="dugme" id="g-dugme">Kod Gönder</button>' +
      '<button class="gecis ince" id="k-geri">' + ikon('arrow-left') + 'Girişe dön</button>';
    g.hidden = false;
    E.$('#k-geri').onclick = function () { var e = E.$('#g-eposta').value; girisModu = 'giris'; girisCiz(); E.$('#g-eposta').value = e; };
    E.$('#g-eposta').onkeydown = function (o) { if (o.key === 'Enter') E.$('#g-dugme').click(); };
    E.$('#g-dugme').onclick = function () {
      var eposta = E.$('#g-eposta').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(eposta)) { unuttumCiz('Geçerli bir e-posta adresi yaz.'); E.$('#g-eposta').value = eposta; return; }
      mesgul(true, 'Kod gönderiliyor...');
      E.sb.auth.resetPasswordForEmail(eposta).then(function (r) {
        if (r.error) throw r.error;
        kodBilgi = { eposta: eposta, tur: 'recovery' };
        girisModu = 'kod'; girisCiz(); sayacBaslat();
      }).catch(function (h) { unuttumCiz(E.hataMetni(h)); E.$('#g-eposta').value = eposta; });
    };
    setTimeout(function () { var e = E.$('#g-eposta'); if (e && !e.value) e.focus(); }, 200);
  }

  // ---- yeni şifre ----
  function yeniSifreCiz(mesaj, tur) {
    var g = E.$('#giris');
    g.innerHTML = '<div class="kod-simge">' + ikon('shield-key-outline') + '</div><h2>Yeni şifreni belirle</h2>' +
      '<p class="kod-acik">Kimliğin tasdik edildi. Artık yeni bir şifre seçebilirsin.</p>' + ust(mesaj, tur) +
      sifreAlani('y-sifre', 'Yeni şifre', 'new-password') +
      '<div class="guc"><i></i><span>En az 8 karakter; harf ve rakam karıştır.</span></div>' +
      sifreAlani('y-sifre2', 'Yeni şifre (tekrar)', 'new-password') +
      '<button class="dugme" id="g-dugme">Şifreyi Kaydet ve Gir</button>';
    g.hidden = false;
    gozBagla(g);
    E.$('#y-sifre').oninput = function () { gucCiz(E.$('#y-sifre').value, E.$('.guc', g)); };
    E.$('#g-dugme').onclick = function () {
      var s1 = E.$('#y-sifre').value, s2 = E.$('#y-sifre2').value;
      if (s1.length < 6) return yeniSifreCiz('Şifre en az 6 karakter olmalı.');
      if (s1 !== s2) return yeniSifreCiz('İki şifre birbirini tutmuyor.');
      mesgul(true, 'Şifre mühürleniyor...');
      E.sb.auth.updateUser({ password: s1 }).then(function (r) {
        if (r.error) throw r.error;
        sifreYenile = false; kodBilgi = null; girisModu = 'giris';
        return E.sb.auth.getSession().then(function (x) {
          var o = x && x.data && x.data.session;
          if (o) { E.tost('Şifren yenilendi. Meclise hoş geldin.', 'iyi'); iceriAl(o); }
          else girisCiz('Şifren yenilendi. Yeni şifrenle meclise gir.', 'bilgi');
        });
      }).catch(function (h) { yeniSifreCiz(E.hataMetni(h)); });
    };
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
      E.bildirimKur();
      setTimeout(window.E_bildirimAc, 300);
      setTimeout(function () { if (E.guncellemeDenetle) E.guncellemeDenetle(false); }, 2500);
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
    var once = E._fcm ? E.rpc('cihaz_sil', { p_token: E._fcm }).catch(function () {}) : Promise.resolve();
    E._fcm = null;
    try { if (window.Android && Android.bildirimDurdur) Android.bildirimDurdur(); } catch (e) { /* yok */ }
    return once.then(function () { return E.sb.auth.signOut(); }).catch(function () { /* yine de yerelde kapat */ }).then(function () { if (E.oturum || !E.$('#g-dugme')) disariAl(); });
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
        if (sifreYenile || olay === 'PASSWORD_RECOVERY') { E.oturum = oturum; return; }   // önce yeni şifre seçilsin
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

// ---------- Anlık bildirim (Firebase) ----------
(function () {
  var E = window.E;
  E.bildirimAcik = function () { return E.tercih('bildirim') !== '0'; };
  E.bildirimKur = function () {
    if (!window.Android || !Android.bildirimBaslat || !E.bildirimAcik() || !E.ben) return;
    E.rpc('firebase_ayar').then(function (a) {
      if (a && a.apiKey) Android.bildirimBaslat(JSON.stringify(a));
    }, function () { /* sunucu ayarı yok */ });
  };
  window.E_bildirimToken = function (t) {
    if (!t || !E.ben || !E.bildirimAcik()) return;
    E._fcm = t;
    E.rpc('cihaz_kaydet', { p_token: t }).catch(function () {});
  };
  // bildirime dokununca ilgili yere git
  window.E_bildirimAc = function () {
    if (!window.Android || !Android.bekleyenHedef || !E.ben) return;
    var h = Android.bekleyenHedef();
    if (!h) return;
    var i = h.indexOf(':'), tur = h.slice(0, i), d = h.slice(i + 1);
    if (!d || d === 'null') return;
    if (tur === 'kelam') E.kelamSayfa(d);
    else if (tur === 'profil') E.yoldasSayfa(d);
    else if (tur === 'sohbet') {
      E.rpc('profil_getir', { p_kunye: d }).then(function (p) {
        if (p) E.sohbetSayfa(p.profil || p);
      }).catch(function () { E.yoldasSayfa(d); });
    }
  };
})();
