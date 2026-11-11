// ERKAM — Yönetim Merkezi: genel bakış, şikâyetler, yoldaşlar, duyuru, Suffe dersleri
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  var SEKME = [['genel', 'view-dashboard-outline', 'Genel'], ['sikayet', 'flag-outline', 'Şikâyetler'],
    ['yoldas', 'account-group-outline', 'Yoldaşlar'], ['duyuru', 'bullhorn-outline', 'Duyuru'], ['suffe', 'book-open-variant', 'Suffe'], ['basvuru', 'gavel', 'KVKK']];
  var KAT = { siber: 'Siber Güvenlik', yazilim: 'Yazılım', adap: 'Adap' };

  function bos(ik, m) { return '<div class="bos-not">' + ikon(ik) + esc(m) + '</div>'; }
  function cark() { return '<div class="yukleniyor"><div class="cark"></div></div>'; }
  function hata(kap) { return function (h) { kap.innerHTML = bos('wifi-off', E.hataMetni(h)); }; }
  function sayi(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'B' : String(n); }
  function susturmaYazi(t) {
    if (!t) return '';
    var d = new Date(t);
    if (isNaN(d) || d.getFullYear() > 9000) return 'süresiz';
    return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + "'e kadar";
  }
  function rozetler(k) {
    var r = '';
    if (k.rol === 'yonetim') r += '<em class="yr y">Yönetim</em>';
    if (k.onayli) r += '<em class="yr o">' + E.rozet() + 'Onaylı</em>';
    if (k.susturma_bitis) r += '<em class="yr s">' + ikon('volume-off') + 'Susturuldu</em>';
    if (k.uzak) r += '<em class="yr u">' + ikon('shield-off-outline') + 'Uzak</em>';
    return r;
  }

  E.is['yonetim-ac'] = function () { E.cekmeceKapat(); E.yonetimSayfa('genel'); };

  E.yonetimSayfa = function (ilk) {
    var aktif = ilk || 'genel';
    var tanim = {
      ad: 'yonetim',
      html: '<div class="ym-ust"><div class="ym-isik"></div>' +
          '<button class="ym-geri" data-is="geri" aria-label="Geri">' + ikon('arrow-left') + '</button>' +
          '<div class="ym-bas"><span class="ym-kalkan">' + ikon('shield-crown-outline') + '</span>' +
          '<div><b>Yönetim Merkezi</b><small>Meclisin nabzı elinde</small></div></div>' +
          '<div class="ym-sekme">' + SEKME.map(function (s) {
            return '<button data-s="' + s[0] + '">' + ikon(s[1]) + s[2] + (s[0] === 'sikayet' ? '<i class="ym-say" hidden></i>' : s[0] === 'basvuru' ? '<i class="ym-say ym-say2"' + ((E.ben && E.ben.bekleyen_basvuru) ? '>' + E.ben.bekleyen_basvuru : ' hidden>') + '</i>' : '') + '</button>';
          }).join('') + '</div></div>' +
        '<div class="ic ym-ic"></div>',
      kur: function (el) {
        var ic = E.$('.ym-ic', el), sek = E.$('.ym-sekme', el);
        function rozet(n) {
          var r = E.$('.ym-say', el);
          r.hidden = !n; r.textContent = n > 99 ? '99+' : n;
        }
        rozet(E.ben && E.ben.bekleyen_sikayet);
        function ac(s) {
          aktif = s;
          [].forEach.call(sek.children, function (b) { b.classList.toggle('on', b.getAttribute('data-s') === s); });
          ic.scrollTop = 0;
          ic.innerHTML = cark();
          ({ genel: genel, sikayet: sikayet, yoldas: yoldaslar, duyuru: duyuru, suffe: suffe, basvuru: basvuru })[s](ic, rozet, ac);
        }
        sek.onclick = function (o) { var b = o.target.closest('[data-s]'); if (b) ac(b.getAttribute('data-s')); };
        tanim.donunce = function () { ac(aktif); };
        ac(aktif);
      }
    };
    E.sayfaAc(tanim);
  };

  // ---------- Genel bakış ----------
  function genel(ic, rozet, ac) {
    E.rpc('yonetim_ozet').then(function (o) {
      rozet(o.sikayet);
      var g = o.gunler || [], enc = 1;
      g.forEach(function (x) { enc = Math.max(enc, x.kelam, x.yoldas); });
      var GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      ic.innerHTML =
        '<div class="ym-kutular">' +
          kutu('account-group', 'Yoldaş', o.yoldas, o.yoldas_bugun ? '+' + o.yoldas_bugun + ' bugün' : 'bugün yeni yok', 'y1') +
          kutu('feather', 'Kelam', o.kelam, o.kelam_bugun ? '+' + o.kelam_bugun + ' bugün' : 'bugün yeni yok', 'y2') +
          kutu('flag', 'Bekleyen şikâyet', o.sikayet, o.sikayet ? 'incelenmeyi bekliyor' : 'her şey yolunda', o.sikayet ? 'y3 dikkat' : 'y3', 'sikayet') +
          kutu('bell-ring', 'Bildirim açık', o.cihaz, 'kayıtlı cihaz', 'y4') +
        '</div>' +
        '<div class="ym-satirlar">' +
          ufak('handshake-outline', 'Cevap', o.cevap) + ufak('message-text-outline', 'Bugün mesaj', o.mesaj_bugun) +
          ufak('volume-off', 'Susturulan', o.susturulan) + ufak('shield-off-outline', 'Uzaklaştırılan', o.uzak) +
        '</div>' +
        '<div class="ym-kart"><div class="ym-kb"><b>Son 7 gün</b><span><i class="n1"></i>Kelam<i class="n2"></i>Yeni yoldaş</span></div>' +
          '<div class="ym-grafik">' + g.map(function (x) {
            var d = new Date(x.gun + 'T12:00:00');
            return '<div class="ym-gun"><div class="ym-cubuk"><i class="c1" style="height:' + Math.round(x.kelam / enc * 100) + '%"><span>' + (x.kelam || '') + '</span></i>' +
              '<i class="c2" style="height:' + Math.round(x.yoldas / enc * 100) + '%"></i></div><small>' + GUN[d.getDay()] + '</small></div>';
          }).join('') + '</div></div>' +
        '<div class="ym-bolum">HIZLI İŞLEMLER</div><div class="ym-hizli">' +
          '<button data-h="duyuru">' + ikon('bullhorn-outline') + '<span>Duyuru gönder</span></button>' +
          '<button data-h="sikayet">' + ikon('flag-outline') + '<span>Şikâyetler</span></button>' +
          '<button data-h="suffe">' + ikon('book-plus-outline') + '<span>Ders ekle</span></button>' +
          '<button data-h="temizle">' + ikon('broom') + '<span>Depo temizliği</span></button>' +
        '</div>';
      ic.onclick = function (ev) {
        var b = ev.target.closest('[data-h]');
        if (!b) return;
        var h = b.getAttribute('data-h');
        if (h === 'temizle') {
          b.disabled = true;
          E.sb.functions.invoke('depo-temizle', { body: {} }).then(function (r) {
            b.disabled = false;
            if (r.error) throw r.error;
            E.tost((r.data && r.data.silinen) ? r.data.silinen + ' kullanılmayan dosya silindi.' : 'Depo temiz, silinecek dosya yok.', 'iyi');
          }).catch(function (h2) { b.disabled = false; E.tost(E.hataMetni(h2), 'kotu'); });
        } else ac(h);
      };
    }).catch(hata(ic));
    function kutu(ik, ad, n, alt, sinif, git) {
      return '<button class="ym-kutu ' + sinif + '"' + (git ? ' data-h="' + git + '"' : '') + '><span class="ym-ik">' + ikon(ik) + '</span>' +
        '<b>' + sayi(n) + '</b><span class="ym-ad">' + ad + '</span><small>' + esc(alt) + '</small></button>';
    }
    function ufak(ik, ad, n) { return '<div>' + ikon(ik) + '<b>' + sayi(n) + '</b><span>' + ad + '</span></div>'; }
  }

  // ---------- Şikâyetler ----------
  function sikayet(ic, rozet) {
    var durum = 'yeni';
    function yukle() {
      E.$('.ym-liste', ic).innerHTML = cark();
      E.rpc('yonetim_sikayetler', { p_durum: durum }).then(function (l) {
        if (durum === 'yeni') rozet(l.length);
        E.$('.ym-liste', ic).innerHTML = l.length ? l.map(kart).join('')
          : bos('shield-check-outline', durum === 'yeni' ? 'Bekleyen şikâyet yok. Meclis huzurlu.' : 'Burada şikâyet yok.');
      }).catch(hata(E.$('.ym-liste', ic)));
    }
    function kart(s) {
      var k = s.kelam, h = s.hedef || {}, b = s.bildiren || {};
      var medya = k && k.medya && k.medya.length ? '<span class="ym-medya">' + ikon(k.medya[0].tur === 'video' ? 'video-outline' : 'image-outline') +
        k.medya.length + ' medya</span>' : '';
      return '<div class="ym-sk' + (s.durum === 'yeni' ? ' yeni' : '') + '" data-id="' + s.id + '">' +
        '<div class="ym-skb">' + ikon('flag') + '<span><b>@' + esc(b.kunye || '?') + '</b> şikâyet etti · ' + esc(E.once(s.olusturma)) + '</span></div>' +
        '<div class="ym-sebep">' + esc(s.sebep) + '</div>' +
        (k ? '<div class="ym-onizle" data-kelam="' + esc(k.id) + '"><div class="ym-yazar">' + E.avatar(h) + '<b>' + esc(h.isim || '') + '</b><small>@' + esc(h.kunye || '') + '</small>' + rozetler(h) + '</div>' +
          '<p>' + esc(k.icerik || '') + '</p>' + medya + '</div>'
          : '<div class="ym-onizle silik">Kelam zaten kaldırılmış.</div>') +
        (s.durum === 'yeni' ? '<div class="ym-dgm">' +
          (k ? '<button class="kir" data-k="sil" data-kelam="' + esc(k.id) + '">' + ikon('delete-outline') + 'Kelamı kaldır</button>' : '') +
          (h.id ? '<button class="sar" data-k="sustur" data-kisi="' + esc(h.id) + '">' + ikon('volume-off') + 'Sustur</button>' : '') +
          '<button class="gri" data-k="yoksay">' + ikon('check') + (k ? 'Yoksay' : 'Kapat') + '</button></div>'
          : '<div class="ym-incelendi">' + ikon('check-circle') + 'İncelendi</div>') +
        '</div>';
    }
    ic.innerHTML = '<div class="ym-cipler">' + [['yeni', 'Bekleyen'], ['incelendi', 'İncelenen'], ['hepsi', 'Hepsi']].map(function (x) {
      return '<button data-d="' + x[0] + '"' + (x[0] === durum ? ' class="on"' : '') + '>' + x[1] + '</button>';
    }).join('') + '</div><div class="ym-liste"></div>';
    ic.onclick = function (o) {
      var c = o.target.closest('[data-d]');
      if (c) { durum = c.getAttribute('data-d'); [].forEach.call(c.parentNode.children, function (x) { x.classList.toggle('on', x === c); }); return yukle(); }
      var b = o.target.closest('[data-k]'), kart = o.target.closest('.ym-sk');
      if (b && kart) {
        var id = +kart.getAttribute('data-id'), k = b.getAttribute('data-k');
        var kapat = function () { return E.rpc('yonetim_sikayet_kapat', { p_id: id }).then(yukle); };
        if (k === 'yoksay') return kapat();
        if (k === 'sil') return E.sor('Kelamı Kaldır', 'Bu kelam ve cevapları kalıcı olarak silinecek, şikâyet kapanacak.', 'Kaldır', true).then(function (e) {
          if (e) return E.rpc('kelam_sil', { p_id: b.getAttribute('data-kelam') }).then(kapat).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
        });
        if (k === 'sustur') return susturSor(b.getAttribute('data-kisi')).then(function (r) { if (r) return kapat(); });
      }
      var on = o.target.closest('.ym-onizle[data-kelam]');
      if (on) E.kelamSayfa(on.getAttribute('data-kelam'));
    };
    yukle();
  }

  // Susturma süresi seç; sonuç (profil) ya da null
  function susturSor(kisi) {
    return new Promise(function (coz) {
      var p = E.katmanAc('<div class="ym-yb"><b>' + ikon('volume-off') + 'Ne kadar susturulsun?</b><small>Bu sürede kelam, cevap ve mesaj gönderemez. Kendisine bildirim gider.</small></div>' +
        '<div class="ym-sure">' + [[1, '1 saat'], [24, '1 gün'], [168, '7 gün'], [720, '30 gün'], [0, 'Süresiz']].map(function (x) {
          return '<button data-saat="' + x[0] + '">' + x[1] + '</button>';
        }).join('') + '</div><input class="ym-not" maxlength="120" placeholder="Sebep (isteğe bağlı, kendisine gösterilir)">' +
        '<button class="secenek" data-is="katman-kapat">' + ikon('close') + 'Vazgeç</button>', 'yaprak kisa');
      var bitti = false;
      p.parentNode._kapaninca = function () { if (!bitti) coz(null); };
      p.addEventListener('click', function (o) {
        var b = o.target.closest('[data-saat]');
        if (!b) return;
        var saat = +b.getAttribute('data-saat');
        b.disabled = true;
        E.rpc('yonetim_yoldas_islem', { p_kisi: kisi, p_islem: 'sustur', p_saat: saat || null, p_not: E.$('.ym-not', p).value || null }).then(function (r) {
          bitti = true; E.katmanKapat(); coz(r);
        }).catch(function (h) { b.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
      });
    });
  }

  // ---------- KVKK başvuruları ----------
  function basvuru(ic) {
    var durum = 'yeni';
    function gun(b) {
      var kalan = 30 - Math.floor((Date.now() - new Date(b.tarih).getTime()) / 864e5);
      return b.durum === 'yeni' ? '<em class="ym-kalan' + (kalan <= 7 ? ' acil' : '') + '">' + ikon('timer-sand') + (kalan > 0 ? kalan + ' gün kaldı' : 'süre doldu') + '</em>' : '';
    }
    function yukle() {
      var l = E.$('.ym-liste', ic);
      l.innerHTML = cark();
      E.rpc('yonetim_basvurular', { p_durum: durum }).then(function (r) {
        if (durum === 'yeni') { var z = E.$('.ym-say2'); if (z) { z.hidden = !r.length; z.textContent = r.length; } if (E.ben) E.ben.bekleyen_basvuru = r.length; }
        l.innerHTML = r.length ? r.map(function (b) {
          var k = b.kisi || {};
          return '<div class="ym-sk' + (b.durum === 'yeni' ? ' yeni' : '') + '" data-id="' + b.id + '">' +
            '<div class="ym-skb">' + ikon('gavel') + '<span><b>' + esc((E.KVKK_TUR || {})[b.tur] || b.tur) + '</b> · ' + esc(E.once(b.tarih)) + '</span>' + gun(b) + '</div>' +
            '<div class="ym-yazar">' + (k.id ? E.avatar(k) + '<b>' + esc(k.isim || '') + '</b><small>@' + esc(k.kunye || '') + '</small>' : '<b>Silinmiş hesap</b>') + '</div>' +
            (b.eposta ? '<div class="ym-eposta">' + ikon('email-outline') + esc(b.eposta) + '</div>' : '') +
            '<div class="ym-sebep">' + esc(b.metin) + '</div>' +
            (b.cevap ? '<div class="ym-cevap">' + ikon('reply-outline') + '<span>' + esc(b.cevap) + '</span></div>' : '') +
            (b.durum === 'yeni' ? '<div class="ym-dgm"><button class="yes" data-k="cevap">' + ikon('reply-outline') + 'Cevapla</button></div>' : '') + '</div>';
        }).join('') : bos('gavel', durum === 'yeni' ? 'Bekleyen KVKK başvurusu yok.' : 'Burada başvuru yok.');
      }).catch(hata(l));
    }
    ic.innerHTML = '<div class="ym-bilgi">' + ikon('information-outline') + '<span>KVKK başvuruları <b>en geç 30 gün</b> içinde cevaplanmalıdır. Cevabın yoldaşa bildirim olarak gider.</span></div>' +
      '<div class="ym-cipler">' + [['yeni', 'Bekleyen'], ['cevaplandi', 'Cevaplanan'], ['hepsi', 'Hepsi']].map(function (x) {
        return '<button data-d="' + x[0] + '"' + (x[0] === durum ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div><div class="ym-liste"></div>';
    ic.onclick = function (o) {
      var c = o.target.closest('[data-d]');
      if (c) { durum = c.getAttribute('data-d'); [].forEach.call(c.parentNode.children, function (x) { x.classList.toggle('on', x === c); }); return yukle(); }
      var b = o.target.closest('[data-k="cevap"]'), kart = o.target.closest('.ym-sk');
      if (!b || !kart) return;
      var id = +kart.getAttribute('data-id');
      var p = E.katmanAc('<div class="ym-yb"><b>' + ikon('reply-outline') + 'Başvuruyu cevapla</b><small>Cevabın yoldaşa bildirim olarak gider ve başvuru kapanır.</small></div>' +
        '<textarea class="girdi" id="ym-cvp" rows="6" maxlength="1500" placeholder="Örn: Verileriniz yalnızca hizmetin sunulması amacıyla Supabase ve Google ile paylaşılmaktadır..."></textarea>' +
        '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu" id="ym-cvp-g">Gönder</button></div>', 'yaprak kisa');
      E.$('#ym-cvp-g', p).onclick = function () {
        var g = this; g.disabled = true;
        E.rpc('yonetim_basvuru_cevapla', { p_id: id, p_cevap: E.$('#ym-cvp', p).value }).then(function () { E.katmanKapat(); yukle(); })
          .catch(function (h) { g.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
      };
    };
    yukle();
  }

  // ---------- Yoldaşlar ----------
  function yoldaslar(ic) {
    var filtre = 'hepsi', liste = [], z = 0, istek = 0;
    ic.innerHTML = '<label class="ara-kutu ym-ara">' + ikon('magnify') + '<input placeholder="İsim, künye ya da e-posta ara..." autocomplete="off"></label>' +
      '<div class="ym-cipler kay">' + [['hepsi', 'Hepsi'], ['yeni', 'Yeni'], ['susturulan', 'Susturulan'], ['uzak', 'Uzak'], ['yonetim', 'Yönetim'], ['onayli', 'Onaylı']].map(function (x) {
        return '<button data-f="' + x[0] + '"' + (x[0] === filtre ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div><div class="ym-liste"></div>';
    var girdi = E.$('input', ic), kap = E.$('.ym-liste', ic);
    function yukle() {
      var no = ++istek;
      kap.innerHTML = cark();
      E.rpc('yonetim_yoldaslar', { p_ara: girdi.value.trim() || null, p_filtre: filtre }).then(function (l) {
        if (no !== istek) return;
        liste = l;
        kap.innerHTML = l.length ? '<div class="ym-toplam">' + l.length + ' yoldaş</div>' + l.map(function (k) {
          return '<button class="ym-ys" data-id="' + esc(k.id) + '">' + E.avatar(k) +
            '<span class="ym-yo"><b>' + esc(k.isim) + '</b><small>@' + esc(k.kunye) + ' · ' + esc(k.eposta || '') + '</small>' +
            (rozetler(k) ? '<span class="ym-rz">' + rozetler(k) + '</span>' : '') + '</span>' +
            '<span class="ym-ks"><b>' + k.kelam_sayisi + '</b><small>kelam</small>' + (k.sikayet_sayisi ? '<em>' + ikon('flag') + k.sikayet_sayisi + '</em>' : '') + '</span></button>';
        }).join('') : bos('account-search-outline', 'Yoldaş bulunamadı.');
      }).catch(hata(kap));
    }
    girdi.oninput = function () { clearTimeout(z); z = setTimeout(yukle, 300); };
    ic.onclick = function (o) {
      var c = o.target.closest('[data-f]');
      if (c) { filtre = c.getAttribute('data-f'); [].forEach.call(c.parentNode.children, function (x) { x.classList.toggle('on', x === c); }); return yukle(); }
      var s = o.target.closest('.ym-ys');
      if (s) {
        var k = liste.filter(function (x) { return x.id === s.getAttribute('data-id'); })[0];
        if (k) yoldasDetay(k, yukle);
      }
    };
    yukle();
  }

  function yoldasDetay(k, yenile) {
    var ben = E.ben && E.ben.id === k.id;
    var tarih = function (t) { return t ? new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'; };
    var islemler = [
      ['profil', 'account-circle-outline', 'Profili gör', ''],
      k.susturma_bitis ? ['susturma_kaldir', 'volume-high', 'Susturmayı kaldır', ''] : (ben ? null : ['sustur', 'volume-off', 'Sustur', 'sar']),
      k.onayli ? ['onay_kaldir', 'check-decagram-outline', 'Onay rozetini kaldır', ''] : ['onay_ver', 'check-decagram', 'Onay rozeti ver', 'yes'],
      k.rol === 'yonetim' ? (ben ? null : ['yoldas_yap', 'shield-remove-outline', 'Yöneticilikten al', '']) : ['yonetici_yap', 'shield-crown-outline', 'Yönetici yap', ''],
      ben ? null : ['icerik_sil', 'delete-sweep-outline', 'Tüm kelamlarını sil', 'kir'],
      ben ? null : (k.uzak ? ['geri_al', 'account-reactivate-outline', 'Meclise geri al', 'yes'] : ['uzaklastir', 'shield-off-outline', 'Meclisten uzaklaştır', 'kir'])
    ].filter(Boolean);
    var p = E.katmanAc(
      '<div class="ym-dt"><div class="ym-dtb">' + E.avatar(k, 'ym-dav') + '<div><b>' + esc(k.isim) + E.rozetVar(k) + '</b>' +
        '<small>@' + esc(k.kunye) + '</small></div></div>' +
        (rozetler(k) ? '<div class="ym-rz">' + rozetler(k) + '</div>' : '') +
        (k.susturma_bitis ? '<div class="ym-uyar">' + ikon('volume-off') + 'Susturuldu: ' + esc(susturmaYazi(k.susturma_bitis)) + '</div>' : '') +
        '<div class="ym-bilgi">' +
          '<div><span>E-posta</span><b>' + esc(k.eposta || '—') + '</b></div>' +
          '<div><span>Katıldı</span><b>' + esc(tarih(k.olusturma)) + '</b></div>' +
          '<div><span>Son giriş</span><b>' + esc(k.son_giris ? E.once(k.son_giris) : '—') + '</b></div>' +
          '<div><span>Kelam / şikâyet</span><b>' + k.kelam_sayisi + ' / ' + k.sikayet_sayisi + '</b></div>' +
        '</div>' +
        '<div class="ym-isl">' + islemler.map(function (x) {
          return '<button class="' + x[3] + '" data-i="' + x[0] + '">' + ikon(x[1]) + '<span>' + x[2] + '</span></button>';
        }).join('') + '</div></div>', 'yaprak');
    var SOR = {
      icerik_sil: ['Tüm Kelamlarını Sil', '@' + k.kunye + ' adlı yoldaşın ' + k.kelam_sayisi + ' kelamı ve cevabı kalıcı olarak silinecek.', 'Sil'],
      uzaklastir: ['Meclisten Uzaklaştır', '@' + k.kunye + ' artık hiçbir şey paylaşamaz, kelamları kimseye görünmez ve uygulamaya giremez. İstediğin zaman geri alabilirsin.', 'Uzaklaştır'],
      yonetici_yap: ['Yönetici Yap', '@' + k.kunye + ' de Yönetim Merkezi\'ne erişecek; şikâyetleri görebilecek, yoldaşları susturup uzaklaştırabilecek.', 'Yönetici Yap'],
      yoldas_yap: ['Yöneticilikten Al', '@' + k.kunye + ' Yönetim Merkezi\'ne artık erişemeyecek.', 'Al']
    };
    p.addEventListener('click', function (o) {
      var b = o.target.closest('[data-i]');
      if (!b) return;
      var i = b.getAttribute('data-i');
      if (i === 'profil') { E.katmanKapat(); E.yoldasSayfa(k.kunye); return; }
      if (i === 'sustur') {
        E.katmanKapat();
        return susturSor(k.id).then(function (r) { if (r) { E.tost('@' + k.kunye + ' susturuldu.', 'iyi'); yenile(); } });
      }
      var sor = SOR[i] ? E.sor(SOR[i][0], SOR[i][1], SOR[i][2], i !== 'yonetici_yap') : Promise.resolve(true);
      sor.then(function (evet) {
        if (!evet) return;
        b.disabled = true;
        return E.rpc('yonetim_yoldas_islem', { p_kisi: k.id, p_islem: i }).then(function () {
          E.katmanKapat(); yenile();
        });
      }).catch(function (h) { b.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
    });
  }

  // ---------- Duyuru ----------
  function duyuru(ic) {
    ic.innerHTML = '<div class="ym-kart ym-dy"><div class="ym-kb"><b>' + ikon('bullhorn-outline') + 'Tüm meclise duyuru</b></div>' +
      '<textarea maxlength="600" rows="4" placeholder="Meclise duyurmak istediğin şeyi yaz..."></textarea>' +
      '<div class="ym-dyalt"><small><i>0</i>/600</small><button class="ym-gonder" disabled>' + ikon('send') + 'Gönder</button></div>' +
      '<div class="ym-onb"><span>Önizleme</span><div class="ym-bild"><span class="ym-bik">' + ikon('star-crescent') + '</span><div><b>ERKAM Duyurusu</b><p>Duyurun burada görünecek.</p></div></div></div></div>' +
      '<div class="ym-bolum">SON DUYURULAR</div><div class="ym-gecmis">' + cark() + '</div>';
    var a = E.$('textarea', ic), g = E.$('.ym-gonder', ic), sy = E.$('.ym-dyalt i', ic), on = E.$('.ym-bild p', ic);
    a.oninput = function () {
      var v = a.value.trim();
      sy.textContent = a.value.length; g.disabled = v.length < 3;
      on.textContent = v || 'Duyurun burada görünecek.';
    };
    function gecmis() {
      E.rpc('yonetim_duyurular').then(function (l) {
        E.$('.ym-gecmis', ic).innerHTML = l.length ? l.map(function (d) {
          return '<div class="ym-gd"><p>' + esc(d.metin) + '</p><small>' + esc(E.once(d.olusturma)) + ' · ' + d.kisi + ' yoldaşa gitti</small></div>';
        }).join('') : bos('bullhorn-outline', 'Henüz duyuru gönderilmedi.');
      }).catch(hata(E.$('.ym-gecmis', ic)));
    }
    g.onclick = function () {
      var v = a.value.trim();
      E.sor('Duyuruyu Gönder', 'Bu duyuru meclisteki herkese bildirim olarak gidecek; bildirimi açık olanların telefonuna da düşecek.', 'Gönder').then(function (evet) {
        if (!evet) return;
        g.disabled = true;
        return E.rpc('yonetim_duyuru', { p_metin: v }).then(function (n) {
          a.value = ''; a.oninput();
          E.tost('Duyuru ' + n + ' yoldaşa gönderildi.', 'iyi');
          gecmis();
        });
      }).catch(function (h) { g.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
    };
    gecmis();
  }

  // ---------- Suffe dersleri ----------
  function suffe(ic) {
    function yukle() {
      ic.innerHTML = cark();
      E.rpc('yonetim_dersler').then(function (l) {
        ic.innerHTML = '<button class="ym-yeni" data-d="yeni">' + ikon('plus') + 'Yeni ders ekle</button>' +
          (l.length ? l.map(function (d) {
            var dolu = String(d.icerik || '').trim().length;
            return '<button class="ym-ders" data-d="' + d.id + '"><span class="ym-dik">' + ikon(d.ikon || 'book-open-variant') + '</span>' +
              '<span class="ym-yo"><b>' + esc(d.baslik) + '</b><small>' + esc(KAT[d.kategori] || d.kategori) + ' · ' + d.sure_dk + ' dk · ' +
              (dolu ? Math.round(dolu / 5) + ' kelime' : 'içerik boş') + '</small></span>' +
              '<em class="yr ' + (d.yayinda ? 'o' : 's') + '">' + (d.yayinda ? 'Yayında' : 'Taslak') + '</em></button>';
          }).join('') : bos('book-open-variant', 'Henüz ders yok.'));
        ic.onclick = function (o) {
          var b = o.target.closest('[data-d]');
          if (!b) return;
          var id = b.getAttribute('data-d');
          dersDuzenle(id === 'yeni' ? null : l.filter(function (d) { return String(d.id) === id; })[0], yukle);
        };
      }).catch(hata(ic));
    }
    yukle();
  }

  function dersDuzenle(d, yenile) {
    d = d || { kategori: 'siber', baslik: '', ozet: '', icerik: '', sure_dk: 10, yayinda: true };
    var kat = d.kategori, yay = d.yayinda;
    E.sayfaAc({
      ad: 'ders-duzen',
      html: E.sayfaBasligi('<div class="ad">' + (d.id ? 'Dersi Düzenle' : 'Yeni Ders') + '</div>', '<button class="ym-kaydet">Kaydet</button>') +
        '<div class="ic ym-form">' +
          '<label>Kategori</label><div class="ym-cipler">' + Object.keys(KAT).map(function (k) {
            return '<button data-k="' + k + '"' + (k === kat ? ' class="on"' : '') + '>' + KAT[k] + '</button>';
          }).join('') + '</div>' +
          '<label>Başlık</label><input class="alan" id="d-baslik" maxlength="80" value="' + esc(d.baslik) + '" placeholder="Örn: Güçlü şifre nasıl oluşturulur?">' +
          '<label>Kısa özet</label><input class="alan" id="d-ozet" maxlength="160" value="' + esc(d.ozet) + '" placeholder="Ders kartında görünecek bir cümle">' +
          '<label>Okuma süresi (dakika)</label><input class="alan" id="d-sure" type="number" min="1" max="120" value="' + (d.sure_dk || 10) + '">' +
          '<label>İçerik</label><div class="ym-ipucu">' + ikon('information-outline') + '<span>Paragrafları boş bir satırla ayır. Alt başlık için satırın başına <b>## </b> yaz.</span></div>' +
          '<textarea class="alan ym-icerik" id="d-icerik" placeholder="## Giriş&#10;Dersin ilk paragrafı...">' + esc(d.icerik) + '</textarea>' +
          '<button class="ym-anahtar" data-y>' + E.$anahtar(yay) + '<span><b>Yayında</b><small>Kapalıysa taslak olarak kalır, yoldaşlar görmez</small></span></button>' +
          (d.id ? '<button class="ym-dsil">' + ikon('delete-outline') + 'Dersi sil</button>' : '') +
        '</div>',
      kur: function (el) {
        el.addEventListener('click', function (o) {
          var c = o.target.closest('[data-k]');
          if (c) { kat = c.getAttribute('data-k'); [].forEach.call(c.parentNode.children, function (x) { x.classList.toggle('on', x === c); }); return; }
          if (o.target.closest('[data-y]')) { yay = !yay; E.$('[data-y]', el).innerHTML = E.$anahtar(yay) + '<span><b>Yayında</b><small>Kapalıysa taslak olarak kalır, yoldaşlar görmez</small></span>'; return; }
          if (o.target.closest('.ym-dsil')) {
            return E.sor('Dersi Sil', '"' + d.baslik + '" dersi ve yoldaşların ilerlemesi silinecek.', 'Sil', true).then(function (e) {
              if (e) return E.rpc('yonetim_ders_sil', { p_id: d.id }).then(function () { E.sayfaKapat(); yenile(); });
            }).catch(function (h) { E.tost(E.hataMetni(h), 'kotu'); });
          }
          var kb = o.target.closest('.ym-kaydet');
          if (kb) {
            kb.disabled = true;
            E.rpc('yonetim_ders_kaydet', {
              p_id: d.id || null, p_kategori: kat, p_baslik: E.$('#d-baslik', el).value, p_ozet: E.$('#d-ozet', el).value,
              p_icerik: E.$('#d-icerik', el).value, p_sure: +E.$('#d-sure', el).value || 10, p_yayinda: yay
            }).then(function () { E.veri.suffe = null; E.sayfaKapat(); yenile(); E.tost('Ders kaydedildi.', 'iyi'); })
              .catch(function (h) { kb.disabled = false; E.tost(E.hataMetni(h), 'kotu'); });
          }
        });
      }
    });
  }
})();
