// ERKAM — İstişare (anket): kelamda ve meclis odalarında. Tasarım: "Hilal mühürlü"
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;
  E._istisare = {};

  function kalanYaz(bitis) {
    var ms = new Date(bitis).getTime() - Date.now();
    if (ms <= 0) return 'Sonuçlandı';
    var dk = Math.ceil(ms / 60000);
    if (dk < 60) return dk + ' dk kaldı';
    var sa = Math.round(dk / 60);
    if (sa < 24) return sa + ' saat kaldı';
    return Math.round(sa / 24) + ' gün kaldı';
  }

  // i: { id, secenekler, sayilar, toplam, benim, bitis, bitti, sahibim }
  E.istisareHtml = function (i) {
    if (!i || !i.id) return '';
    E._istisare[i.id] = i;
    var bitti = i.bitti || new Date(i.bitis).getTime() <= Date.now();
    var sonuc = bitti || i.benim != null || i.sahibim;
    var top = i.toplam || 0, enCok = Math.max.apply(null, (i.sayilar || [0]).concat([0]));
    var h = '<div class="istisare' + (sonuc ? ' sonuc' : '') + '" data-ist="' + esc(i.id) + '">';
    (i.secenekler || []).forEach(function (s, n) {
      var say = (i.sayilar || [])[n] || 0, yuzde = top ? Math.round(say * 100 / top) : 0;
      var sec = i.benim === n, onde = sonuc && bitti && say === enCok && say > 0;
      if (sonuc) {
        h += '<div class="ist-s' + (sec ? ' sec' : '') + (onde ? ' onde' : '') + '">' +
          '<span class="ist-rd">' + (sec ? ikon('star-crescent') : '') + '</span>' +
          '<span class="ist-et">' + esc(s) + '</span><b>%' + yuzde + '</b>' +
          '<span class="ist-cz"><i style="width:' + yuzde + '%"></i></span></div>';
      } else {
        h += '<button class="ist-s" data-is="istisare-oyla" data-id="' + esc(i.id) + '" data-s="' + n + '">' +
          '<span class="ist-rd"></span><span class="ist-et">' + esc(s) + '</span></button>';
      }
    });
    h += '<div class="ist-alt">' + ikon('account-group-outline') + top + ' oy · ' + ikon('timer-sand') + esc(kalanYaz(i.bitis)) +
      (!bitti && i.benim == null && i.sahibim ? ' · <span>Kendi istişarene oy veremezsin</span>' : '') + '</div></div>';
    return h;
  };

  E.is['istisare-oyla'] = function (el) {
    var id = el.getAttribute('data-id'), s = +el.getAttribute('data-s');
    var kap = el.closest('.istisare');
    if (kap) kap.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    el.classList.add('bekle');
    try { if (window.Android && Android.titret) Android.titret(15); } catch (e) { /* köprü yok */ }
    return E.rpc('istisare_oyla', { p_id: id, p_secim: s }).then(function (yeni) {
      if (!yeni) return;
      E.istisareGuncelle(yeni);
    }, function (h) {
      if (kap) kap.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
      el.classList.remove('bekle');
      throw h;
    });
  };

  // aynı istişareyi gösteren tüm kartları ve hafızadaki kopyaları tazele
  E.istisareGuncelle = function (yeni) {
    var html = E.istisareHtml(yeni);
    document.querySelectorAll('.istisare[data-ist="' + yeni.id + '"]').forEach(function (el) { el.outerHTML = html; });
    Object.keys(E._kelamVeri || {}).forEach(function (k) {
      var kv = E._kelamVeri[k];
      if (kv && kv.istisare && kv.istisare.id === yeni.id) kv.istisare = yeni;
    });
    if (E._istisareDinle) E._istisareDinle(yeni);
  };

  // ---------- düzenleyici (Neşret ve oda ortak) ----------
  var SURELER = [[24, '1 gün'], [72, '3 gün'], [168, '7 gün']];
  E.istisareDuzenleyici = function (kap, degisti) {
    var saat = 24;
    kap.innerHTML = '<div class="ist-d"><div class="ist-d-b">' + ikon('poll') + '<b>İstişare</b><button type="button" class="ist-d-x">Kaldır</button></div>' +
      '<div class="ist-d-l"></div>' +
      '<button type="button" class="ist-d-ekle">' + ikon('plus') + 'Seçenek ekle</button>' +
      '<div class="ist-d-sure"><span>Süre</span>' + SURELER.map(function (s) {
        return '<button type="button" data-saat="' + s[0] + '"' + (s[0] === saat ? ' class="acik"' : '') + '>' + s[1] + '</button>';
      }).join('') + '</div></div>';
    var liste = E.$('.ist-d-l', kap), ekle = E.$('.ist-d-ekle', kap);
    function satir(v) {
      var d = document.createElement('label');
      d.className = 'ist-d-s';
      d.innerHTML = '<span class="ist-rd"></span><input maxlength="60" placeholder="Seçenek ' + (liste.children.length + 1) + '">';
      E.$('input', d).value = v || '';
      E.$('input', d).oninput = function () { degisti && degisti(); };
      liste.appendChild(d);
      ekle.hidden = liste.children.length >= 4;
    }
    satir(); satir();
    ekle.onclick = function () { satir(); var l = liste.querySelectorAll('input'); l[l.length - 1].focus(); degisti && degisti(); };
    E.$('.ist-d-sure', kap).onclick = function (o) {
      var b = o.target.closest('[data-saat]'); if (!b) return;
      saat = +b.getAttribute('data-saat');
      E.$$('.ist-d-sure button', kap).forEach(function (x) { x.classList.toggle('acik', x === b); });
    };
    var api = {
      secenekler: function () {
        return [].map.call(liste.querySelectorAll('input'), function (i) { return i.value.trim(); }).filter(Boolean);
      },
      gecerli: function () {
        var l = api.secenekler();
        var tekil = l.filter(function (x, n) { return l.map(function (y) { return y.toLocaleLowerCase('tr'); }).indexOf(x.toLocaleLowerCase('tr')) === n; });
        return l.length >= 2 && tekil.length === l.length;
      },
      saat: function () { return saat; },
      kaldirinca: null
    };
    E.$('.ist-d-x', kap).onclick = function () { if (api.kaldirinca) api.kaldirinca(); };
    setTimeout(function () { var i = liste.querySelector('input'); if (i) i.focus(); }, 60);
    return api;
  };

  // ---------- meclis odasında istişare aç ----------
  E.odaIstisare = function (gonder) {
    var y = E.katmanAc('<div class="ist-oda"><h3>' + ikon('poll') + 'İstişare aç</h3>' +
      '<textarea class="girdi" rows="2" maxlength="200" placeholder="Meclise ne soruyorsun?"></textarea><div class="ist-kap"></div>' +
      '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu" disabled>Gönder</button></div></div>', 'yaprak');
    var soru = E.$('textarea', y), d = E.$('.dolu', y);
    function durum() { d.disabled = !soru.value.trim() || !ed.gecerli(); }
    var ed = E.istisareDuzenleyici(E.$('.ist-kap', y), durum);
    ed.kaldirinca = function () { E.katmanKapat(); };
    E.$('.ist-d-x', y).hidden = true;
    soru.oninput = durum;
    setTimeout(function () { soru.focus(); }, 120);
    d.onclick = function () {
      d.disabled = true;
      gonder(soru.value.trim(), ed.secenekler(), ed.saat()).then(function () { E.katmanKapat(); }, function () { durum(); });
    };
  };
})();
