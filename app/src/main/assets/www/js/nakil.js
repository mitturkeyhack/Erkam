// ERKAM — Nakil (yeniden paylaşma), İktibas (alıntı), Tadil (düzenleme), Görülme, Seçkin, Uzlet
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  // 1234 → "1,2B", 1500000 → "1,5Mn"
  E.sayiKisa = function (n) {
    n = +n || 0;
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace('.', ',').replace(',0', '') + 'B';
    return (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + 'Mn';
  };

  // ---------- İktibas kartı (alıntılanan kelam) ----------
  E.iktibasHtml = function (q) {
    if (!q || q.silindi) return '<div class="iktibas silik">' + ikon('format-quote-open') + 'Bu kelam artık mecliste yok.</div>';
    var y = q.yazar || {}, m = (q.medya || [])[0], gorsel = '';
    if (m) {
      var yol = m.tur === 'video' ? m.kapak : m.yol;
      if (yol) gorsel = '<span class="ik-g' + (m.tur === 'video' ? ' v' : '') + '"><img src="' + esc(E.gorselUrl(yol)) + '" alt="" loading="lazy">' + (m.tur === 'video' ? ikon('play') : '') + '</span>';
    }
    return '<button class="iktibas" data-is="kelam-ac" data-id="' + esc(q.id) + '">' +
      '<span class="ik-bas">' + E.avatar(y) + '<b>' + esc(y.isim || 'Yoldaş') + '</b>' + E.rozetVar(y) + '<small>@' + esc(y.kunye || '') + ' · ' + esc(E.kelamSure(q.olusturma)) + '</small></span>' +
      '<span class="ik-ic">' + (q.icerik ? '<span class="ik-m">' + esc(q.icerik) + '</span>' : '') + gorsel + '</span></button>';
  };

  // ---------- Nakil düğmesi: Naklet / İktibas Et ----------
  function nakilGuncelle(id, r) {
    E.$$('[data-kelam="' + id + '"]').forEach(function (kart) {
      var b = E.$('.alt-satir .n', kart);
      if (!b) return;
      b.className = 'n' + (r.nakledildi ? ' acik' : '');
      b.innerHTML = ikon('repeat') + '<span>' + (r.nakil_sayisi || 0) + '</span>';
    });
    var k = E._kelamVeri[id];
    if (k) { k.nakledildi = r.nakledildi; k.nakil_sayisi = r.nakil_sayisi; }
  }
  E.is.nakil = function (el) {
    var id = el.getAttribute('data-id'), k = E._kelamVeri[id] || {};
    var gizli = k.yazar && k.yazar.izole && !(E.ben && k.yazar.id === E.ben.id);
    var y = E.katmanAc('<div class="nkl">' +
      '<button class="nkl-s' + (k.nakledildi ? ' geri' : '') + '" data-n="naklet"' + (gizli ? ' disabled' : '') + '><span>' + ikon(k.nakledildi ? 'repeat-off' : 'repeat') + '</span><div><b>' + (k.nakledildi ? 'Nakli Geri Al' : 'Naklet') + '</b><small>' +
        (gizli ? 'Gizli hesabın kelamı naklolunamaz' : k.nakledildi ? 'Yoldaşlarının akışından kaldır' : 'Kelamı kendi adınla yoldaşlarına ilet') + '</small></div></button>' +
      '<button class="nkl-s" data-n="iktibas"' + (gizli ? ' disabled' : '') + '><span>' + ikon('format-quote-open') + '</span><div><b>İktibas Et</b><small>Kendi sözünle birlikte paylaş</small></div></button>' +
      '<button class="nkl-v" data-is="katman-kapat">Vazgeç</button></div>', 'yaprak kisa');
    y.onclick = function (o) {
      var b = o.target.closest('[data-n]');
      if (!b || b.disabled) return;
      if (b.getAttribute('data-n') === 'iktibas') { E.katmanKapat(); E.iktibasEt(k); return; }
      b.disabled = true;
      E.rpc('kelam_nakil', { p_id: id }).then(function (r) {
        E.katmanKapat();
        nakilGuncelle(id, r);
        try { if (window.Android && Android.titret) Android.titret(15); } catch (e) { /* yok */ }
        E.tost(r.nakledildi ? 'Kelam yoldaşlarına nakledildi.' : 'Nakil geri alındı.', 'iyi');
        if (E.ekran === 'sura' && E._suraListe && !E.yigin.length) E._suraListe.yenile();
      }).catch(function (h) { b.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
    };
  };
  E.iktibasEt = function (k) {
    if (!k || !k.id) return;
    E._nesirIktibas = { id: k.id, icerik: k.icerik, medya: k.medya, olusturma: k.olusturma, yazar: k.yazar };
    E.is.nesret();
  };

  // ---------- Tadil ----------
  E.is['kelam-tadil'] = function (el) {
    var id = el.getAttribute('data-id'), k = E._kelamVeri[id];
    var t = E.yigin.length && E.yigin[E.yigin.length - 1];
    if (!k && t && t.veri && t.veri.kelam.id === id) k = t.veri.kelam;
    if (!k) return;
    E.katmanKapat();
    var muhurler = (k.muhurler || []).slice();
    var y = E.katmanAc('<div class="tdl"><div class="tdl-b">' + ikon('file-document-edit-outline') + '<b>Kelamı Tadil Et</b><small>Kelamın altında "tadil edildi" yazacak.</small></div>' +
      '<textarea class="girdi" maxlength="600" rows="5">' + esc(k.icerik || '') + '</textarea>' +
      (k.ust_id ? '' : '<input class="girdi tdl-m" placeholder="#mühürler (boşlukla ayır)" value="' + esc(muhurler.map(function (m) { return '#' + m; }).join(' ')) + '" autocapitalize="none">') +
      '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu" id="tdl-k">Kaydet</button></div></div>', 'yaprak kisa');
    var alan = E.$('textarea', y), g = E.$('#tdl-k', y);
    setTimeout(function () { alan.focus(); alan.setSelectionRange(alan.value.length, alan.value.length); }, 200);
    g.onclick = function () {
      var mi = E.$('.tdl-m', y);
      var ml = mi ? mi.value.split(/[\s,#]+/).map(function (x) { return x.toLocaleLowerCase('tr'); }).filter(function (x) { return x.length >= 2; }) : [];
      g.disabled = true; g.innerHTML = '<span class="cark kucuk"></span>';
      E.rpc('kelam_tadil', { p_id: id, p_icerik: alan.value, p_muhurler: ml }).then(function (yeni) {
        E.katmanKapat();
        E._kelamVeri[id] = Object.assign(k, yeni);
        E.$$('[data-kelam="' + id + '"]').forEach(function (kart) {
          var acik = !!kart.closest('.sayfa') && t && t.ad === 'kelam' && t.veri && t.veri.kelam.id === id && kart.parentNode === E.$('.ic', kart.closest('.sayfa'));
          var d = document.createElement('div');
          d.innerHTML = E.kelamKart(Object.assign({}, k, { nakleden: kart.classList.contains('nakilli') ? (k.nakleden || null) : null }), acik ? { acik: true } : (kart.classList.contains('cevap') ? { cevap: true, zamanUstte: true } : null));
          kart.parentNode.replaceChild(d.firstChild, kart);
        });
        if (t && t.veri && t.veri.kelam.id === id) t.veri.kelam = k;
        E.tost('Kelam tadil edildi.', 'iyi');
      }).catch(function (h) {
        g.disabled = false; g.textContent = 'Kaydet';
        E.tost(String(h && h.message).indexOf('tadil_suresi') !== -1 ? 'Tadil süresi (15 dakika) doldu.' : E.hataMetni(h), 'kotu');
      });
    };
  };

  // ---------- Seçkin ----------
  E.is['kelam-seckin'] = function (el) {
    var id = el.getAttribute('data-id');
    E.katmanKapat();
    E.rpc('kelam_seckin', { p_id: id }).then(function (oldu) {
      if (E.ben) E.ben.seckin = oldu ? (E._kelamVeri[id] || { id: id }) : null;
      E.tost(oldu ? 'Kelam profilinde seçkin olarak duruyor.' : 'Seçkin kelam kaldırıldı.', 'iyi');
      if (E.ekran === 'profil' && !E.yigin.length) E.kabukYenile(true);
    }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
  };

  // ---------- Görülme: ekranda en az 1 sn kalan kelamlar sayılır ----------
  var sira = {}, gonderildi = {}, bekleyen = {}, gozcu = null;
  function gonder() {
    var l = Object.keys(sira);
    if (!l.length || !E.oturum) return;
    sira = {};
    l.forEach(function (id) { gonderildi[id] = 1; });
    E.rpc('kelam_goruldu', { p_ids: l.slice(0, 60) }).catch(function () { l.forEach(function (id) { delete gonderildi[id]; }); });
  }
  setInterval(gonder, 6000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) gonder(); });
  if ('IntersectionObserver' in window) {
    gozcu = new IntersectionObserver(function (girdiler) {
      girdiler.forEach(function (g) {
        var id = g.target.getAttribute('data-kelam');
        if (!id || gonderildi[id]) return;
        if (g.isIntersecting && g.intersectionRatio >= 0.5) {
          if (!bekleyen[id]) bekleyen[id] = setTimeout(function () { sira[id] = 1; delete bekleyen[id]; }, 1000);
        } else if (bekleyen[id]) { clearTimeout(bekleyen[id]); delete bekleyen[id]; }
      });
    }, { threshold: [0, 0.5] });
  }
  E.gorulmeIzle = function (kap) {
    if (!gozcu || !kap) return;
    E.$$('[data-kelam]', kap).forEach(function (k) {
      var id = k.getAttribute('data-kelam');
      var v = E._kelamVeri[id];
      if (gonderildi[id] || (v && v.yazar && E.ben && v.yazar.id === E.ben.id)) return;
      gozcu.observe(k);
    });
  };

  // ---------- Uzlet (hesabı geçici dondurma) ----------
  E.is['uzlet-ac'] = function () {
    E.katmanAc('<div class="uzl">' +
      '<div class="uzl-ay">' + ikon('moon-waning-crescent') + '</div>' +
      '<h3>Uzlete Çekil</h3>' +
      '<p>Bir süre meclisten uzaklaşıp kendine vakit ayırmak istersen, hesabını silmeden uzlete çekilebilirsin.</p>' +
      '<div class="uzl-l">' +
        '<div>' + ikon('eye-off-outline') + '<span>Profilin ve kelamların yoldaşlardan gizlenir.</span></div>' +
        '<div>' + ikon('bell-off-outline') + '<span>Bildirimler ve mesajlar durur; sana mesaj gönderilemez.</span></div>' +
        '<div>' + ikon('lock-outline') + '<span>Hiçbir verin silinmez; yoldaşların, kelamların, heyben yerinde kalır.</span></div>' +
        '<div>' + ikon('login') + '<span>Geri dönmek için tekrar giriş yapman yeterli.</span></div>' +
      '</div>' +
      '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu uzl-d" data-is="uzlet-onay">Uzlete Çekil</button></div></div>', 'yaprak kisa');
  };
  E.is['uzlet-onay'] = function (el) {
    el.disabled = true; el.innerHTML = '<span class="cark kucuk"></span>';
    try { if (window.Android && Android.bildirimDurdur) Android.bildirimDurdur(); } catch (e) { /* yok */ }
    return E.rpc('uzlete_cekil').then(function () {
      E.katmanKapat();
      E.tost('Uzlete çekildin. Hayırlı bir uzlet dileriz yoldaş.', 'iyi');
      setTimeout(function () { E.cikisYap(); }, 700);
    }, function (h) { el.disabled = false; el.textContent = 'Uzlete Çekil'; throw h; });
  };
  // giriş yapan yoldaş uzletteyse: dönüş ekranı
  E.uzletEkrani = function (devam) {
    var kok = document.createElement('div');
    kok.className = 'uzl-ekran';
    var tarih = E.ben && E.ben.uzlet_tarih ? new Date(E.ben.uzlet_tarih) : null;
    kok.innerHTML = '<div class="uzl-ic"><div class="uzl-ay buyuk">' + ikon('moon-waning-crescent') + '</div>' +
      '<h2>Uzletten dönüyorsun</h2>' +
      '<p>Hesabın uzlette, yoldaşlardan gizli duruyor. Meclise dönmek istersen profilin ve kelamların yeniden görünür olacak.</p>' +
      '<button class="emn-ileri" id="uzl-don">' + ikon('door-open') + 'Meclise Dön</button>' +
      '<button class="uzl-cik" id="uzl-cik">Uzlette kal, çıkış yap</button></div>';
    document.getElementById('uyg').appendChild(kok);
    E.$('#uzl-don', kok).onclick = function () {
      var b = this; b.disabled = true;
      E.rpc('uzletten_don').then(function () {
        if (E.ben) E.ben.uzlet = false;
        kok.parentNode.removeChild(kok);
        E.tost('Meclise hoş geldin yoldaş!', 'iyi');
        devam();
      }).catch(function (h) { b.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
    };
    E.$('#uzl-cik', kok).onclick = function () { kok.parentNode.removeChild(kok); E.cikisYap(); };
  };
})();
