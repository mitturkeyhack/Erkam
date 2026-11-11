// ERKAM — kabuk ekranları: Şûra, Suffe, Mesajlar, Profil, Künye, Adap, Gayemiz, Nizam, Heybe
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  var KATEGORI = { ilim: 'ilim', tecrube: 'tecrübe', infak: 'infak', adap: 'adap' };
  E.KATEGORI_AD = { ilim: 'İlim', tecrube: 'Tecrübe', infak: 'İnfak', adap: 'Adap' };
  var SUFFE_KAT = { siber: 'Siber Güvenlik', yazilim: 'Yazılım', adap: 'Adap' };
  E.veri = { sura: null, suffe: null, sohbetler: null, suffeCip: 'tumu', mesajCip: 'tumu', profilSekme: 'kelam' };

  // ---------- kelam kartı ----------
  E.metinHtml = function (s) {
    return esc(s).replace(/(^|[^a-z0-9_@])@([a-z0-9_]{3,20})(?![a-z0-9_])/gi, function (t, on, k) {
      return on + '<span class="etiket" data-is="yoldas" data-kunye="' + k.toLowerCase() + '">@' + k + '</span>';
    });
  };
  E.kelamKart = function (k, o) {
    o = o || {};
    var y = k.yazar || {};
    var sagUst = o.zamanUstte ? E.once(k.olusturma) : ((k.muhurler && k.muhurler[0]) || KATEGORI[k.kategori] || '');
    var h = '<div class="kart kelam' + (o.cevap ? ' cevap' : '') + '" data-kelam="' + k.id + '">' +
      '<div class="bas"><button class="kim" data-is="yoldas" data-kunye="' + esc(y.kunye) + '">' + E.avatar(y) +
      '<b>' + esc(y.isim || 'Yoldaş') + '</b>' + (y.rol === 'yonetim' ? ikon('check-decagram') : '') + '</button>' +
      '<span class="tur">' + esc(sagUst) + '</span></div>' +
      '<div class="metin"' + (o.acik ? '' : ' data-is="kelam-ac" data-id="' + k.id + '"') + '>' + E.metinHtml(k.icerik) + '</div>';
    h += E.medyaHtml(k);
    if ((o.muhurlu || o.acik) && k.muhurler && k.muhurler.length) {
      h += '<div class="muhurler">' + k.muhurler.map(function (m) {
        return '<button class="muhur" data-is="muhur-ac" data-muhur="' + esc(m) + '">' + ikon('stamper') + esc(m) + '</button>';
      }).join('') + '</div>';
    }
    if (o.acik) h += '<div class="zaman">' + esc(E.KATEGORI_AD[k.kategori] || '') + ' · ' + esc(E.once(k.olusturma)) + '</div>';
    h += '<div class="alt-satir">' +
      '<button data-is="tasdik" data-id="' + k.id + '" class="t' + (k.tasdikledim ? ' acik' : '') + '">' +
      ikon('star-crescent') + '<span>' + (k.tasdik_sayisi || 0) + '</span></button>';
    if (!o.cevap) {
      h += '<button data-is="' + (o.acik ? 'cevap-odak' : 'kelam-ac') + '" data-id="' + k.id + '">' + ikon('comment-text-outline') +
        '<span>' + (k.cevap_sayisi || 0) + '</span></button>';
    }
    h += '<button data-is="heybe" data-id="' + k.id + '" class="heybe' + (k.heybemde ? ' acik' : '') + '" aria-label="Heybe">' +
      ikon(k.heybemde ? 'bag-personal' : 'bag-personal-outline') + '</button>';
    if (o.cevap) h += '<button data-is="kelam-menu" data-id="' + k.id + '" data-yazar="' + esc(y.id) + '" aria-label="Seçenekler">' + ikon('dots-vertical') + '</button>';
    return h + '</div></div>';
  };

  // Sayfalanan kelam listesi. arg: kelam_listesi parametreleri
  E.kelamListe = function (kap, arg, o) {
    o = o || {};
    var liste = [], bitti = false, mesgul = false;
    function ciz() {
      if (!liste.length) {
        kap.innerHTML = '<div class="bos-not">' + (o.bosIkon ? ikon(o.bosIkon) : '') + esc(o.bos || 'Henüz bir kelam nakşedilmemiş. İlk sen ol.') + '</div>';
        return;
      }
      kap.innerHTML = liste.map(function (k) { return E.kelamKart(k, o.kart); }).join('') +
        (bitti ? '' : '<button class="daha" data-liste-daha>Daha eski kelamlar</button>');
    }
    function yukle(devam) {
      if (mesgul) return Promise.resolve();
      mesgul = true;
      if (!devam) kap.innerHTML = '<div class="yukleniyor"><div class="cark"></div></div>';
      var p = { p_kaynak: arg.kaynak, p_yazar: arg.yazar || null, p_metin: arg.metin || null, p_limit: 20,
        p_once: devam && liste.length ? liste[liste.length - 1].olusturma : null };
      return E.rpc('kelam_listesi', p).then(function (d) {
        d = d || [];
        liste = devam ? liste.concat(d) : d;
        bitti = d.length < 20 || arg.kaynak === 'heybe';
        mesgul = false;
        ciz();
        if (o.yuklendi) o.yuklendi(liste);
      }).catch(function (h) {
        mesgul = false;
        if (devam) { E.tost(E.hataMetni(h), 'kotu'); return; }
        kap.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) +
          '<button class="tekrar" data-liste-tekrar>Tekrar dene</button></div>';
      });
    }
    kap.onclick = function (ol) {
      if (ol.target.closest('[data-liste-daha]')) yukle(true);
      else if (ol.target.closest('[data-liste-tekrar]')) yukle(false);
    };
    yukle(false);
    return {
      yenile: function () { return yukle(false); },
      basaEkle: function (k) { liste.unshift(k); ciz(); },
      cikar: function (id) { liste = liste.filter(function (k) { return k.id !== id; }); ciz(); }
    };
  };

  // tasdik / heybe: ekrandaki bütün kopyaları güncelle
  function kelamDomGuncelle(id, f) {
    E.$$('[data-kelam="' + id + '"]').forEach(f);
  }
  E.is.tasdik = function (el) {
    var id = el.getAttribute('data-id');
    el.disabled = true;
    return E.rpc('tasdik_degistir', { p_kelam: id }).then(function (r) {
      kelamDomGuncelle(id, function (kart) {
        var b = E.$('.alt-satir .t', kart);
        if (!b) return;
        b.className = 't' + (r.tasdikledim ? ' acik' : '');
        b.innerHTML = ikon('star-crescent') + '<span>' + r.tasdik_sayisi + '</span>';
        b.disabled = false;
      });
      el.disabled = false;
    }, function (h) { el.disabled = false; throw h; });
  };
  E.is.heybe = function (el) {
    var id = el.getAttribute('data-id');
    return E.rpc('heybe_degistir', { p_kelam: id }).then(function (acik) {
      kelamDomGuncelle(id, function (kart) {
        var b = E.$('.alt-satir .heybe', kart);
        if (!b) return;
        b.className = 'heybe' + (acik ? ' acik' : '');
        b.innerHTML = ikon(acik ? 'bag-personal' : 'bag-personal-outline');
      });
      E.tost(acik ? 'Kelam heybene kondu.' : 'Kelam heybenden çıkarıldı.', 'iyi');
      if (!acik && E.ekran === 'heybe' && !E.yigin.length && E._heybeListe) E._heybeListe.cikar(id);
    });
  };
  E.is.yoldas = function (el) {
    var k = el.getAttribute('data-kunye');
    if (!k) return;
    if (E.ben && k === E.ben.kunye) { E.tumKatmanlariKapat(); E.tumSayfalariKapat(); E.git('profil'); return; }
    E.yoldasSayfa(k);
  };
  E.is['kelam-ac'] = function (el) { E.kelamSayfa(el.getAttribute('data-id')); };
  E.is['muhur-ac'] = function (el) { E.muhurSayfa(el.getAttribute('data-muhur')); };

  // ---------- kabuk ----------
  var SEKME = [
    { ad: 'sura', etiket: 'Şûra', ikon: 'compass-outline', dolu: 'compass' },
    { ad: 'suffe', etiket: 'Suffe', ikon: 'book-open-page-variant-outline', dolu: 'book-open-page-variant' },
    { ad: 'nesret', etiket: 'Neşret', ikon: 'feather', orta: true },
    { ad: 'mesajlar', etiket: 'Mesajlar', ikon: 'message-text-outline', dolu: 'message-text' },
    { ad: 'profil', etiket: 'Profil', ikon: 'account-outline', dolu: 'account' }
  ];
  E.kabukCiz = function () {
    var k = E.$('#kabuk');
    k.innerHTML =
      '<div class="ust"><button class="ikb yesil" data-is="cekmece" aria-label="Menü">' + ikon('menu') + '</button>' +
      '<div class="marka">' + ikon('star-crescent') + 'ERKAM</div>' +
      '<button class="ikb" data-is="ara" aria-label="Ara">' + ikon('magnify') + '</button>' +
      '<button class="ikb" data-is="bildirimler" aria-label="Bildirimler" id="zil">' + ikon('bell-outline') + '</button></div>' +
      '<div id="govde"></div><div id="yuzen-kok"></div><nav class="alt" id="alt"></nav>';
    k.hidden = false;
    E.altCiz();
    E.rozetCiz();
  };
  E.altCiz = function () {
    var a = E.$('#alt');
    if (!a) return;
    a.innerHTML = SEKME.map(function (s) {
      if (s.orta) return '<button class="orta" data-is="nesret"><i>' + ikon(s.ikon) + '</i>' + s.etiket + '</button>';
      var aktif = E.ekran === s.ad;
      return '<button data-is="sekme" data-ekran="' + s.ad + '" class="' + (aktif ? 'aktif' : '') + '">' + ikon(aktif ? s.dolu : s.ikon) +
        s.etiket + (s.ad === 'mesajlar' && E.ben && E.ben.okunmamis_mesaj > 0 ? '<span class="nokta">' + Math.min(E.ben.okunmamis_mesaj, 99) + '</span>' : '') + '</button>';
    }).join('');
  };
  E.rozetCiz = function () {
    var z = E.$('#zil');
    if (!z || !E.ben) return;
    var n = (E.ben.okunmamis_bildirim || 0);
    z.innerHTML = ikon('bell-outline') + (n > 0 ? '<span class="rozet">' + Math.min(n, 99) + '</span>' : '');
    E.altCiz();
  };
  E.git = function (ekran) {
    E.ekran = ekran;
    E.altCiz();
    var g = E.$('#govde');
    g.scrollTop = 0;
    E.$('#yuzen-kok').innerHTML = '';
    (EKRAN[ekran] || EKRAN.sura)(g);
  };
  E.kabukYenile = function (sessiz) {
    if (!E.oturum) return;
    if (sessiz && (E.ekran === 'kunye' || E.ekran === 'adap' || E.ekran === 'gayemiz')) return;
    var g = E.$('#govde'), y = g ? g.scrollTop : 0;
    E.$('#yuzen-kok').innerHTML = '';
    (EKRAN[E.ekran] || EKRAN.sura)(g, true);
    if (sessiz && g) setTimeout(function () { g.scrollTop = y; }, 60);
  };
  E.is.sekme = function (el) { E.git(el.getAttribute('data-ekran')); };

  // ---------- çekmece ----------
  E.is.cekmece = function () {
    var b = E.ben || {};
    function it(x) {
      return '<button class="cm-it' + (E.ekran === x[0] ? ' on' : '') + '" data-is="cekmece-git" data-ekran="' + x[0] + '">' + ikon(x[1]) + x[2] + '</button>';
    }
    E.$('#cekmece-kok').innerHTML = '<div class="perde" data-is="cekmece-kapat"></div><div class="cekmece">' +
      '<button class="cm-bas" data-is="cekmece-git" data-ekran="profil"><span class="cm-dev">' + ikon('star-crescent') + '</span>' +
      '<span class="cm-lg">' + ikon('star-crescent') + 'ERKAM</span>' + E.avatar(b, 'cm-av') +
      '<b>' + esc(b.isim || '') + '</b><span class="cm-kn">@' + esc(b.kunye || '') + '</span></button>' +
      '<div class="cm-ic"><div class="cm-gb">MECLİS</div>' +
      [['profil', 'account-circle', 'Profil'], ['kunye', 'account-edit', 'Künye'], ['heybe', 'bag-personal', 'Heybe']].map(it).join('') +
      '<div class="cm-gb">ERKAM</div>' +
      [['adap', 'scale-balance', 'Adap ve Usul'], ['gayemiz', 'compass-rose', 'Gayemiz'], ['nizam', 'cog', 'Nizam']].map(it).join('') +
      '</div><button class="cm-cik" data-is="cekmece-cikis">' + ikon('logout') + 'Meclisten Ayrıl</button></div>';
  };
  E.is['cekmece-cikis'] = function () { E.cekmeceKapat(); return E.is.cikis(); };
  E.cekmeceKapat = function () { E.$('#cekmece-kok').innerHTML = ''; };
  E.is['cekmece-kapat'] = E.cekmeceKapat;
  E.is['cekmece-git'] = function (el) { E.cekmeceKapat(); E.git(el.getAttribute('data-ekran')); };

  var EKRAN = {};

  // ---------- Şûra ----------
  EKRAN.sura = function (g) {
    g.innerHTML = '<div style="height:22px"></div><div id="sura-liste"></div>';
    E._suraListe = E.kelamListe(E.$('#sura-liste'), { kaynak: 'sura' }, { bos: 'Henüz bir kelam nakşedilmemiş. İlk sen ol.', bosIkon: 'feather' });
  };

  // ---------- Suffe ----------
  EKRAN.suffe = function (g) {
    g.innerHTML = '<div class="baslik">' + ikon('book-open-page-variant') + '<h2>Suffe Kütüphanesi</h2></div>' +
      '<div class="cipler" id="suffe-cip"></div><div id="suffe-liste"><div class="yukleniyor"><div class="cark"></div></div></div>';
    function ciz() {
      var c = E.veri.suffeCip;
      E.$('#suffe-cip').innerHTML = [['tumu', 'Tümü'], ['siber', 'Siber Güvenlik'], ['yazilim', 'Yazılım'], ['adap', 'Adap']].map(function (x) {
        return '<button class="cip' + (c === x[0] ? ' aktif' : '') + '" data-is="suffe-cip" data-cip="' + x[0] + '">' + x[1] + '</button>';
      }).join('');
      var d = (E.veri.suffe || []).filter(function (x) { return c === 'tumu' || x.kategori === c; });
      E.$('#suffe-liste').innerHTML = d.length ? d.map(function (x) {
        var durum = x.yuzde >= 100 ? 'Tamamlandı' : x.yuzde > 0 ? '%' + x.yuzde + ' Okundu' : 'Başlamadı';
        return '<div class="kart ders" data-is="ders-ac" data-id="' + x.id + '"><div class="ust-satir"><span class="ikon-kutu">' + ikon(x.ikon) + '</span>' +
          '<div class="ad"><small>' + esc(SUFFE_KAT[x.kategori] || '') + '</small><b>' + esc(x.baslik) + '</b></div>' +
          '<span class="sure">' + ikon('clock-outline') + x.sure_dk + ' dk</span></div>' + (x.ozet ? '<p>' + esc(x.ozet) + '</p>' : '<p class="yakinda">İçerik yakında eklenecek.</p>') +
          '<div class="cubuk"><i style="width:' + Math.max(0, Math.min(100, x.yuzde)) + '%"></i></div><div class="durum">' + durum + '</div></div>';
      }).join('') : '<div class="bos-not">Bu rafta henüz ders yok.</div>';
    }
    E._suffeCiz = ciz;
    if (E.veri.suffe) ciz();
    E.rpc('suffe_listesi').then(function (d) { E.veri.suffe = d || []; if (E.ekran === 'suffe') ciz(); }).catch(function (h) {
      if (!E.veri.suffe && E.ekran === 'suffe') E.$('#suffe-liste').innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>';
    });
  };
  E.is['suffe-cip'] = function (el) { E.veri.suffeCip = el.getAttribute('data-cip'); if (E._suffeCiz) E._suffeCiz(); };
  E.is['ders-ac'] = function (el) { E.dersSayfa(+el.getAttribute('data-id')); };

  // ---------- Mesajlar ----------
  EKRAN.mesajlar = function (g) {
    g.innerHTML = '<div class="serit">' + ikon('shield-lock') + '<span>Kelamlarınız Dar-ul Erkam\'ın manevi emanetinde, mahremdir.</span></div>' +
      '<label class="ara-kutu">' + ikon('magnify') + '<input id="mesaj-ara" placeholder="Kelam veya yoldaş ara..." autocomplete="off"></label>' +
      '<div class="cipler" id="mesaj-cip"></div><div id="mesaj-liste"><div class="yukleniyor"><div class="cark"></div></div></div>';
    E.$('#yuzen-kok').innerHTML = '<button class="yuzen" data-is="yeni-mesaj" aria-label="Yeni mesaj">' + ikon('message-plus') + '</button>';
    function ciz() {
      var c = E.veri.mesajCip, q = (E.$('#mesaj-ara').value || '').toLocaleLowerCase('tr');
      E.$('#mesaj-cip').innerHTML = [['tumu', 'Tümü'], ['okunmayan', 'Okunmayanlar'], ['meclis', 'Meclis']].map(function (x) {
        return '<button class="cip' + (c === x[0] ? ' aktif' : '') + '" data-is="mesaj-cip" data-cip="' + x[0] + '">' + x[1] + '</button>';
      }).join('');
      var kap = E.$('#mesaj-liste');
      if (c === 'meclis') { kap.innerHTML = '<div class="bos-not">' + ikon('account-group') + 'Meclis odaları bir sonraki sürümde açılacak.</div>'; return; }
      var d = (E.veri.sohbetler || []).filter(function (s) {
        if (c === 'okunmayan' && !(s.okunmamis > 0)) return false;
        if (!q) return true;
        return ((s.kisi && (s.kisi.isim + ' ' + s.kisi.kunye)) + ' ' + s.son).toLocaleLowerCase('tr').indexOf(q) !== -1;
      });
      kap.innerHTML = d.length ? d.map(function (s) {
        var k = s.kisi || {};
        return '<div class="kart sohbet-satir" data-is="sohbet-ac" data-id="' + esc(k.id) + '">' + E.avatar(k) +
          '<div class="orta"><b>' + esc(k.isim || 'Yoldaş') + '</b><span>' + (s.benden ? 'Sen: ' : '') + esc(s.son) + '</span></div>' +
          '<div class="sag' + (s.okunmamis > 0 ? ' yeni' : '') + '">' + esc(E.kisaZaman(s.zaman)) +
          (s.okunmamis > 0 ? '<span class="sayi">' + s.okunmamis + '</span>' : '') + '</div></div>';
      }).join('') : '<div class="bos-not">' + ikon('message-text-outline') +
        (c === 'okunmayan' ? 'Okunmamış mesajın yok.' : q ? 'Aradığın sohbet bulunamadı.' : 'Henüz bir sohbetin yok. Bir yoldaşa selam ver.') + '</div>';
    }
    E._mesajCiz = ciz;
    E.$('#mesaj-ara').oninput = ciz;
    if (E.veri.sohbetler) ciz();
    E.sohbetleriYukle();
  };
  E.sohbetleriYukle = function () {
    return E.rpc('sohbet_listesi').then(function (d) {
      E.veri.sohbetler = d || [];
      if (E.ekran === 'mesajlar' && E._mesajCiz && E.$('#mesaj-liste')) E._mesajCiz();
    }).catch(function (h) {
      if (!E.veri.sohbetler && E.ekran === 'mesajlar' && E.$('#mesaj-liste')) {
        E.$('#mesaj-liste').innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>';
      }
    });
  };
  E.is['mesaj-cip'] = function (el) { E.veri.mesajCip = el.getAttribute('data-cip'); if (E._mesajCiz) E._mesajCiz(); };
  E.is['sohbet-ac'] = function (el) {
    var id = el.getAttribute('data-id');
    var s = (E.veri.sohbetler || []).filter(function (x) { return x.kisi && x.kisi.id === id; })[0];
    E.sohbetSayfa(s ? s.kisi : { id: id });
  };
  E.is['yeni-mesaj'] = function () { E.yoldasSec(); };

  // ---------- Profil ----------
  E.profilGovde = function (p, benim) {
    var kapak = p.kapak_yol ? ' style="background-image:url(\'' + esc(E.gorselUrl(p.kapak_yol)) + '\')"' : '';
    var h = '<div class="kapak"' + kapak + '>' + (benim ? '<button class="dgm" data-is="gorsel-degis" data-tur="kapak" aria-label="Kapak görseli">' + ikon('camera-plus') + '</button>' : '') + '</div>' +
      '<div class="profil-bas"><div class="buyuk">' + E.avatar(p) +
      (benim ? '<button class="kam" data-is="gorsel-degis" data-tur="avatar" aria-label="Profil görseli">' + ikon('camera') + '</button>' : '') + '</div>' +
      '<h3>' + esc(p.isim) + '</h3><div class="kunye">@' + esc(p.kunye) + '</div>' +
      '<div class="bio"><span>' + esc(p.biyografi || '') + '</span>' + (benim ? '<button data-is="cekmece-git" data-ekran="kunye" aria-label="Düzenle">' + ikon('pencil') + '</button>' : '') + '</div>';
    if (!benim) {
      var d = p.iliski === 'onayli' ? ['cerceve', 'account-check', 'Yoldaşsınız'] : p.iliski === 'bekliyor' ? ['cerceve', 'account-clock', 'İstek Gönderildi'] : ['dolu', 'account-plus', 'Yoldaş Edin'];
      h += '<div class="profil-dgm"><button class="' + d[0] + '" data-is="yoldas-edin" data-id="' + esc(p.id) + '">' + ikon(d[1]) + d[2] + '</button>' +
        '<button class="cerceve" data-is="mesaj-yaz" data-id="' + esc(p.id) + '">' + ikon('message-text-outline') + 'Mesaj</button></div>';
    }
    h += '</div><div class="sayilar"><div><b>' + (p.takip_edilen_sayisi || 0) + '</b><span>Takip Edilen</span></div>' +
      '<div><b>' + (p.yoldas_sayisi || 0) + '</b><span>Yoldaşlar</span></div></div>';
    return h;
  };
  E.profilSekmeleri = function (kap, p, benim, durum) {
    var s = durum.sekme;
    kap.innerHTML = '<div class="sekmeler">' + [['kelam', 'Kelamlar'], ['cevap', 'Cevaplar'], ['istisare', 'İstişareler']].map(function (x) {
      return '<button class="' + (s === x[0] ? 'aktif' : '') + '" data-psekme="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div><div class="pl"></div>';
    var arg = s === 'kelam' ? { kaynak: 'yazar', yazar: p.id } : s === 'cevap' ? { kaynak: 'cevap', yazar: p.id } : { kaynak: 'ara', metin: '@' + p.kunye };
    var bos = s === 'kelam' ? (benim ? 'Henüz kelamın veya etiketin yok.' : 'Bu yoldaş henüz kelam nakşetmemiş.')
      : s === 'cevap' ? 'Henüz verilmiş bir cevap yok.' : 'Henüz bu künyenin anıldığı bir istişare yok.';
    E.kelamListe(E.$('.pl', kap), arg, { bos: bos, kart: s === 'cevap' ? { zamanUstte: true } : null });
    E.$('.sekmeler', kap).onclick = function (o) {
      var b = o.target.closest('[data-psekme]');
      if (!b) return;
      durum.sekme = b.getAttribute('data-psekme');
      E.profilSekmeleri(kap, p, benim, durum);
    };
  };
  EKRAN.profil = function (g) {
    var durum = { sekme: 'kelam' };
    function ciz() {
      g.innerHTML = E.profilGovde(E.ben, true) + '<div id="profil-alt"></div>';
      E.profilSekmeleri(E.$('#profil-alt'), E.ben, true, durum);
    }
    ciz();
    E.beniYenile().then(function (degisti) { if (degisti && E.ekran === 'profil' && !E.yigin.length) ciz(); });
  };
  E.is['gorsel-degis'] = function (el) {
    var tur = el.getAttribute('data-tur');
    return E.dosyaSec().then(function (dosya) {
      if (!dosya) return;
      E.tost('Görsel işleniyor...');
      return E.gorselYukle(dosya, tur, tur === 'avatar' ? 480 : 1400).then(function (yol) {
        return E.rpc('profil_gorsel', { p_tur: tur, p_yol: yol });
      }).then(function (b) {
        E.ben = b;
        E.tost('Görsel mühürlendi.', 'iyi');
        E.kabukYenile();
      });
    });
  };

  // ---------- Künye ----------
  EKRAN.kunye = function (g) {
    var b = E.ben;
    g.innerHTML = '<div class="kunye-ust"><button data-is="gorsel-degis" data-tur="avatar" aria-label="Profil görseli">' + E.avatar(b) + '</button>' +
      '<h2>Künyeyi Nakşet</h2><p>Siber meclisteki kimliğini şekillendir.</p></div>' +
      '<div class="kart form" style="padding:26px 22px 8px;border-radius:30px">' +
      '<label for="k-isim">İsim Soyisim</label><input class="girdi" id="k-isim" maxlength="40" value="' + esc(b.isim) + '">' +
      '<label for="k-kunye">Kullanıcı Adı</label><input class="girdi" id="k-kunye" maxlength="21" autocapitalize="none" autocomplete="off" spellcheck="false" value="@' + esc(b.kunye) + '">' +
      '<label for="k-bio">Biyografi</label><textarea class="girdi" id="k-bio" maxlength="160">' + esc(b.biyografi || '') + '</textarea></div>' +
      '<button class="genis" data-is="kunye-kaydet">Mühürle ve Profile Dön ' + ikon('check') + '</button>';
  };
  E.is['kunye-kaydet'] = function (el) {
    el.disabled = true;
    return E.rpc('profil_guncelle', {
      p_isim: E.$('#k-isim').value, p_kunye: E.$('#k-kunye').value, p_biyografi: E.$('#k-bio').value
    }).then(function (b) {
      E.ben = b;
      E.tost('Künyen mühürlendi.', 'iyi');
      E.git('profil');
    }, function (h) { el.disabled = false; throw h; });
  };

  // ---------- Adap ve Usul ----------
  EKRAN.adap = function (g) {
    var m = [
      ['incognito-circle', '1. Sırrın Muhafazası', 'Mecliste paylaşılan sıfırıncı gün (0-day) açıkları, özel kodlar ve yoldaş kimlikleri dışarıya aktarılamaz. Mahremiyet en büyük onurumuzdur.'],
      ['hand-heart', '2. İlmin İnfakı', 'Edinilen bilgi saklanmaz. Suffe meclisinde öğrenilen her siber güvenlik taktiği, bir diğer yoldaşa aktarılmak zorundadır.'],
      ['shield-sword', '3. Savunma Önceliği', 'Öğrenilen sızma testi ve zafiyet analiz yöntemleri, yalnızca sistemleri korumak ve açık kapatmak amacıyla kullanılır. Yıkıcı olmak yasaktır.'],
      ['handshake', '4. Yoldaşlık Hukuku', 'Şûra meclisinde hiçbir yoldaşın bilgisi hor görülmez. Üslup, bir ERKAM mensubunun kimliğidir.']
    ];
    g.innerHTML = '<div class="baslik cizgili">' + ikon('scale-balance') + '<h2>Adap ve Usul</h2></div>' +
      '<div class="anayasa">' + ikon('star-crescent') + '<h3>ERKAM ANAYASASI</h3><p>Bu meclise adım atan her yoldaş, aşağıdaki düsturlara riayet etmekle mükelleftir.</p></div>' +
      m.map(function (x) {
        return '<div class="kart madde"><span class="ikon-kutu">' + ikon(x[0]) + '</span><div class="ic"><b>' + x[1] + '</b><span>' + esc(x[2]) + '</span></div></div>';
      }).join('') +
      '<p class="soz">"İlim, paylaşıldıkça çoğalır; ahlak, yaşatıldıkça yücelir."</p>' +
      '<p class="imza">Afsu Diyaliz Team Ailesi olarak bu nizamın koruyucularıyız.</p>';
  };

  // ---------- Gayemiz ----------
  EKRAN.gayemiz = function (g) {
    var m = [
      ['history', 'Neden ERKAM?', 'İsmimizi, İslam tarihinin ilk gizli eğitim ve istişare merkezi olan Hz. Erkam bin Ebi\'l-Erkam\'ın evinden (Dar-ul Erkam) alıyoruz. O ev, bilginin, güvenin ve ahlakın sığınağıydı. Biz de bugün, dijital dünyanın karmaşasında mahremiyeti ve ahlaki değerleri merkeze alan bir "yoldaşlık evi" inşa ediyoruz.'],
      ['shield-lock', 'Dijital Ahlak', 'Amacımız; algoritmaların insan psikolojisini yönettiği değil, insanın teknolojiyi kendi değerleri ve ahlakı doğrultusunda şekillendirdiği bir meclis kurmaktır. ERKAM, nefret söyleminden uzak, bilgi paylaşımının esas olduğu, yoldaşlık hukukuna dayalı bir siber duruştur.'],
      ['rocket-launch', 'Vizyonumuz', 'Siber güvenlikte uzmanlaşmış, teknolojiyle ahlakı harmanlayan bir yoldaş topluluğu oluşturmak. Bilginin infak edildiği, yardımlaşmanın kodlandığı ve dijital mahremiyetin bir hak olarak değil, bir kültür olarak yaşandığı bir gelecek tasarlıyoruz.']
    ];
    g.innerHTML = '<div class="baslik cizgili">' + ikon('compass-rose') + '<h2>Gayemiz</h2></div>' +
      m.map(function (x) { return '<div class="kart gaye">' + ikon(x[0]) + '<h3>' + x[1] + '</h3><p>' + esc(x[2]) + '</p></div>'; }).join('');
  };

  // ---------- Nizam ----------
  function anahtar(acik) { return '<span class="anahtar' + (acik ? ' acik' : '') + '"><i>' + ikon('star-crescent') + '</i></span>'; }
  EKRAN.nizam = function (g) {
    var b = E.ben, u = (E.oturum && E.oturum.user) || {};
    var tasdikli = !!(u.email_confirmed_at || u.confirmed_at);
    var surum = '0.1';
    try { if (window.Android && Android.surum) surum = Android.surum(); } catch (e) { /* köprü yok */ }
    g.innerHTML = '<div class="baslik">' + ikon('cog') + '<h2>Nizam</h2></div>' +
      '<div class="bolum">GÜVENLİK VE GİZLİLİK</div><div class="grup">' +
      '<button class="satir" data-is="ayar-biyometrik"><span class="ikon-kutu">' + ikon('fingerprint') + '</span><span class="orta"><b>Biyometrik Mühür</b><span>Girişte parmak izi / yüz tanıma ister</span></span>' + anahtar(E.tercih('biyometrik') === '1') + '</button>' +
      '<button class="satir" data-is="ayar-izole"><span class="ikon-kutu">' + ikon('incognito-circle') + '</span><span class="orta"><b>İzole Kimlik (Gizli Hesap)</b><span>Profilini sadece tasdikli yoldaşlar görür</span></span>' + anahtar(b.izole) + '</button></div>' +
      '<div class="bolum">SİSTEM TERCİHLERİ</div><div class="grup">' +
      '<button class="satir" data-is="ayar-fecr"><span class="ikon-kutu">' + ikon('theme-light-dark') + '</span><span class="orta"><b>Fecr Modu (Açık Tema)</b><span>Meclis arayüzünü aydınlatır</span></span>' + anahtar(E.tercih('fecr') !== '0') + '</button>' +
      '<button class="satir" data-is="ayar-bildirim"><span class="ikon-kutu">' + ikon('bell-ring') + '</span><span class="orta"><b>Meclis Bildirimleri</b><span>Yeni kelam ve mesajları bildir</span></span>' + anahtar(E.tercih('bildirim') !== '0') + '</button></div>' +
      '<div class="bolum">HESAP YÖNETİMİ</div><div class="grup">' +
      '<button class="satir duz" data-is="cekmece-git" data-ekran="kunye">' + ikon('at') + '<span class="orta"><b>Künye (Kullanıcı Adı) Değiştir</b></span>' + ikon('chevron-right', 'ok') + '</button>' +
      '<button class="satir duz" data-is="eposta-tasdik">' + ikon('email-check-outline') + '<span class="orta"><b>E-Posta Tasdiki</b><span>' + esc(u.email || '') + '</span></span>' +
      '<span class="etk ' + (tasdikli ? 'iyi' : 'kotu') + '">' + (tasdikli ? 'Onaylı' : 'Onaysız') + '</span>' + ikon('chevron-right', 'ok') + '</button>' +
      '<button class="satir duz" data-is="sifre-guncelle">' + ikon('key-chain') + '<span class="orta"><b>Şifre Güncelle</b></span>' + ikon('chevron-right', 'ok') + '</button>' +
      '<button class="satir duz kirmizi" data-is="cikis">' + ikon('logout') + '<span class="orta"><b>Meclisten Ayrıl (Çıkış Yap)</b></span></button></div>' +
      '<div class="grup"><button class="satir duz kirmizi" data-is="hesap-sil">' + ikon('account-remove') + '<span class="orta"><b>Hesabımı Kalıcı Olarak Sil</b></span></button></div>' +
      '<div class="surum">ERKAM v' + esc(surum) + '</div>';
  };
  E.is['ayar-fecr'] = function () {
    E.tercih('fecr', E.tercih('fecr') !== '0' ? '0' : '1');
    E.temaUygula();
    E.kabukYenile(true);
  };
  E.is['ayar-bildirim'] = function () {
    E.tercih('bildirim', E.tercih('bildirim') === '0' ? '1' : '0');
    E.kabukYenile(true);
  };
  E.is['ayar-izole'] = function () {
    var yeni = !E.ben.izole;
    return E.rpc('izole_ayarla', { p_acik: yeni }).then(function (r) {
      E.ben.izole = !!r;
      E.tost(r ? 'Kimliğin izole edildi. Kelamlarını yalnızca tasdikli yoldaşların görür.' : 'İzole kimlik kaldırıldı.', 'iyi');
      E.kabukYenile(true);
    });
  };
  E.is['ayar-biyometrik'] = function () {
    if (E.tercih('biyometrik') === '1') { E.tercih('biyometrik', '0'); E.kabukYenile(true); return; }
    var durum = 'yok';
    try { if (window.Android && Android.biyometrikDurum) durum = Android.biyometrikDurum(); } catch (e) { /* köprü yok */ }
    if (durum === 'yok') { E.tost('Cihazında biyometrik mühür (parmak izi/yüz) donanımı bulunmuyor.', 'kotu'); return; }
    if (durum === 'kayitsiz') { E.tost('Telefonuna önce bir parmak izi kaydetmelisin.', 'kotu'); return; }
    E.biyometrikSor(function (tamam) {
      if (!tamam) return;
      E.tercih('biyometrik', '1');
      E.tost('Biyometrik güvenlik aktifleştirildi yoldaş.', 'iyi');
      if (E.ekran === 'nizam') E.kabukYenile(true);
    });
  };
  E.is['eposta-tasdik'] = function () {
    var u = (E.oturum && E.oturum.user) || {};
    if (u.email_confirmed_at || u.confirmed_at) { E.tost('E-postan tasdikli.', 'iyi'); return; }
    return E.sb.auth.resend({ type: 'signup', email: u.email }).then(function (r) {
      if (r.error) throw r.error;
      E.tost('Tasdik bağlantısı e-postana gönderildi.', 'iyi');
    });
  };
  E.is['sifre-guncelle'] = function () {
    var p = E.katmanAc('<h3>Şifre Güncelle</h3><p>Yeni şifren en az 6 karakter olmalı.</p>' +
      '<input class="girdi" type="password" id="s1" placeholder="Yeni şifre" autocomplete="new-password">' +
      '<input class="girdi" type="password" id="s2" placeholder="Yeni şifre (tekrar)" autocomplete="new-password">' +
      '<div class="dgm"><button class="cerceve" data-is="katman-kapat">İptal</button><button class="dolu" data-is="sifre-kaydet">Güncelle</button></div>', 'pencere');
    setTimeout(function () { var g = E.$('#s1', p); if (g) g.focus(); }, 80);
  };
  E.is['sifre-kaydet'] = function (el) {
    var a = E.$('#s1').value, b = E.$('#s2').value;
    if (a.length < 6) { E.tost('Şifre en az 6 karakter olmalı.', 'kotu'); return; }
    if (a !== b) { E.tost('Şifreler birbirini tutmuyor.', 'kotu'); return; }
    el.disabled = true;
    return E.sb.auth.updateUser({ password: a }).then(function (r) {
      el.disabled = false;
      if (r.error) throw r.error;
      E.katmanKapat();
      E.tost('Şifren güncellendi.', 'iyi');
    }, function (h) { el.disabled = false; throw h; });
  };
  E.is.cikis = function () {
    return E.sor('Meclisten Ayrıl', 'Oturumun bu cihazda kapatılacak.', 'Çıkış Yap', true).then(function (evet) {
      if (evet) return E.cikisYap();
    });
  };
  E.is['hesap-sil'] = function () {
    return E.sor('Hesabımı Sil', 'Künyen, kelamların, mesajların ve heyben kalıcı olarak silinir. Bu işlem geri alınamaz.', 'Kalıcı Olarak Sil', true).then(function (evet) {
      if (!evet) return;
      return E.rpc('hesabimi_sil').then(function () {
        E.tost('Hesabın silindi. Yolun açık olsun yoldaş.');
        return E.cikisYap();
      });
    });
  };

  // ---------- Heybe ----------
  EKRAN.heybe = function (g) {
    g.innerHTML = '<div class="baslik cizgili">' + ikon('bag-personal') + '<div><h2>Heybe</h2><p>Sır gibi sakladığın kelamlar</p></div></div><div id="heybe-liste"></div>';
    E._heybeListe = E.kelamListe(E.$('#heybe-liste'), { kaynak: 'heybe' }, { bos: 'Heyben şu an boş yoldaş.', bosIkon: 'bag-personal-outline', kart: { muhurlu: true } });
  };

  // ---------- profilimi tazele ----------
  E.beniYenile = function () {
    return E.rpc('ben').then(function (b) {
      if (!b) return false;
      var eski = JSON.stringify(E.ben);
      E.ben = b;
      E.rozetCiz();
      return eski !== JSON.stringify(b);
    }).catch(function () { return false; });
  };
})();
