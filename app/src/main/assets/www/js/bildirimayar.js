// ERKAM — Bildirim ayarları: hangi bildirimler telefona gelsin
(function () {
  var E = window.E, ikon = E.ikon, esc = E.esc;
  var TURLER = [
    ['mesaj', 'message-text-outline', 'mavi', 'Mesajlar', 'Yoldaşlarından gelen mesajlar'],
    ['cevap', 'forum-outline', 'gok', 'Cevaplar ve etiketler', 'Kelamına cevap, seni anan kelamlar'],
    ['tasdik', 'star-crescent', 'yesil', 'Tasdikler', 'Kelamını tasdik edenler'],
    ['yoldas', 'account-plus', 'mor', 'Yoldaşlık', 'Yeni yoldaş ve istekler'],
    ['oda', 'account-group-outline', 'sari', 'Meclis odaları', 'Odalardaki yeni mesajlar'],
    ['duyuru', 'bullhorn-outline', 'kirmizi', 'ERKAM duyuruları', 'Yenilikler ve önemli haberler']
  ];
  function telefonAcik() { return E.tercih('bildirim') !== '0'; }

  E.is['bildirim-ayar-ac'] = function () {
    var tercih = null;
    var tanim = {
      ad: 'bildirim-ayar',
      html: E.sayfaBasligi('<div class="ad">Bildirim Ayarları</div>') + '<div class="ic ba"><div class="yukleniyor"><div class="cark"></div></div></div>',
      kur: function (el) {
        var ic = E.$('.ic', el);
        function ciz() {
          var tel = telefonAcik();
          ic.innerHTML = '<div class="bolum">GENEL</div><div class="grup">' +
            '<button class="satir ba-s" data-ba="telefon"><span class="ba-ik koyu">' + ikon('bell-ring-outline') + '</span>' +
            '<span class="orta"><b>Telefon bildirimleri</b><span>Hepsini birden aç / kapat</span></span>' + E.$anahtar(tel) + '</button></div>' +
            '<div class="bolum">NE ZAMAN HABER VERELİM?</div><div class="grup' + (tel ? '' : ' ba-kapali') + '">' +
            TURLER.map(function (t) {
              var acik = tercih[t[0]] !== false;
              return '<button class="satir ba-s" data-ba="' + t[0] + '"' + (tel ? '' : ' disabled') + '><span class="ba-ik ' + t[2] + '">' + ikon(t[1]) + '</span>' +
                '<span class="orta"><b>' + t[3] + '</b><span>' + t[4] + '</span></span>' + E.$anahtar(acik) + '</button>';
            }).join('') + '</div>' +
            '<div class="ba-not">' + ikon('information-outline') + '<span>' + (tel
              ? 'Kapattığın türler uygulamanın içindeki Bildirimler listesinde yine görünür; sadece telefonuna haber gelmez.'
              : 'Telefon bildirimleri kapalı. Türleri seçmek için önce yukarıdan aç.') + '</span></div>';
        }
        ic.onclick = function (o) {
          var s = o.target.closest('[data-ba]');
          if (!s || s.disabled) return;
          var tur = s.getAttribute('data-ba');
          if (tur === 'telefon') { E.is['ayar-bildirim'](); ciz(); return; }
          var yeni = tercih[tur] === false;
          tercih[tur] = yeni; ciz();
          E.rpc('bildirim_tercih_kaydet', { p_tur: tur, p_acik: yeni }).then(function (t) { if (t) tercih = t; })
            .catch(function (h) { tercih[tur] = !yeni; ciz(); E.tost(E.hataMetni(h), 'kotu'); });
        };
        function yukle() {
          return E.rpc('bildirim_tercihlerim').then(function (t) { tercih = t || {}; ciz(); },
            function (h) { ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
        }
        tanim.yukle = yukle;
        yukle();
      }
    };
    E.sayfaAc(tanim);
  };
})();
