// ERKAM — Meclis odaları: birkaç yoldaşın birlikte konuştuğu grup sohbetleri
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  function odaAvatar(o) {
    var u = (o.uyeler || []).slice(0, 3);
    if (!u.length) return '<span class="oda-av tek">' + ikon('account-group-outline') + '</span>';
    return '<span class="oda-av s' + u.length + '">' + u.map(function (k) { return E.avatar(k); }).join('') + '</span>';
  }

  // Mesajlar › Meclis Odaları listesi
  E.odaListesi = function (kap, q) {
    function ciz() {
      var l = (E.veri.odalar || []).filter(function (o) { return !q || o.ad.toLocaleLowerCase('tr').indexOf(q) !== -1; });
      if (!E.veri.odalar) { kap.innerHTML = '<div class="yukleniyor"><div class="cark"></div></div>'; return; }
      kap.innerHTML = l.length ? l.map(function (o) {
        var s = o.son || {};
        var son = s.tur === 'sistem' ? '<i>' + esc(s.icerik) + '</i>' : (s.benden ? 'Sen: ' : (s.isim ? esc(s.isim) + ': ' : '')) + esc(s.icerik || '');
        return '<div class="kart sohbet-satir oda-satir" data-is="oda-ac" data-id="' + esc(o.id) + '">' + odaAvatar(o) +
          '<div class="orta"><b>' + esc(o.ad) + '<small>' + o.uye_sayisi + ' yoldaş</small></b><span>' + son + '</span></div>' +
          '<div class="sag' + (o.okunmamis > 0 ? ' yeni' : '') + '">' + esc(E.kisaZaman(o.son_mesaj)) +
          (o.okunmamis > 0 ? '<span class="sayi">' + o.okunmamis + '</span>' : '') + '</div></div>';
      }).join('') : '<div class="oda-bos">' + ikon('account-group-outline') + '<b>' + (q ? 'Aradığın oda bulunamadı.' : 'Henüz bir meclis odan yok') + '</b>' +
        (q ? '' : '<span>Yoldaşlarınla bir oda kurup birlikte istişare et. Risale okumaları, ders halkaları, aile meclisi...</span>' +
        '<button class="dolu" data-is="oda-kur">' + ikon('account-multiple-plus-outline') + 'Meclis Odası Kur</button>') + '</div>';
    }
    ciz();
    E.rpc('odalarim').then(function (d) {
      E.veri.odalar = d || [];
      if (E.veri.mesajCip === 'meclis' && E.$('#mesaj-liste') === kap) ciz();
    }).catch(function (h) { if (!E.veri.odalar) kap.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
  };
  E.is['oda-ac'] = function (el) {
    var id = el.getAttribute('data-id');
    var o = (E.veri.odalar || []).filter(function (x) { return x.id === id; })[0];
    E.odaSayfa(id, o);
  };

  // ---------- Yoldaş seçici (oda kurma / üye ekleme) ----------
  function yoldasSecici(baslik, dugme, haric, bitti) {
    var secili = {}, liste = [];
    var y = E.katmanAc('<div class="yb"><h3>' + esc(baslik) + '</h3><button data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button></div>' +
      '<label class="ara-kutu" style="margin-top:14px">' + ikon('magnify') + '<input placeholder="Yoldaşlarında ara..." autocomplete="off" autocapitalize="none"></label>' +
      '<div class="ys-secili"></div><div class="yi ys-l"><div class="yukleniyor"><div class="cark"></div></div></div>' +
      '<div class="ys-alt"><button class="dolu" disabled>' + esc(dugme) + '</button></div>');
    var g = E.$('input', y), kap = E.$('.ys-l', y), sec = E.$('.ys-secili', y), b = E.$('.ys-alt button', y);
    function ciz() {
      var q = g.value.trim().toLocaleLowerCase('tr');
      var l = liste.filter(function (k) { return !q || (k.isim + ' ' + k.kunye).toLocaleLowerCase('tr').indexOf(q) !== -1; });
      kap.innerHTML = l.length ? l.map(function (k) {
        return '<button class="kisi-satir ys-k' + (secili[k.id] ? ' on' : '') + '" data-sec="' + esc(k.id) + '">' + E.avatar(k) +
          '<span><b>' + esc(k.isim) + E.rozetVar(k) + '</b><span>@' + esc(k.kunye) + '</span></span><i class="ys-t">' + ikon('check') + '</i></button>';
      }).join('') : '<div class="bos-not">' + (liste.length ? 'Bu isimde yoldaş yok.' : 'Odaya ekleyebilmek için önce yoldaş edinmelisin.') + '</div>';
      var s = Object.keys(secili);
      sec.innerHTML = s.map(function (id) { var k = secili[id]; return '<button data-cikar="' + esc(id) + '">' + E.avatar(k) + '<span>' + esc(k.isim.split(' ')[0]) + '</span>' + ikon('close') + '</button>'; }).join('');
      sec.hidden = !s.length;
      b.disabled = !s.length;
      b.textContent = dugme + (s.length ? ' (' + s.length + ')' : '');
    }
    // her iki yöndeki yoldaşları birleştir
    var ben = E.ben || {};
    Promise.all([
      E.rpc('yoldas_listesi', { p_kisi: ben.id, p_yon: 'edindigi', p_metin: null }).catch(function () { return []; }),
      E.rpc('yoldas_listesi', { p_kisi: ben.id, p_yon: 'yoldaslari', p_metin: null }).catch(function () { return []; })
    ]).then(function (r) {
      var gor = {};
      [].concat(r[0] || [], r[1] || []).forEach(function (k) {
        var p = k.profil || k;
        if (!p.id || gor[p.id] || p.id === ben.id || (haric && haric[p.id])) return;
        gor[p.id] = 1; liste.push(p);
      });
      liste.sort(function (a, b2) { return a.isim.localeCompare(b2.isim, 'tr'); });
      ciz();
    });
    g.oninput = ciz;
    kap.onclick = function (o) {
      var t = o.target.closest('[data-sec]'); if (!t) return;
      var id = t.getAttribute('data-sec'), k = liste.filter(function (x) { return x.id === id; })[0];
      if (secili[id]) delete secili[id]; else if (Object.keys(secili).length < 49) secili[id] = k;
      ciz();
    };
    sec.onclick = function (o) { var t = o.target.closest('[data-cikar]'); if (t) { delete secili[t.getAttribute('data-cikar')]; ciz(); } };
    b.onclick = function () { bitti(Object.keys(secili), b); };
  }

  // ---------- Oda kur ----------
  E.is['oda-kur'] = function () {
    var y = E.katmanAc('<div class="okr"><div class="okr-s">' + ikon('account-group-outline') + '</div><h3>Meclis Odası Kur</h3>' +
      '<p>Yoldaşlarınla birlikte konuşacağın bir oda. Odayı sen yönetirsin; yoldaş ekleyip çıkarabilirsin.</p>' +
      '<label class="emn-et">Odanın adı</label><input class="girdi okr-ad" maxlength="40" placeholder="Ör. Risale Okumaları">' +
      '<div class="okr-oneri">' + ['Risale Okumaları', 'Ders Halkası', 'Aile Meclisi', 'Siber Ekip'].map(function (x) { return '<button data-o="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu" disabled>Yoldaş Seç</button></div></div>', 'yaprak kisa');
    var ad = E.$('.okr-ad', y), d = E.$('.dgm .dolu', y);
    ad.oninput = function () { d.disabled = ad.value.trim().length < 2; };
    E.$('.okr-oneri', y).onclick = function (o) { var b = o.target.closest('[data-o]'); if (b) { ad.value = b.getAttribute('data-o'); ad.oninput(); } };
    setTimeout(function () { ad.focus(); }, 200);
    d.onclick = function () {
      var isim = ad.value.trim();
      E.katmanKapat();
      yoldasSecici('Odaya yoldaş ekle', 'Odayı Kur', null, function (uyeler, b) {
        b.disabled = true;
        E.rpc('oda_kur', { p_ad: isim, p_uyeler: uyeler }).then(function (id) {
          E.katmanKapat();
          E.veri.odalar = null;
          E.odaSayfa(id, { ad: isim });
        }).catch(function (h) { b.disabled = false; E.tost(h && String(h.message).indexOf('oda_cok') !== -1 ? 'En fazla 20 oda kurabilirsin.' : E.hataMetni(h), 'kotu'); });
      });
    };
  };

  // ---------- Oda sohbeti ----------
  E.odaSayfa = function (id, ozet) {
    var veri = null, zamanlayici = null, kapandi = false, mesajlar = [], kanal = null, canli = false, cekiliyor = false, sonCekim = 0;
    var tanim = {
      ad: 'oda', odaId: id,
      html: E.sayfaBasligi('<button class="ad oda-bas" data-is="oda-bilgi">' + odaAvatar(ozet || {}) + '<span>' + esc((ozet && ozet.ad) || 'Meclis Odası') + '<small>Meclis odası</small></span></button>',
          '<button class="ikb" data-is="oda-bilgi" aria-label="Oda bilgisi">' + ikon('information-outline') + '</button>') +
        '<div class="ic"><div class="yukleniyor"><div class="cark"></div></div></div>' +
        '<div class="yaz"><button class="yaz-ist" aria-label="İstişare aç">' + ikon('poll') + '</button><textarea rows="1" maxlength="2000" placeholder="Meclise kelamını söyle..."></textarea><button aria-label="Gönder" disabled>' + ikon('send') + '</button></div>',
      kur: function (el) {
        var ic = E.$('.ic', el), alan = E.$('.yaz textarea', el), dgm = E.$('.yaz button:last-child', el);
        E.$('.yaz-ist', el).onclick = function () {
          E.odaIstisare(function (soru, secenekler, saat) {
            return E.rpc('oda_mesaj_gonder', { p_oda: id, p_icerik: soru }).then(function (y) {
              return E.rpc('istisare_kur', { p_oda_mesaj: y.id, p_secenekler: secenekler, p_saat: saat }).then(function (i) {
                y.istisare = i;
                var var_ = mesajlar.filter(function (m) { return m.id === y.id; })[0];
                if (var_) var_.istisare = i; else ekle(y);
                ciz(true);
              }, function (h) { ekle(y); ciz(true); E.tost('İstişare açılamadı: ' + E.hataMetni(h), 'kotu'); });
            }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); throw h; });
          });
        };
        E._istisareDinle = function (yeni) {
          mesajlar.forEach(function (m) { if (m.istisare && m.istisare.id === yeni.id) m.istisare = yeni; });
        };
        function basCiz() {
          var o = veri.oda, b = E.$('.oda-bas', el);
          if (b) b.innerHTML = odaAvatar({ uyeler: (veri.uyeler || []).filter(function (k) { return k.id !== E.ben.id; }) }) +
            '<span>' + esc(o.ad) + '<small>' + (veri.uyeler || []).length + ' yoldaş</small></span>';
        }
        function ciz(dibe) {
          if (!mesajlar.length) { ic.innerHTML = '<div class="bos-not">' + ikon('account-group-outline') + 'Meclise ilk selamı sen ver.</div>'; return; }
          var h = '', sonGun = '', sonKisi = null;
          mesajlar.forEach(function (m) {
            var g = E.gunAdi(m.olusturma);
            if (g !== sonGun) { h += '<div class="gun">' + esc(g) + '</div>'; sonGun = g; sonKisi = null; }
            if (m.tur === 'sistem') { h += '<div class="oda-sis">' + esc(m.icerik) + '</div>'; sonKisi = null; return; }
            var k = m.kisi || {}, yeniKisi = sonKisi !== k.id;
            sonKisi = k.id;
            var ist = m.istisare ? '<span class="ist-soru">' + ikon('poll') + '</span>' : '';
            var govde = ist + esc(m.icerik) + (m.istisare ? E.istisareHtml(m.istisare) : '');
            var ak = m.istisare ? ' anketli' : '';
            if (m.benden) h += '<div class="balon ben' + ak + '">' + govde + '<small>' + E.saat(m.olusturma) + '</small></div>';
            else h += '<div class="oda-m' + (yeniKisi ? ' ilk' : '') + '">' + (yeniKisi ? '<button class="oda-mav" data-is="yoldas" data-kunye="' + esc(k.kunye || '') + '">' + E.avatar(k) + '</button>' : '<span class="oda-mav"></span>') +
              '<div class="balon onlar' + ak + '">' + (yeniKisi ? '<b class="oda-ki">' + esc(k.isim || 'Ayrılan yoldaş') + '</b>' : '') + govde + '<small>' + E.saat(m.olusturma) + '</small></div></div>';
          });
          var dipte = ic.scrollHeight - ic.scrollTop - ic.clientHeight < 80;
          ic.innerHTML = '<div class="balonlar">' + h + '</div>';
          if (dibe || dipte) ic.scrollTop = ic.scrollHeight;
        }
        function yukle(ilk) {
          return E.rpc('oda_getir', { p_oda: id, p_once: null, p_limit: 80 }).then(function (d) {
            if (kapandi || !d) return;
            veri = d; tanim.veri = d;
            var eski = mesajlar.length ? mesajlar[mesajlar.length - 1].id : 0;
            var imza = function (l) { return l.map(function (m) { return m.istisare ? m.istisare.toplam + ':' + m.istisare.benim : ''; }).join(','); };
            var eskiImza = imza(mesajlar);
            mesajlar = d.mesajlar || [];
            var yeni = mesajlar.length ? mesajlar[mesajlar.length - 1].id : 0;
            basCiz();
            if (ilk || yeni !== eski) ciz(ilk || yeni !== eski);
            else if (imza(mesajlar) !== eskiImza) ciz(false);
          }).catch(function (h) {
            if (String(h && h.message).indexOf('oda_yok') !== -1) { kapandi = true; clearInterval(zamanlayici); E.tost('Bu odada artık değilsin.', 'kotu'); E.sayfaKapat(); return; }
            if (ilk) ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>';
          });
        }
        // yalnızca son mesajdan sonrakileri çek (Realtime haberi ya da yedek yoklama)
        function ekle(y) {
          if (!y || mesajlar.some(function (m) { return m.id === y.id; })) return false;
          mesajlar.push(y); return true;
        }
        function yeniCek() {
          if (kapandi || cekiliyor) return Promise.resolve();
          cekiliyor = true; sonCekim = Date.now();
          var son = mesajlar.length ? mesajlar[mesajlar.length - 1].id : 0;
          return E.rpc('oda_yeni', { p_oda: id, p_sonra: son }).then(function (l) {
            cekiliyor = false;
            if (kapandi || !l || !l.length) return;
            var sistem = false, oldu = false;
            l.forEach(function (m) { if (ekle(m)) oldu = true; if (m.tur === 'sistem') sistem = true; });
            if (sistem) return yukle(false);   // üye ya da ad değişmiş olabilir
            if (oldu) ciz(true);
          }, function (h) {
            cekiliyor = false;
            if (String(h && h.message).indexOf('oda_yok') !== -1) { kapandi = true; E.tost('Bu odada artık değilsin.', 'kotu'); E.sayfaKapat(); }
          });
        }
        function abone() {
          if (!E.sb || !E.sb.channel) return;
          var kur = function () {
            if (kapandi) return;
            kanal = E.sb.channel('oda:' + id, { config: { private: true } })
              .on('broadcast', { event: 'mesaj' }, function () { yeniCek(); })
              .on('broadcast', { event: 'oy' }, function (o) {
                var ist = o && o.payload && o.payload.istisare;
                if (!ist) return;
                E.rpc('istisare_json', { p_id: ist }).then(function (y) { if (y && !kapandi) E.istisareGuncelle(y); }, function () { /* önemsiz */ });
              })
              .subscribe(function (durum) {
                var once = canli;
                canli = durum === 'SUBSCRIBED';
                if (canli && !once) yeniCek();   // bağlanana kadar kaçan olduysa
              });
          };
          try {
            var r = E.sb.realtime && E.sb.realtime.setAuth ? E.sb.realtime.setAuth() : null;
            if (r && r.then) r.then(kur, kur); else kur();
          } catch (e) { kur(); }
        }
        tanim.yenile = function () { return yukle(false); };
        alan.oninput = function () {
          dgm.disabled = !alan.value.trim();
          alan.style.height = 'auto'; alan.style.height = Math.min(alan.scrollHeight, 130) + 'px';
        };
        dgm.onclick = function () {
          var m = alan.value.trim();
          if (!m) return;
          dgm.disabled = true;
          E.rpc('oda_mesaj_gonder', { p_oda: id, p_icerik: m }).then(function (y) {
            alan.value = ''; alan.style.height = 'auto';
            ekle(y); ciz(true);
          }).catch(function (h) { dgm.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
        };
        yukle(true).then(abone);
        // yedek yoklama: canlı bağlantı varsa dakikada bir, yoksa 8 saniyede bir — yalnızca yeni mesajlar
        zamanlayici = setInterval(function () {
          if (document.hidden || kapandi) return;
          if (Date.now() - sonCekim >= (canli ? 60000 : 8000)) yeniCek();
        }, 4000);
        tanim._gorunur = function () { if (!document.hidden) yeniCek(); };
        document.addEventListener('visibilitychange', tanim._gorunur);
      },
      kapaninca: function () {
        kapandi = true;
        clearInterval(zamanlayici);
        if (tanim._gorunur) document.removeEventListener('visibilitychange', tanim._gorunur);
        if (kanal && E.sb && E.sb.removeChannel) { try { E.sb.removeChannel(kanal); } catch (e) { /* önemsiz */ } kanal = null; }
        E._istisareDinle = null;
        E.veri.odalar = null;
        if (E.ekran === 'mesajlar' && E._mesajCiz) E._mesajCiz();
        E.beniYenile();
      }
    };
    E.sayfaAc(tanim);
  };

  // ---------- Oda bilgisi: üyeler, ad değiştir, ayrıl ----------
  E.is['oda-bilgi'] = function () {
    var t = E.yigin[E.yigin.length - 1];
    if (!t || t.ad !== 'oda' || !t.veri) return;
    var d = t.veri, o = d.oda, kurucu = o.ben_kurucu;
    var y = E.katmanAc('<div class="obl"><div class="obl-b">' + odaAvatar({ uyeler: d.uyeler }) + '<h3>' + esc(o.ad) + '</h3><small>' + d.uyeler.length + ' yoldaş · ' +
        esc(new Date(o.olusturma).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })) + ' tarihinde kuruldu</small></div>' +
      (kurucu ? '<div class="obl-d"><button data-o="ekle">' + ikon('account-plus-outline') + 'Yoldaş Ekle</button><button data-o="ad">' + ikon('pencil-outline') + 'Adı Değiştir</button></div>' : '') +
      '<div class="bolum">ÜYELER</div><div class="obl-l">' + d.uyeler.map(function (k) {
        return '<div class="kisi-satir">' + E.avatar(k) + '<span><b>' + esc(k.isim) + E.rozetVar(k) + (k.id === E.ben.id ? ' <em>(sen)</em>' : '') + '</b><span>@' + esc(k.kunye) + '</span></span>' +
          (k.oda_rol === 'kurucu' ? '<i class="obl-r">Kurucu</i>' : kurucu ? '<button class="obl-x" data-cikar="' + esc(k.id) + '" data-ad="' + esc(k.isim) + '" aria-label="Çıkar">' + ikon('account-remove-outline') + '</button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<button class="obl-ayril" data-o="ayril">' + ikon('logout') + 'Odadan Ayrıl</button></div>', 'yaprak');
    y.onclick = function (ev) {
      var c = ev.target.closest('[data-cikar]');
      if (c) {
        var kid = c.getAttribute('data-cikar'), ad = c.getAttribute('data-ad');
        E.sor('Odadan çıkar', ad + ' meclis odasından çıkarılacak.', 'Çıkar', true).then(function (e) {
          if (!e) return;
          E.rpc('oda_uye_cikar', { p_oda: o.id, p_kisi: kid }).then(function () { E.katmanKapat(); t.yenile(); }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
        });
        return;
      }
      var b = ev.target.closest('[data-o]'); if (!b) return;
      var is = b.getAttribute('data-o');
      if (is === 'ayril') {
        E.sor('Odadan ayrıl', '"' + o.ad + '" odasından ayrılacaksın.' + (kurucu && d.uyeler.length > 1 ? ' Kuruculuk en eski üyeye geçecek.' : ''), 'Ayrıl', true).then(function (e) {
          if (!e) return;
          E.rpc('oda_ayril', { p_oda: o.id }).then(function () { E.katmanKapat(); E.sayfaKapat(); }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
        });
      } else if (is === 'ekle') {
        var haric = {}; d.uyeler.forEach(function (k) { haric[k.id] = 1; });
        E.katmanKapat();
        yoldasSecici('Yoldaş ekle', 'Ekle', haric, function (l, bt) {
          bt.disabled = true;
          E.rpc('oda_uye_ekle', { p_oda: o.id, p_kisiler: l }).then(function () { E.katmanKapat(); t.yenile(); }).catch(function (h) { bt.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
        });
      } else if (is === 'ad') {
        E.katmanKapat();
        var p = E.katmanAc('<div class="tdl"><div class="tdl-b">' + ikon('pencil-outline') + '<b>Odanın adı</b></div><input class="girdi" maxlength="40" value="' + esc(o.ad) + '">' +
          '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu">Kaydet</button></div></div>', 'yaprak kisa');
        E.$('.dolu', p).onclick = function () {
          E.rpc('oda_duzenle', { p_oda: o.id, p_ad: E.$('input', p).value }).then(function () { E.katmanKapat(); t.yenile(); }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
        };
      }
    };
  };
})();
