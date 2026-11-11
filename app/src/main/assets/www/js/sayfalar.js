// ERKAM — tam ekran sayfalar ve katmanlar: kelam, yoldaş profili, sohbet, ders, arama, bildirimler, yeni neşir
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  // ---------- Kelam (detay + cevaplar) ----------
  E.kelamSayfa = function (id) {
    var veri = null;
    var tanim = {
      ad: 'kelam', kelamId: id,
      html: E.sayfaBasligi('<div class="ad">Kelam</div>', '<button class="ikb" data-is="kelam-menu-ust" aria-label="Seçenekler">' + ikon('dots-vertical') + '</button>') +
        '<div class="ic"><div class="yukleniyor"><div class="cark"></div></div></div>' +
        '<div class="yaz-kap"><div class="kime" hidden></div><div class="yaz"><textarea rows="1" maxlength="500" placeholder="Cevabını nakşet..."></textarea><button aria-label="Gönder" disabled>' + ikon('send') + '</button></div></div>',
      kur: function (el) {
        var ic = E.$('.ic', el), alan = E.$('.yaz textarea', el), dgm = E.$('.yaz button', el), kime = E.$('.kime', el);
        function ciz() {
          ic.innerHTML = '<div style="height:20px"></div>' + E.kelamKart(veri.kelam, { acik: true }) +
            (veri.cevaplar.length ? '<div class="ara-bolum">CEVAPLAR</div>' + veri.cevaplar.map(function (c) { return E.kelamKart(c, { cevap: true, zamanUstte: true }); }).join('')
              : '<div class="bos-not" style="padding:30px">Henüz verilmiş bir cevap yok. İlk cevabı sen nakşet.</div>');
        }
        function yukle() {
          return E.rpc('kelam_detay', { p_id: id }).then(function (d) {
            if (!d || !d.kelam) { ic.innerHTML = '<div class="bos-not">' + ikon('alert-circle-outline') + 'Aradığın kelam mecliste bulunamadı.</div>'; E.$('.yaz-kap', el).hidden = true; return; }
            veri = d; tanim.veri = d; ciz();
            var y = d.kelam.yazar || {};
            kime.hidden = false;
            kime.innerHTML = ikon('forum-outline') + (E.ben && y.id === E.ben.id ? 'Kendi kelamına cevap' : '<b>@' + esc(y.kunye || '') + '</b> kelamına cevap');
          }).catch(function (h) { ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
        }
        tanim.yukle = yukle;
        alan.oninput = function () {
          dgm.disabled = !alan.value.trim();
          alan.style.height = 'auto'; alan.style.height = Math.min(alan.scrollHeight, 130) + 'px';
        };
        dgm.onclick = function () {
          var m = alan.value.trim();
          if (!m || !veri) return;
          dgm.disabled = true;
          E.rpc('kelam_nakset', { p_icerik: m, p_kategori: veri.kelam.kategori, p_muhurler: [], p_gorsel: null, p_ust: id }).then(function (c) {
            alan.value = ''; alan.style.height = 'auto';
            veri.cevaplar.push(c); veri.kelam.cevap_sayisi = (veri.kelam.cevap_sayisi || 0) + 1;
            ciz(); ic.scrollTop = ic.scrollHeight;
          }).catch(function (h) { dgm.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
        };
        tanim.odak = function () { alan.focus(); };
        yukle();
      }
    };
    E.sayfaAc(tanim);
  };
  E.is['cevap-odak'] = function () { var t = E.yigin[E.yigin.length - 1]; if (t && t.odak) t.odak(); };

  function kelamMenu(id, yazarId, ustSayfa) {
    var benim = E.ben && yazarId === E.ben.id, yonetim = E.ben && E.ben.rol === 'yonetim';
    var h = '<div class="yi" style="padding:10px 0 16px">';
    if (benim || yonetim) h += '<button class="secenek kirmizi" data-is="kelam-sil" data-id="' + id + '" data-ust="' + (ustSayfa ? 1 : 0) + '">' + ikon('delete-outline') + (benim ? 'Kelamı Sil' : 'Kelamı Kaldır (Yönetim)') + '</button>';
    if (!benim) h += '<button class="secenek" data-is="kelam-sikayet" data-id="' + id + '">' + ikon('flag-outline') + 'Şikâyet Et</button>';
    h += '<button class="secenek" data-is="katman-kapat">' + ikon('close') + 'Vazgeç</button></div>';
    E.katmanAc(h, 'yaprak kisa');
  }
  E.is['kelam-menu-ust'] = function () {
    var t = E.yigin[E.yigin.length - 1];
    if (!t || !t.veri) return;
    kelamMenu(t.veri.kelam.id, t.veri.kelam.yazar && t.veri.kelam.yazar.id, true);
  };
  E.is['kelam-menu'] = function (el) { kelamMenu(el.getAttribute('data-id'), el.getAttribute('data-yazar'), false); };
  E.is['kelam-sil'] = function (el) {
    var id = el.getAttribute('data-id'), ust = el.getAttribute('data-ust') === '1';
    E.katmanKapat();
    return E.sor('Kelamı Sil', 'Bu kelam ve altındaki cevaplar kalıcı olarak silinecek.', 'Sil', true).then(function (evet) {
      if (!evet) return;
      return E.rpc('kelam_sil', { p_id: id }).then(function (oldu) {
        if (!oldu) { E.tost('Kelam silinemedi.', 'kotu'); return; }
        E.tost('Kelam silindi.', 'iyi');
        if (ust) E.sayfaKapat();
        else { var t = E.yigin[E.yigin.length - 1]; if (t && t.yukle) t.yukle(); }
      });
    });
  };
  E.is['kelam-sikayet'] = function (el) {
    var id = el.getAttribute('data-id');
    E.katmanKapat();
    return E.sor('Şikâyet Et', 'Bu kelam, Adap ve Usul\'e aykırı olduğu gerekçesiyle yönetime bildirilecek.', 'Bildir', true).then(function (evet) {
      if (!evet) return;
      return E.rpc('sikayet_et', { p_kelam: id, p_sebep: 'Adap ve Usul\'e aykırı içerik' }).then(function () {
        E.tost('Şikâyetin yönetime ulaştı.', 'iyi');
      });
    });
  };

  // ---------- Yoldaş Profili ----------
  E.yoldasSayfa = function (kunye) {
    var p = null, durum = { sekme: 'kelam' };
    var tanim = {
      ad: 'yoldas',
      html: E.sayfaBasligi('<div class="ad">Yoldaş Profili</div>') + '<div class="ic"><div class="yukleniyor"><div class="cark"></div></div></div>',
      kur: function (el) {
        var ic = E.$('.ic', el);
        function ciz() {
          ic.innerHTML = E.profilGovde(p, false) + (p.gorebilir ? '<div class="pa"></div>'
            : '<div class="kilit">' + ikon('incognito-circle') + '<b>Bu yoldaşın kimliği izole.</b><br>Kelamlarını yalnızca tasdikli yoldaşları görür.</div>');
          if (p.gorebilir) E.profilSekmeleri(E.$('.pa', ic), p, false, durum);
        }
        function yukle() {
          return E.rpc('profil_getir', { p_kunye: kunye }).then(function (d) {
            if (!d) { ic.innerHTML = '<div class="bos-not">' + ikon('account-remove') + 'Yoldaş bulunamadı.</div>'; return; }
            p = d; tanim.profil = d; ciz();
          }).catch(function (h) { ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
        }
        tanim.yukle = yukle;
        yukle();
      }
    };
    E.sayfaAc(tanim);
  };
  E.is['yoldas-edin'] = function (el) {
    var id = el.getAttribute('data-id');
    el.disabled = true;
    return E.rpc('yoldas_degistir', { p_kisi: id }).then(function (r) {
      E.tost(r === 'onayli' ? 'Yoldaş edinildi.' : r === 'bekliyor' ? 'Yoldaşlık isteğin gönderildi.' : 'Yoldaşlık bırakıldı.', 'iyi');
      var t = E.yigin[E.yigin.length - 1];
      if (t && t.yukle) return t.yukle();
    }, function (h) { el.disabled = false; throw h; });
  };
  E.is['mesaj-yaz'] = function (el) {
    var t = E.yigin[E.yigin.length - 1];
    E.sohbetSayfa(t && t.profil ? t.profil : { id: el.getAttribute('data-id') });
  };

  // ---------- Sohbet ----------
  E.sohbetSayfa = function (kisi) {
    var mesajlar = [], zamanlayici = null, kapandi = false;
    var tanim = {
      ad: 'sohbet', kisiId: kisi.id,
      html: E.sayfaBasligi('<button class="ad" data-is="yoldas" data-kunye="' + esc(kisi.kunye || '') + '">' + E.avatar(kisi) + '<span>' + esc(kisi.isim || 'Yoldaş') +
        '<small>' + (kisi.kunye ? '@' + esc(kisi.kunye) : '') + '</small></span></button>') +
        '<div class="ic"><div class="yukleniyor"><div class="cark"></div></div></div>' +
        '<div class="yaz"><textarea rows="1" maxlength="2000" placeholder="Kelamını nakşet..."></textarea><button aria-label="Gönder" disabled>' + ikon('send') + '</button></div>',
      kur: function (el) {
        var ic = E.$('.ic', el), alan = E.$('.yaz textarea', el), dgm = E.$('.yaz button', el);
        function ciz(dibe) {
          if (!mesajlar.length) { ic.innerHTML = '<div class="bos-not">' + ikon('message-text-outline') + 'Selam ile başla yoldaş.</div>'; return; }
          var h = '', sonGun = '';
          mesajlar.forEach(function (m) {
            var g = E.gunAdi(m.olusturma);
            if (g !== sonGun) { h += '<div class="gun">' + esc(g) + '</div>'; sonGun = g; }
            h += '<div class="balon ' + (m.benden ? 'ben' : 'onlar') + '">' + esc(m.icerik) + '<small>' + E.saat(m.olusturma) + (m.benden && m.okundu ? ' · Okundu' : '') + '</small></div>';
          });
          var dipte = ic.scrollHeight - ic.scrollTop - ic.clientHeight < 80;
          ic.innerHTML = '<div class="balonlar">' + h + '</div>';
          if (dibe || dipte) ic.scrollTop = ic.scrollHeight;
        }
        function yukle(ilk) {
          return E.rpc('sohbet_getir', { p_kisi: kisi.id }).then(function (d) {
            if (kapandi || !d) return;
            if (d.kisi && !kisi.kunye) {
              kisi = d.kisi;
              var ad = E.$('.ust .ad', el);
              if (ad) { ad.setAttribute('data-kunye', kisi.kunye); ad.innerHTML = E.avatar(kisi) + '<span>' + esc(kisi.isim) + '<small>@' + esc(kisi.kunye) + '</small></span>'; }
            }
            var eski = mesajlar.length ? mesajlar[mesajlar.length - 1].id : 0, eskiOkundu = JSON.stringify(mesajlar.map(function (m) { return m.okundu; }));
            mesajlar = d.mesajlar || [];
            var yeni = mesajlar.length ? mesajlar[mesajlar.length - 1].id : 0;
            if (ilk || yeni !== eski || eskiOkundu !== JSON.stringify(mesajlar.map(function (m) { return m.okundu; }))) ciz(ilk || yeni !== eski);
          }).catch(function (h) { if (ilk) ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
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
          E.rpc('mesaj_gonder', { p_alici: kisi.id, p_icerik: m }).then(function (y) {
            alan.value = ''; alan.style.height = 'auto';
            mesajlar.push(y); ciz(true);
          }).catch(function (h) { dgm.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
        };
        yukle(true);
        // canlı bağlantı kopsa da sohbet güncel kalsın
        zamanlayici = setInterval(function () { if (!document.hidden) yukle(false); }, 7000);
      },
      kapaninca: function () {
        kapandi = true;
        clearInterval(zamanlayici);
        E.sohbetleriYukle();
        E.beniYenile();
      }
    };
    E.sayfaAc(tanim);
  };

  // yeni mesaj için yoldaş seç
  E.yoldasSec = function () {
    var y = E.katmanAc('<div class="yb"><h3>Yoldaş Seç</h3><button data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button></div>' +
      '<label class="ara-kutu" style="margin-top:18px">' + ikon('magnify') + '<input placeholder="Yoldaş ara..." autocomplete="off" autocapitalize="none"></label>' +
      '<div class="yi"><div class="bos-not">Mesaj göndermek istediğin yoldaşın adını ya da künyesini yaz.</div></div>');
    var g = E.$('input', y), kap = E.$('.yi', y), sayac = 0, bekle = null;
    g.oninput = function () {
      clearTimeout(bekle);
      var q = g.value.trim();
      if (q.length < 2) { kap.innerHTML = '<div class="bos-not">Mesaj göndermek istediğin yoldaşın adını ya da künyesini yaz.</div>'; return; }
      bekle = setTimeout(function () {
        var s = ++sayac;
        E.rpc('ara', { p_q: q }).then(function (d) {
          if (s !== sayac) return;
          var l = ((d && d.yoldaslar) || []).filter(function (k) { return k.id !== E.ben.id; });
          kap.innerHTML = l.length ? l.map(function (k) {
            return '<button class="kisi-satir" data-sec="' + esc(k.id) + '">' + E.avatar(k) + '<span><b>' + esc(k.isim) + '</b><span>@' + esc(k.kunye) + '</span></span></button>';
          }).join('') : '<div class="bos-not">Yoldaş bulunamadı.</div>';
          kap._liste = l;
        }).catch(function (h) { kap.innerHTML = '<div class="bos-not">' + esc(E.hataMetni(h)) + '</div>'; });
      }, 300);
    };
    kap.onclick = function (o) {
      var b = o.target.closest('[data-sec]');
      if (!b) return;
      var k = (kap._liste || []).filter(function (x) { return x.id === b.getAttribute('data-sec'); })[0];
      E.katmanKapat();
      if (k) E.sohbetSayfa(k);
    };
    setTimeout(function () { g.focus(); }, 120);
  };

  // ---------- Ders ----------
  E.dersSayfa = function (id) {
    var sonGonderilen = -1;
    E.sayfaAc({
      ad: 'ders',
      html: E.sayfaBasligi('<div class="ad">Suffe</div>') + '<div class="cubuk" style="border-radius:0;height:4px"><i style="width:0"></i></div>' +
        '<div class="ic"><div class="yukleniyor"><div class="cark"></div></div></div>',
      kur: function (el) {
        var ic = E.$('.ic', el), cubuk = E.$('.cubuk i', el), yuzde = 0;
        function ilerlet(y) {
          y = Math.max(yuzde, Math.min(100, Math.round(y)));
          if (y === yuzde && sonGonderilen >= 0) return;
          yuzde = y; cubuk.style.width = y + '%';
          if (y - sonGonderilen >= 10 || y === 100) {
            sonGonderilen = y;
            E.rpc('ders_ilerlet', { p_id: id, p_yuzde: y }).then(function () {
              (E.veri.suffe || []).forEach(function (d) { if (d.id === id) d.yuzde = Math.max(d.yuzde, y); });
            }).catch(function () { /* sonraki kaydırmada tekrar denenir */ });
          }
        }
        E.rpc('ders_getir', { p_id: id }).then(function (d) {
          if (!d) { ic.innerHTML = '<div class="bos-not">Ders bulunamadı.</div>'; return; }
          yuzde = d.yuzde || 0; cubuk.style.width = yuzde + '%';
          var h = '<div class="baslik" style="padding-bottom:6px"><span class="ikon-kutu">' + ikon(d.ikon) + '</span><div><h2 style="font-size:24px">' + esc(d.baslik) + '</h2><p>' + d.sure_dk + ' dk okuma</p></div></div><div class="okuma">';
          if (!String(d.icerik || '').trim()) {
            ic.innerHTML = h + '<div class="bos-not">' + ikon('book-open-variant') + 'Bu dersin içeriği yakında eklenecek yoldaş.</div></div>';
            return;
          }
          String(d.icerik || '').split(/\n\s*\n/).forEach(function (blok) {
            blok = blok.trim();
            if (!blok) return;
            var satirlar = blok.split('\n');
            if (/^##\s+/.test(satirlar[0])) { h += '<h3>' + esc(satirlar.shift().replace(/^##\s+/, '')) + '</h3>'; }
            if (satirlar.length) h += '<p>' + esc(satirlar.join(' ')) + '</p>';
          });
          h += '<div class="son">' + ikon('check-decagram') + ' Dersin sonuna geldin yoldaş. İlmini infak etmeyi unutma.</div></div>';
          ic.innerHTML = h;
          function olc() {
            var toplam = ic.scrollHeight - ic.clientHeight;
            ilerlet(toplam <= 8 ? 100 : (ic.scrollTop / toplam) * 100);
          }
          ic.onscroll = olc;
          setTimeout(olc, 400);
        }).catch(function (h) { ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
      },
      kapaninca: function () { if (E.ekran === 'suffe' && E._suffeCiz && E.$('#suffe-liste')) E._suffeCiz(); }
    });
  };

  // ---------- Arama ----------
  E.is.ara = function () { E.araSayfa(''); };
  E.araSayfa = function (ilk) {
    E.sayfaAc({
      ad: 'ara',
      html: '<div class="ust"><button class="ikb yesil" data-is="geri" aria-label="Geri">' + ikon('arrow-left') + '</button>' +
        '<input placeholder="Kelam, yoldaş veya mühür ara..." autocomplete="off" autocapitalize="none" value="' + esc(ilk || '') + '"></div><div class="ic"></div>',
      kur: function (el) {
        var g = E.$('input', el), ic = E.$('.ic', el), sayac = 0, bekle = null;
        function gundem() {
          ic.innerHTML = '<div class="yukleniyor"><div class="cark"></div></div>';
          var s = ++sayac;
          E.rpc('muhur_gundemi').then(function (d) {
            if (s !== sayac) return;
            d = d || [];
            ic.innerHTML = d.length ? '<div class="ara-bolum">MECLİSİN GÜNDEMİ</div><div class="muhur-liste">' + d.map(function (m) {
              return '<button class="muhur" data-is="muhur-ac" data-muhur="' + esc(m.muhur) + '">' + ikon('stamper') + esc(m.muhur) + ' · ' + m.sayi + '</button>';
            }).join('') + '</div>' : '<div class="bos-not">' + ikon('magnify') + 'Kelam, yoldaş veya mühür ara.</div>';
          }).catch(function () { if (s === sayac) ic.innerHTML = '<div class="bos-not">' + ikon('magnify') + 'Kelam, yoldaş veya mühür ara.</div>'; });
        }
        function ara() {
          var q = g.value.trim();
          if (q.length < 2) { gundem(); return; }
          var s = ++sayac;
          ic.innerHTML = '<div class="yukleniyor"><div class="cark"></div></div>';
          E.rpc('ara', { p_q: q }).then(function (d) {
            if (s !== sayac) return;
            d = d || {};
            var h = '';
            if (d.yoldaslar && d.yoldaslar.length) {
              h += '<div class="ara-bolum">YOLDAŞLAR</div>' + d.yoldaslar.map(function (k) {
                return '<button class="kisi-satir" data-is="yoldas" data-kunye="' + esc(k.kunye) + '">' + E.avatar(k) + '<span><b>' + esc(k.isim) + '</b><span>@' + esc(k.kunye) + '</span></span></button>';
              }).join('');
            }
            if (d.muhurler && d.muhurler.length) {
              h += '<div class="ara-bolum">MÜHÜRLER</div><div class="muhur-liste">' + d.muhurler.map(function (m) {
                return '<button class="muhur" data-is="muhur-ac" data-muhur="' + esc(m.muhur) + '">' + ikon('stamper') + esc(m.muhur) + ' · ' + m.sayi + '</button>';
              }).join('') + '</div>';
            }
            if (d.kelamlar && d.kelamlar.length) {
              h += '<div class="ara-bolum">KELAMLAR</div>' + d.kelamlar.map(function (k) { return E.kelamKart(k, { muhurlu: true }); }).join('');
            }
            ic.innerHTML = h || '<div class="bos-not">' + ikon('magnify') + 'Aradığın kelam mecliste bulunamadı.</div>';
          }).catch(function (h) { if (s === sayac) ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
        }
        g.oninput = function () { clearTimeout(bekle); bekle = setTimeout(ara, 320); };
        ara();
        if (!ilk) setTimeout(function () { g.focus(); }, 150);
      }
    });
  };
  E.muhurSayfa = function (muhur) {
    E.sayfaAc({
      ad: 'muhur',
      html: E.sayfaBasligi('<div class="ad">' + ikon('stamper') + esc(muhur) + '</div>') + '<div class="ic"><div style="height:20px"></div><div class="ml"></div></div>',
      kur: function (el) {
        E.kelamListe(E.$('.ml', el), { kaynak: 'muhur', metin: muhur }, { bos: 'Bu mühürle nakşedilmiş kelam yok.', kart: { muhurlu: true } });
      }
    });
  };

  // ---------- Bildirimler ----------
  var BILDIRIM = {
    hosgeldin: ['sari', 'shield-check', function () { return 'ERKAM ağına hoş geldin yoldaş!'; }],
    tasdik: ['yesil', 'star-crescent', function (k) { return k + ' kelamını tasdikledi.'; }],
    cevap: ['yesil', 'forum-outline', function (k) { return k + ' kelamına cevap verdi.'; }],
    etiket: ['mavi', 'at', function (k) { return k + ' seni bir kelamda etiketledi.'; }],
    yoldas: ['yesil', 'account-plus', function (k) { return k + ' seni yoldaş edindi.'; }],
    istek: ['sari', 'account-clock', function (k) { return k + ' yoldaşlık isteği gönderdi.'; }],
    kabul: ['yesil', 'account-check', function (k) { return k + ' yoldaşlık isteğini tasdikledi.'; }]
  };
  E.is.bildirimler = function () {
    var y = E.katmanAc('<div class="yb"><h3>Bildirimler</h3><button data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button></div>' +
      '<div class="yi"><div class="yukleniyor"><div class="cark"></div></div></div>');
    var kap = E.$('.yi', y);
    function yukle() {
      return E.rpc('bildirim_listesi', { p_limit: 50 }).then(function (d) {
        d = d || [];
        kap.innerHTML = d.length ? d.map(function (b) {
          var t = BILDIRIM[b.tur] || BILDIRIM.hosgeldin, k = b.kimden || {};
          return '<div class="bildirim' + (b.okundu ? '' : ' yeni') + '" data-tur="' + b.tur + '" data-kelam="' + esc(b.kelam_id || '') + '" data-kunye="' + esc(k.kunye || '') + '">' +
            '<span class="yuv ' + t[0] + '">' + ikon(t[1]) + '</span><div class="orta"><b>' + esc(t[2](k.isim || 'Bir yoldaş')) + '</b><span>' + esc(E.once(b.olusturma)) + '</span>' +
            (b.tur === 'istek' ? '<div class="ikili"><button class="dolu" data-istek="1" data-kisi="' + esc(k.id) + '">Tasdik Et</button><button class="cerceve" data-istek="0" data-kisi="' + esc(k.id) + '">Reddet</button></div>' : '') +
            '</div>' + (b.okundu ? '' : '<span class="nk"></span>') + '</div>';
        }).join('') : '<div class="bos-not">' + ikon('bell-outline') + 'Henüz bir bildirimin yok.</div>';
        if (d.some(function (b) { return !b.okundu; })) {
          E.rpc('bildirimleri_okundu').then(function () { E.ben.okunmamis_bildirim = 0; E.rozetCiz(); }).catch(function () { /* önemsiz */ });
        }
      }).catch(function (h) { kap.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
    }
    kap.onclick = function (o) {
      var ist = o.target.closest('[data-istek]');
      if (ist) {
        ist.disabled = true;
        E.rpc('istek_cevapla', { p_kisi: ist.getAttribute('data-kisi'), p_kabul: ist.getAttribute('data-istek') === '1' }).then(function () {
          E.tost(ist.getAttribute('data-istek') === '1' ? 'Yoldaşlık tasdik edildi.' : 'İstek reddedildi.', 'iyi');
          return yukle();
        }).catch(function (h) { ist.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
        return;
      }
      var s = o.target.closest('.bildirim');
      if (!s) return;
      var kelam = s.getAttribute('data-kelam'), kunye = s.getAttribute('data-kunye');
      E.katmanKapat();
      if (kelam) E.kelamSayfa(kelam);
      else if (kunye) E.yoldasSayfa(kunye);
    };
    yukle();
  };

  // ---------- Yeni Neşir ----------
  // Medya seçildiği an küçültülüp yüklenmeye başlar; Neşret'e basınca "nakşediliyor" ekranı kalanı bekler.
  E.is.nesret = function () {
    var kategori = 'ilim', medya = [], mesgul = false, naksedildi = false, sira = 0;
    var n = E.katmanAc('<div class="nb"><button class="kapat" data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button><h3>Yeni Neşir</h3>' +
      '<button class="gonder" disabled>Neşret</button></div><div class="cipler"></div>' +
      '<div class="nesir-ic"><textarea maxlength="600" placeholder="İlmini veya tecrübeni meclise nakşet..."></textarea><div class="oz"></div></div>' +
      '<label class="muhur-kutu">' + ikon('stamper') + '<span>Mühür:</span><input placeholder="Örn: sibergüvenlik, kpss" autocapitalize="none" autocomplete="off" maxlength="120"></label>' +
      '<div class="araclar"><button data-a="foto" aria-label="Fotoğraf ekle">' + ikon('image-plus') + '</button>' +
      '<button data-a="video" aria-label="Video ekle">' + ikon('video-plus') + '</button>' +
      '<button data-a="liste" aria-label="Liste">' + ikon('format-list-bulleted') + '</button><span class="say">0/500</span></div>', 'nesir');
    var alan = E.$('textarea', n), gonder = E.$('.gonder', n), say = E.$('.say', n), cip = E.$('.cipler', n), oz = E.$('.oz', n),
      muhur = E.$('.muhur-kutu input', n), btnFoto = E.$('[data-a="foto"]', n), btnVideo = E.$('[data-a="video"]', n);

    // katman kapanırsa: yarım kalan yüklemeleri durdur, yüklenenleri sil
    n.parentNode._kapaninca = function () {
      if (naksedildi) return;
      medya.forEach(function (m) {
        if (m.yukleme && m.yukleme.iptal) m.yukleme.iptal();
        if (m.tur === 'video') E.videoIptal(m.id);
      });
      E.dosyaSil([].concat.apply([], medya.map(function (m) { return [m.yol, m.kapak]; })));
    };

    function cipCiz() {
      cip.innerHTML = ['ilim', 'tecrube', 'infak', 'adap'].map(function (k) {
        return '<button class="cip' + (k === kategori ? ' aktif' : '') + '" data-kat="' + k + '">' + E.KATEGORI_AD[k] + '</button>';
      }).join('');
    }
    function durum() {
      var u = alan.value.trim().length;
      say.textContent = u + '/500';
      say.className = 'say' + (u > 500 ? ' fazla' : '');
      gonder.disabled = mesgul || u > 500 || (u < 1 && !medya.length) || medya.some(function (m) { return m.durum === 'hata'; });
      var video = medya.some(function (m) { return m.tur === 'video'; });
      btnFoto.disabled = video || medya.length >= E.FOTO_EN;
      btnVideo.disabled = medya.length > 0;
    }

    // ---- medya kutuları ----
    function halka(m) {
      if (m.durum === 'tamam') return '<span class="nm-ok">' + ikon('check') + '</span>';
      if (m.durum === 'hata') return '<span class="nm-o"><button class="nm-tekrar" data-tekrar="' + m.id + '">' + ikon('refresh') + 'Tekrar dene</button></span>';
      var y = genel(m);
      return '<span class="nm-o"><span class="ring" style="--p:' + y + '%"><i>' + (m.durum === 'hazirlaniyor' ? '' : '%' + y) + '</i></span></span>';
    }
    function medyaCiz() {
      if (!medya.length) { oz.innerHTML = ''; durum(); return; }
      var video = medya[0].tur === 'video';
      oz.innerHTML = '<div class="nm nm' + Math.min(medya.length, 4) + (video ? ' nm-v' : '') + '">' + medya.map(function (m) {
        return '<div class="nm-k" data-id="' + m.id + '">' + (m.onizleme ? '<img src="' + m.onizleme + '" alt="">' : '') +
          '<span class="nm-h">' + halka(m) + '</span>' +
          (m.tur === 'video' && m.sure ? '<span class="nm-s">' + ikon('video') + E.sureYaz(m.sure) + '</span>' : '') +
          '<button class="nm-x" data-sil="' + m.id + '" aria-label="Kaldır">' + ikon('close') + '</button></div>';
      }).join('') + '</div><div class="nm-not"></div>';
      notGuncelle();
      durum();
    }
    function medyaGuncelle(m) {
      var k = E.$('.nm-k[data-id="' + m.id + '"] .nm-h', oz);
      if (k) k.innerHTML = halka(m);
      notGuncelle();
      durum();
    }
    function notGuncelle() {
      var el = E.$('.nm-not', oz);
      if (!el) return;
      var v = medya.filter(function (m) { return m.tur === 'video'; })[0];
      var f = medya.filter(function (m) { return m.tur === 'foto' && m.sonra; });
      var t = '';
      if (v && v.durum === 'hata') t = v.mesaj || 'Video yüklenemedi.';
      else if (v && v.durum === 'sikistiriliyor') t = 'Video sıkıştırılıyor' + (v.once ? ': ' + E.boyutYaz(v.once) : '') + ' · %' + (v.yuzde || 0);
      else if (v && v.sonra) t = 'Video küçültüldü: ' + E.boyutYaz(v.once) + ' → ' + E.boyutYaz(v.sonra);
      else if (f.length) t = 'Görseller küçültüldü: ' + E.boyutYaz(toplam(f, 'once')) + ' → ' + E.boyutYaz(toplam(f, 'sonra'));
      el.textContent = t;
    }
    function toplam(l, a) { return l.reduce(function (s, m) { return s + (m[a] || 0); }, 0); }
    // bir medyanın genel ilerlemesi (0-100)
    function genel(m) {
      if (m.durum === 'tamam') return 100;
      if (m.tur === 'video') {
        if (m.durum === 'sikistiriliyor') return Math.round((m.yuzde || 0) * 0.5);
        if (m.durum === 'yukleniyor') return 50 + Math.round((m.yuzde || 0) * 0.5);
        return 0;
      }
      return m.durum === 'yukleniyor' ? (m.yuzde || 0) : 0;
    }

    function fotoEkle(dosya) {
      var m = { id: 'm' + (++sira), tur: 'foto', durum: 'hazirlaniyor', yuzde: 0, once: dosya.size };
      medya.push(m);
      medyaCiz();
      fotoIsle(m, dosya);
    }
    function fotoIsle(m, dosya) {
      m.durum = 'hazirlaniyor'; m.yuzde = 0; medyaGuncelle(m);
      E.fotoHazirla(dosya).then(function (r) {
        if (medya.indexOf(m) < 0) return;
        m.sonra = r.blob.size; m.g = r.g; m.y = r.y;
        if (!m.onizleme) { m.onizleme = URL.createObjectURL(r.blob); medyaCiz(); }
        m.yol = E.yeniYol('foto', 'jpg');
        m.durum = 'yukleniyor'; medyaGuncelle(m);
        m.yukleme = E.yukle(r.blob, m.yol, 'image/jpeg', function (y) { m.yuzde = y; medyaGuncelle(m); });
        return m.yukleme;
      }).then(function () {
        if (medya.indexOf(m) < 0) return;
        m.durum = 'tamam'; medyaGuncelle(m);
      }).catch(function (h) {
        if (medya.indexOf(m) < 0 || (h && h.message === 'iptal')) return;
        m.durum = 'hata'; m.mesaj = E.hataMetni(h); m.dosya = dosya; m.yol = null; medyaGuncelle(m);
        E.tost(m.mesaj, 'kotu');
      });
    }
    function videoEkle() {
      var m = { id: 'v' + Date.now().toString(36), tur: 'video', durum: 'seciliyor', yuzde: 0 };
      E.videoBaslat(m.id, function (o) {
        if (o.durum === 'iptal') { E.videoIptal(m.id); return; }
        if (o.durum === 'hata' && medya.indexOf(m) < 0) { E.videoIptal(m.id); E.tost(o.mesaj || 'Video eklenemedi.', 'kotu'); return; }
        if (o.durum === 'secildi') {
          m.sure = o.sure; m.g = o.g; m.y = o.y; m.once = o.boyut; m.onizleme = o.kapak; m.durum = 'sikistiriliyor';
          if (medya.indexOf(m) < 0) medya.push(m);
          medyaCiz();
          return;
        }
        if (medya.indexOf(m) < 0) return;
        if (o.durum === 'sikistiriliyor') { m.durum = 'sikistiriliyor'; m.yuzde = o.yuzde || 0; }
        else if (o.durum === 'sikistirildi') { m.sonra = o.boyut; m.durum = 'yukleniyor'; m.yuzde = 0; }
        else if (o.durum === 'yukleniyor') { m.durum = 'yukleniyor'; m.yuzde = o.yuzde || 0; }
        else if (o.durum === 'tamam') { m.durum = 'tamam'; m.yol = o.yol; m.kapak = o.kapak_yol; E.videoIptal(m.id); }
        else if (o.durum === 'hata') { m.durum = 'hata'; m.mesaj = o.mesaj; E.videoIptal(m.id); E.tost(o.mesaj || 'Video yüklenemedi.', 'kotu'); }
        medyaGuncelle(m);
      }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
    }

    oz.onclick = function (o) {
      var s = o.target.closest('[data-sil]');
      if (s) {
        var m = medya.filter(function (x) { return x.id === s.getAttribute('data-sil'); })[0];
        if (!m) return;
        if (m.yukleme && m.yukleme.iptal) m.yukleme.iptal();
        if (m.tur === 'video') E.videoIptal(m.id);
        E.dosyaSil([m.yol, m.kapak]);
        medya.splice(medya.indexOf(m), 1);
        medyaCiz();
        return;
      }
      var t = o.target.closest('[data-tekrar]');
      if (t) {
        var mt = medya.filter(function (x) { return x.id === t.getAttribute('data-tekrar'); })[0];
        if (!mt) return;
        if (mt.tur === 'foto' && mt.dosya) fotoIsle(mt, mt.dosya);
        else { medya.splice(medya.indexOf(mt), 1); medyaCiz(); videoEkle(); }
      }
    };

    cipCiz();
    durum();
    cip.onclick = function (o) { var b = o.target.closest('[data-kat]'); if (b) { kategori = b.getAttribute('data-kat'); cipCiz(); } };
    alan.oninput = durum;
    E.$('.araclar', n).onclick = function (o) {
      var b = o.target.closest('[data-a]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-a');
      if (a === 'liste') {
        var v = alan.value;
        alan.value = v + (v && !/\n$/.test(v) ? '\n' : '') + '• ';
        alan.focus(); durum();
      } else if (a === 'foto') {
        E.dosyalarSec('image/*', true).then(function (l) {
          var bos = E.FOTO_EN - medya.length;
          if (l.length > bos) E.tost('Bir kelama en fazla ' + E.FOTO_EN + ' fotoğraf eklenebilir.', 'kotu');
          l.slice(0, Math.max(0, bos)).forEach(fotoEkle);
        });
      } else if (a === 'video') {
        videoEkle();
      }
    };

    // ---- Neşret: nakşediliyor ekranı ----
    gonder.onclick = function () {
      if (mesgul) return;
      mesgul = true; durum();
      var muhurler = muhur.value.split(/[,\s]+/).map(function (m) { return m.replace(/^#/, '').trim(); }).filter(Boolean).slice(0, 5);
      var fotolar = medya.filter(function (m) { return m.tur === 'foto'; }), video = medya.filter(function (m) { return m.tur === 'video'; })[0];
      var ek = document.createElement('div');
      ek.className = 'naks';
      n.appendChild(ek);
      var adimlar = [];
      if (fotolar.length) adimlar.push('foto');
      if (video) adimlar.push('video');
      if (medya.length) adimlar.push('yukle');
      adimlar.push('muhur');
      ek.innerHTML = '<div class="naks-halka" style="--p:0%">' + ikon('star-crescent') + '</div><h3>Kelamın nakşediliyor</h3>' +
        '<div class="naks-adim">' + adimlar.map(function (a) { return '<div data-adim="' + a + '"></div>'; }).join('') + '</div><div class="naks-alt"></div>';
      var halkaEl = E.$('.naks-halka', ek), basamak = 0;
      function adim(ad, hal, metin) {
        var el = E.$('[data-adim="' + ad + '"]', ek);
        if (!el) return;
        el.className = hal;
        el.innerHTML = ikon(hal === 't' ? 'check-circle' : hal === 'su' ? 'rotate-right' : ad === 'muhur' ? 'stamper' : 'clock-outline') + '<span>' + esc(metin) + '</span>';
      }
      function ciz() {
        var tamamlanan = medya.length ? medya.reduce(function (s, m) { return s + genel(m); }, 0) / medya.length : 100;
        if (fotolar.length) {
          var hazir = fotolar.every(function (m) { return m.sonra; });
          adim('foto', hazir ? 't' : 'su', hazir ? 'Görseller küçültüldü (' + E.boyutYaz(toplam(fotolar, 'once')) + ' → ' + E.boyutYaz(toplam(fotolar, 'sonra')) + ')' : 'Görseller küçültülüyor');
        }
        if (video) {
          adim('video', video.sonra ? 't' : 'su', video.sonra ? 'Video sıkıştırıldı (' + E.boyutYaz(video.once) + ' → ' + E.boyutYaz(video.sonra) + ')' : 'Video sıkıştırılıyor %' + (video.yuzde || 0));
        }
        if (medya.length) adim('yukle', tamamlanan >= 100 ? 't' : 'su', tamamlanan >= 100 ? 'Yüklendi' : 'Yükleniyor %' + Math.round(tamamlanan));
        if (basamak === 0) adim('muhur', '', 'Mühür basılacak');
        halkaEl.style.setProperty('--p', Math.round((medya.length ? tamamlanan * 0.85 : 40)) + '%');
        return tamamlanan;
      }
      function vazgec(mesaj) {
        clearInterval(dongu);
        E.$('.naks-alt', ek).innerHTML = '<p>' + esc(mesaj) + '</p><button class="cerceve">Düzenlemeye dön</button>';
        E.$('.naks-alt button', ek).onclick = function () { ek.parentNode.removeChild(ek); mesgul = false; durum(); };
      }
      var dongu = setInterval(function () {
        if (medya.some(function (m) { return m.durum === 'hata'; })) { vazgec('Bir dosya yüklenemedi. Düzenlemeye dönüp tekrar dene ya da kaldır.'); return; }
        if (ciz() < 100 || basamak) return;
        basamak = 1;
        clearInterval(dongu);
        adim('muhur', 'su', 'Mühür basılıyor');
        E.rpc('kelam_nakset', {
          p_icerik: alan.value.trim(), p_kategori: kategori, p_muhurler: muhurler, p_gorsel: null, p_ust: null,
          p_medya: medya.map(function (m) { return { tur: m.tur, yol: m.yol, kapak: m.kapak || null, g: m.g || null, y: m.y || null, sure: m.sure || null }; })
        }).then(function (k) {
          naksedildi = true;
          adim('muhur', 't', 'Mühür basıldı');
          halkaEl.style.setProperty('--p', '100%');
          halkaEl.classList.add('bas');
          E.$('h3', ek).textContent = 'Kelamın nakşedildi';
          try { if (window.Android && Android.titret) Android.titret(25); } catch (e) { /* köprü yok */ }
          setTimeout(function () {
            E.katmanKapat();
            E.tumSayfalariKapat();
            if (E.ekran === 'sura' && E._suraListe && E.$('#sura-liste')) { E._suraListe.basaEkle(k); E.$('#govde').scrollTop = 0; }
            else E.git('sura');
          }, 950);
        }).catch(function (h) { vazgec(E.hataMetni(h)); });
      }, 150);
      ciz();
    };
    setTimeout(function () { alan.focus(); }, 150);
  };
})();
