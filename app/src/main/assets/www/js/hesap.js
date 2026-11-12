// ERKAM — Hesap güvenliği: e-posta değiştirme, oturum açık cihazlar
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  // ---------- cihaz bilgisi ----------
  var SAMSUNG = { A356: 'Galaxy A35', A556: 'Galaxy A55', A546: 'Galaxy A54', A536: 'Galaxy A53', A346: 'Galaxy A34', A256: 'Galaxy A25',
    A245: 'Galaxy A24', A155: 'Galaxy A15', A156: 'Galaxy A15 5G', A145: 'Galaxy A14', A057: 'Galaxy A05s', A166: 'Galaxy A16', A165: 'Galaxy A16',
    A266: 'Galaxy A26', A366: 'Galaxy A36', A566: 'Galaxy A56', S911: 'Galaxy S23', S916: 'Galaxy S23+', S918: 'Galaxy S23 Ultra',
    S921: 'Galaxy S24', S926: 'Galaxy S24+', S928: 'Galaxy S24 Ultra', S931: 'Galaxy S25', S936: 'Galaxy S25+', S938: 'Galaxy S25 Ultra',
    S711: 'Galaxy S23 FE', S721: 'Galaxy S24 FE', F946: 'Galaxy Z Fold5', F956: 'Galaxy Z Fold6', F731: 'Galaxy Z Flip5', F741: 'Galaxy Z Flip6',
    M346: 'Galaxy M34', M156: 'Galaxy M15', X110: 'Galaxy Tab A9', X210: 'Galaxy Tab A9+' };
  function modelAdi(marka, model) {
    model = String(model || '');
    var s = model.match(/^SM-([A-Z]\d{3})/i);
    if (s && SAMSUNG[s[1].toUpperCase()]) return 'Samsung ' + SAMSUNG[s[1].toUpperCase()];
    marka = String(marka || '');
    if (marka && model.toLowerCase().indexOf(marka.toLowerCase()) === 0) return model;
    return ((marka ? marka.charAt(0).toUpperCase() + marka.slice(1) + ' ' : '') + model).trim();
  }
  function uaCoz(ua) {
    ua = String(ua || '');
    var a = ua.match(/Android ([\d.]+)/), m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
    return { android: a ? a[1] : '', model: m ? m[1].trim() : '', webview: /; wv\)/.test(ua) };
  }
  function buCihaz() {
    var b = {};
    try { if (window.Android && Android.cihazBilgi) b = JSON.parse(Android.cihazBilgi() || '{}'); } catch (e) { b = {}; }
    if (!b.model) { var u = uaCoz(navigator.userAgent); b.model = u.model; b.android = u.android; }
    var s = '';
    try { s = (window.Android && Android.surum) ? Android.surum() : ''; } catch (e) { s = ''; }
    b.surum = s;
    return b;
  }
  // giriş sonrası bir kez: bu oturumun hangi telefonda açık olduğunu kaydet
  E.oturumKaydet = function () {
    var b = buCihaz();
    E.rpc('oturum_kaydet', { p_marka: b.marka || '', p_model: b.model || '', p_ad: b.ad || '', p_android: b.android || '', p_surum: b.surum || '' }).catch(function () {});
  };
  function cihazGorunum(o) {
    var u = uaCoz(o.ua), model = o.model || u.model;
    var ad = modelAdi(o.marka, model) || (o.ua && /Windows/.test(o.ua) ? 'Windows bilgisayar' : 'Bilinmeyen cihaz');
    var takma = o.ad && o.ad !== model && ad.indexOf(o.ad) === -1 ? o.ad : '';
    var tablet = /Tab|tablet|SM-X|SM-T/i.test(model + ' ' + ad);
    var android = o.android || u.android;
    var alt = [android ? 'Android ' + android : '', o.surum ? 'ERKAM v' + o.surum : (u.webview || /ERKAM/.test(o.ua || '') ? 'ERKAM uygulaması' : '')].filter(Boolean).join(' · ');
    return { ad: ad, takma: takma, alt: alt, ikon: tablet ? 'tablet' : 'cellphone' };
  }
  function ipGizle(ip) {
    if (!ip) return '';
    var p = String(ip).split('.');
    return p.length === 4 ? p[0] + '.' + p[1] + '.•••.•••' : String(ip).split(':').slice(0, 2).join(':') + ':••••';
  }
  function tarih(t) {
    var d = new Date(t);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + E.saat(t);
  }

  // ---------- Oturum açık cihazlar ----------
  E.is['cihazlar-ac'] = function () {
    E.sayfaAc({
      ad: 'cihazlar',
      html: E.sayfaBasligi('<div class="ad">Oturum Açık Cihazlar</div>') + '<div class="ic oc"><div class="yukleniyor"><div class="cark"></div></div></div>',
      kur: function (el) { yukle(el); }
    });
  };
  function yukle(el) {
    var ic = E.$('.oc', el);
    E.rpc('oturumlarim').then(function (l) {
      var bu = l.filter(function (o) { return o.bu; })[0], digerleri = l.filter(function (o) { return !o.bu; });
      function kart(o) {
        var g = cihazGorunum(o);
        return '<div class="oc-kart' + (o.bu ? ' bu' : '') + '" data-id="' + esc(o.id) + '">' +
          '<div class="oc-ust"><span class="oc-ik">' + ikon(g.ikon) + '</span><div class="oc-ad"><b>' + esc(g.ad) + '</b>' +
            (g.takma ? '<small>“' + esc(g.takma) + '”</small>' : '') + (g.alt ? '<span>' + esc(g.alt) + '</span>' : '') + '</div>' +
            (o.bu ? '<em class="oc-bu">' + ikon('check-circle') + 'Bu cihaz</em>' : '') + '</div>' +
          '<div class="oc-bilgi">' +
            '<div>' + ikon('clock-outline') + '<span>Son etkinlik</span><b>' + (o.bu ? 'Şu an' : esc(E.once(o.son || o.acilis))) + '</b></div>' +
            '<div>' + ikon('login') + '<span>Giriş</span><b>' + esc(tarih(o.acilis)) + '</b></div>' +
            (o.ip ? '<div>' + ikon('earth') + '<span>IP adresi</span><b>' + esc(ipGizle(o.ip)) + '</b></div>' : '') +
          '</div>' +
          (o.bu ? '' : '<button class="oc-kapat" data-k="kapat">' + ikon('logout') + 'Bu cihazda oturumu kapat</button>') + '</div>';
      }
      ic.innerHTML =
        '<div class="oc-kahraman">' + ikon('shield-account') + '<div><b>' + l.length + ' cihazda oturum açık</b><span>Tanımadığın bir cihaz görürsen oturumunu kapat ve şifreni değiştir.</span></div></div>' +
        (bu ? '<div class="bolum">BU CİHAZ</div>' + kart(bu) : '') +
        (digerleri.length ? '<div class="bolum">DİĞER CİHAZLAR</div>' + digerleri.map(kart).join('') +
          '<button class="oc-hepsi" data-k="hepsi">' + ikon('logout-variant') + 'Diğer tüm cihazlardan çıkış yap</button>' :
          '<div class="oc-tek">' + ikon('check-decagram-outline') + 'Hesabın yalnızca bu cihazda açık.</div>') +
        '<p class="oc-not">Oturumu kapatılan cihaz en geç bir saat içinde meclisten çıkar ve oraya bildirim gitmez.</p>';
      ic.onclick = function (ev) {
        var b = ev.target.closest('[data-k]'); if (!b) return;
        if (b.getAttribute('data-k') === 'hepsi') {
          E.sor('Diğer cihazlardan çık', 'Bu telefon hariç tüm cihazlarda ERKAM oturumun kapatılacak.', 'Çıkış Yap', true).then(function (e) {
            if (!e) return;
            E.rpc('diger_oturumlari_kapat').then(function (n) { E.tost(n + ' cihazda oturum kapatıldı.', 'iyi'); yukle(el); }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
          });
          return;
        }
        var kartEl = b.closest('.oc-kart'), id = kartEl.getAttribute('data-id'), ad = E.$('.oc-ad b', kartEl).textContent;
        E.sor('Oturumu kapat', ad + ' cihazındaki ERKAM oturumu kapatılacak.', 'Oturumu Kapat', true).then(function (e) {
          if (!e) return;
          E.rpc('oturum_kapat', { p_id: id }).then(function () { E.tost(ad + ' cihazında oturum kapatıldı.', 'iyi'); yukle(el); }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
        });
      };
    }).catch(function (h) { ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
  }

  // ---------- E-posta değiştirme ----------
  function kodAlani(id) {
    var k = ''; for (var i = 0; i < 6; i++) k += '<span></span>';
    return '<label class="ep-kod"><input id="' + id + '" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Kod"><div class="ep-kutu">' + k + '</div></label>';
  }
  function kodBagla(el, id, bitti) {
    var inp = E.$('#' + id, el), kutu = E.$('.ep-kutu', inp.parentNode);
    function ciz() {
      var v = inp.value;
      [].forEach.call(kutu.children, function (s, i) { s.textContent = v[i] || ''; s.className = i === v.length ? 'on' : (v[i] ? 'dolu' : ''); });
    }
    inp.oninput = function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); ciz(); if (inp.value.length === 6) bitti(inp.value); };
    ciz(); setTimeout(function () { inp.focus(); }, 250);
    return inp;
  }
  E.is['eposta-degistir'] = function () {
    var eski = (E.oturum && E.oturum.user && E.oturum.user.email) || '';
    var yeni = '';
    E.sayfaAc({
      ad: 'eposta',
      html: E.sayfaBasligi('<div class="ad">E-posta Adresi</div>') + '<div class="ic ep"></div>',
      kur: function (el) { adim1(E.$('.ep', el)); }
    });
    function adim1(ic) {
      ic.innerHTML = '<div class="ep-simdi">' + ikon('email-outline') + '<div><small>Şu anki e-posta adresin</small><b>' + esc(eski) + '</b></div></div>' +
        '<label class="emn-et">Yeni e-posta adresi</label><input class="girdi ep-girdi" id="ep-yeni" type="email" inputmode="email" autocomplete="email" placeholder="ornek@gmail.com">' +
        '<p class="ep-not">' + ikon('shield-check-outline') + '<span>Güvenliğin için yeni adresine bir kod göndereceğiz. Değişiklik, kodu girdiğinde tamamlanır.</span></p>' +
        '<button class="dolu genis" id="ep-gonder" disabled>Kod Gönder</button>';
      var inp = E.$('#ep-yeni', ic), g = E.$('#ep-gonder', ic);
      inp.oninput = function () { var v = inp.value.trim().toLowerCase(); g.disabled = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v === eski.toLowerCase(); };
      g.onclick = function () {
        yeni = inp.value.trim().toLowerCase();
        g.disabled = true; g.innerHTML = '<span class="cark kucuk"></span>';
        E.sb.auth.updateUser({ email: yeni }).then(function (r) {
          if (r.error) throw r.error;
          adim2(ic, 'yeni');
        }).catch(function (h) { g.disabled = false; g.textContent = 'Kod Gönder'; E.tost(E.hataMetni(h), 'kotu'); });
      };
    }
    // hangi: 'yeni' → yeni adrese gelen kod, 'eski' → güvenli değişimde şu anki adrese gelen kod
    function adim2(ic, hangi) {
      var adres = hangi === 'yeni' ? yeni : eski;
      ic.innerHTML = '<div class="ep-zarf">' + ikon('email-check-outline') + '</div>' +
        '<h3 class="ep-bas">' + (hangi === 'yeni' ? 'Yeni adresine gelen kodu gir' : 'Şimdi şu anki adresine gelen kodu gir') + '</h3>' +
        '<p class="ep-acik"><b>' + esc(adres) + '</b> adresine 6 haneli bir kod gönderdik. Gelen kutunu ve gereksiz klasörünü kontrol et.</p>' +
        (hangi === 'eski' ? '<div class="ep-adim">' + ikon('check-circle') + 'Yeni adres doğrulandı · 2. adım: eski adres onayı</div>' : '') +
        kodAlani('ep-kod') + '<button class="dolu genis" id="ep-dogrula" disabled>Doğrula</button>' +
        '<button class="ep-geri" id="ep-geri">' + (hangi === 'yeni' ? 'Adresi değiştir' : 'Vazgeç') + '</button>';
      var d = E.$('#ep-dogrula', ic);
      var inp = kodBagla(ic, 'ep-kod', function () { dogrula(); });
      inp.addEventListener('input', function () { d.disabled = inp.value.length !== 6; });
      d.onclick = dogrula;
      E.$('#ep-geri', ic).onclick = function () { if (hangi === 'yeni') adim1(ic); else E.sayfaKapat(); };
      function dogrula() {
        if (inp.value.length !== 6 || d.dataset.m) return;
        d.dataset.m = '1'; d.disabled = true; d.innerHTML = '<span class="cark kucuk"></span>';
        E.sb.auth.verifyOtp({ email: adres, token: inp.value, type: 'email_change' }).then(function (r) {
          if (r.error) throw r.error;
          return E.sb.auth.getUser();
        }).then(function (r) {
          var u = r && r.data && r.data.user;
          if (u && String(u.email).toLowerCase() === yeni) { if (E.oturum) E.oturum.user = u; tamam(ic); }
          else if (hangi === 'yeni') adim2(ic, 'eski');
          else tamam(ic);
        }).catch(function (h) {
          delete d.dataset.m; d.textContent = 'Doğrula'; inp.value = ''; inp.dispatchEvent(new Event('input'));
          var m = String(h && h.message || '');
          E.tost(/expired|invalid|token/i.test(m) ? 'Kod hatalı ya da süresi dolmuş.' : E.hataMetni(h), 'kotu');
        });
      }
    }
    function tamam(ic) {
      ic.innerHTML = '<div class="ep-tamam"><div class="emn-muhur">' + E.rozet() + '</div><h3>E-posta adresin değişti</h3>' +
        '<p>Artık <b>' + esc(yeni) + '</b> ile giriş yapacaksın.</p><button class="dolu genis" data-is="sayfa-kapat">Tamam</button></div>';
    }
  };
  E.is['sayfa-kapat'] = function () { E.sayfaKapat(); };
})();
