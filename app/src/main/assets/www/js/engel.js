// ERKAM — Engelleme ve sessize alma (Meclis huzuru)
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  function yenile() {
    try { E.kabukYenile(true); } catch (e) { /* önemsiz */ }
    var t = E.yigin[E.yigin.length - 1];
    if (t && t.yukle) t.yukle();
  }

  // kisi: {id, isim, kunye}; durum: engel_durumu sonucu (yoksa sorulur)
  E.engelMenu = function (kisi, durum) {
    if (!kisi || !kisi.id || (E.ben && kisi.id === E.ben.id)) return;
    function ac(d) {
      var ad = esc(kisi.isim || ('@' + (kisi.kunye || 'yoldaş')));
      var h = '<div class="yi" style="padding:10px 0 16px"><div class="eng-bas">' + E.avatar(kisi) + '<span><b>' + ad + '</b>' + (kisi.kunye ? '<small>@' + esc(kisi.kunye) + '</small>' : '') + '</span></div>';
      if (d.ben === 'sessiz') h += '<button class="secenek" data-is="engel-kaldir" data-id="' + esc(kisi.id) + '">' + ikon('volume-high') + 'Sessizden Çıkar<small>Kelamları yeniden görünür</small></button>';
      else if (d.ben !== 'engel') h += '<button class="secenek" data-is="engel-yap" data-tur="sessiz" data-id="' + esc(kisi.id) + '">' + ikon('volume-off') + 'Sessize Al<small>Kelamlarını görmezsin, o bilmez</small></button>';
      if (d.ben === 'engel') h += '<button class="secenek" data-is="engel-kaldir" data-id="' + esc(kisi.id) + '">' + ikon('account-lock-open-outline') + 'Engeli Kaldır<small>Yeniden görüşürsünüz</small></button>';
      else h += '<button class="secenek kirmizi" data-is="engel-yap" data-tur="engel" data-id="' + esc(kisi.id) + '">' + ikon('account-cancel-outline') + 'Engelle<small>Birbirinizi göremezsiniz</small></button>';
      h += '<button class="secenek" data-is="katman-kapat">' + ikon('close') + 'Vazgeç</button></div>';
      E._engelKisi = kisi;
      E.katmanAc(h, 'yaprak kisa');
    }
    if (durum) return ac(durum);
    E.rpc('engel_durumu', { p_kisi: kisi.id }).then(function (d) { ac(d || {}); }, function () { ac({}); });
  };

  E.is['engel-yap'] = function (el) {
    var id = el.getAttribute('data-id'), tur = el.getAttribute('data-tur'), kisi = E._engelKisi || { id: id };
    var ad = kisi.isim || 'bu yoldaşı';
    function yap() {
      return E.rpc('engelle', { p_kisi: id, p_tur: tur }).then(function () {
        E.katmanKapat();
        E.tost(tur === 'engel' ? ad + ' engellendi.' : ad + ' sessize alındı.', 'iyi');
        yenile();
      });
    }
    if (tur !== 'engel') return yap();
    E.katmanKapat();
    return E.sor(ad + ' engellensin mi?', 'Birbirinizin kelamlarını göremez, mesajlaşamaz ve aynı meclis odasına eklenemezsiniz. Varsa yoldaşlığınız sona erer. Engeli istediğin zaman Nizam › Meclis Huzuru bölümünden kaldırabilirsin.', 'Engelle', true).then(function (evet) { if (evet) return yap(); });
  };

  E.is['engel-kaldir'] = function (el) {
    var id = el.getAttribute('data-id');
    return E.rpc('engel_kaldir', { p_kisi: id }).then(function () {
      E.katmanKapat();
      E.tost('Kaldırıldı.', 'iyi');
      var t = E.yigin[E.yigin.length - 1];
      if (t && t.ad === 'engeller' && t.yukle) t.yukle();
      yenile();
    });
  };

  E.is['yoldas-menu'] = function () {
    var t = E.yigin[E.yigin.length - 1];
    if (t && t.profil) E.engelMenu(t.profil, t.profil.engel);
  };

  // ---------- Engellenenler ve sessize alınanlar ----------
  E.is['engeller-ac'] = function () {
    var tanim = {
      ad: 'engeller',
      html: E.sayfaBasligi('<div class="ad">Meclis Huzuru</div>') + '<div class="ic eng"><div class="yukleniyor"><div class="cark"></div></div></div>',
      kur: function (el) {
        var ic = E.$('.ic', el);
        function yukle() {
          return E.rpc('engellerim').then(function (l) {
            l = l || [];
            var bilgi = '<div class="eng-bilgi">' + ikon('shield-account-outline') + '<span><b>Sessize al:</b> kelamlarını ve bildirimlerini görmezsin, o bunu bilmez.<br><b>Engelle:</b> birbirinizi göremez, mesajlaşamazsınız.</span></div>';
            if (!l.length) { ic.innerHTML = bilgi + '<div class="bos-not">' + ikon('emoticon-happy-outline') + 'Kimseyi engellemedin ya da sessize almadın.</div>'; return; }
            ic.innerHTML = bilgi + ['engel', 'sessiz'].map(function (tur) {
              var g = l.filter(function (k) { return k.tur === tur; });
              if (!g.length) return '';
              return '<div class="bolum">' + (tur === 'engel' ? 'ENGELLENENLER' : 'SESSİZE ALINANLAR') + ' · ' + g.length + '</div><div class="grup">' + g.map(function (k) {
                return '<div class="satir eng-s">' + E.avatar(k) + '<span class="orta"><b>' + esc(k.isim) + '</b><span>@' + esc(k.kunye) + '</span></span>' +
                  '<button class="cerceve kucuk" data-is="engel-kaldir" data-id="' + esc(k.id) + '">' + (tur === 'engel' ? 'Engeli kaldır' : 'Sessizden çıkar') + '</button></div>';
              }).join('') + '</div>';
            }).join('');
          }, function (h) { ic.innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
        }
        tanim.yukle = yukle;
        yukle();
      }
    };
    E.sayfaAc(tanim);
  };
})();
