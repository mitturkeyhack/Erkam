// ERKAM — medya: fotoğraf küçültme, ilerlemeli yükleme, video (telefonda sıkıştırma), kelamda gösterme ve tam ekran izleme
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;

  E.FOTO_EN = 4;          // bir kelamda en fazla fotoğraf
  E.VIDEO_SN = 60;        // en uzun video (saniye)
  E.VIDEO_MB = 50;        // depo sınırı (MB)
  E._medya = {};          // kelam id -> medya listesi (tam ekran izleyici için)

  E.boyutYaz = function (b) {
    if (!b && b !== 0) return '';
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
    return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',') + ' MB';
  };
  E.sureYaz = function (sn) {
    sn = Math.max(0, Math.round(+sn || 0));
    return Math.floor(sn / 60) + ':' + (sn % 60 < 10 ? '0' : '') + (sn % 60);
  };

  // ---------- dosya seçme (çoklu) ----------
  E.dosyalarSec = function (tur, coklu) {
    return new Promise(function (coz) {
      var g = document.createElement('input');
      g.type = 'file'; g.accept = tur || 'image/*'; g.multiple = !!coklu; g.style.display = 'none';
      var bitti = false;
      function son(l) { if (bitti) return; bitti = true; coz(l); if (g.parentNode) g.parentNode.removeChild(g); }
      g.onchange = function () { son(Array.prototype.slice.call(g.files || [])); };
      g.addEventListener('cancel', function () { son([]); });
      document.body.appendChild(g);
      g.click();
    });
  };

  // ---------- fotoğraf: en uzun kenar 1600 px, JPEG ----------
  E.fotoHazirla = function (dosya) {
    return new Promise(function (coz, red) {
      if (!dosya || !/^image\//.test(dosya.type || '')) return red(new Error('Bu dosya bir görsel değil.'));
      var url = URL.createObjectURL(dosya);
      var img = new Image();
      img.onload = function () {
        var o = Math.min(1, 1600 / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * o)), h = Math.max(1, Math.round(img.height * o));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? coz({ blob: b, g: w, y: h }) : red(new Error('Görsel işlenemedi.')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Bu görsel açılamadı. Başka bir fotoğraf dene.')); };
      img.src = url;
    });
  };

  // ---------- ilerlemeli yükleme ----------
  E.yukle = function (blob, yol, tur, ilerle) {
    var x = new XMLHttpRequest();
    var p = E.sb.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      if (!t) throw new Error('giris_gerekli');
      return new Promise(function (coz, red) {
        x.open('POST', E.ayar.url + '/storage/v1/object/gorseller/' + yol.split('/').map(encodeURIComponent).join('/'));
        x.setRequestHeader('Authorization', 'Bearer ' + t);
        x.setRequestHeader('apikey', E.ayar.anahtar);
        x.setRequestHeader('Content-Type', tur);
        x.upload.onprogress = function (o) { if (o.lengthComputable && ilerle) ilerle(Math.min(99, Math.round(o.loaded * 100 / o.total))); };
        x.onload = function () {
          if (x.status >= 200 && x.status < 300) { if (ilerle) ilerle(100); coz(yol); }
          else {
            var m = '';
            try { m = JSON.parse(x.responseText).message || ''; } catch (e) { m = (x.responseText || '').slice(0, 80); }
            red(new Error('Yükleme başarısız (' + x.status + (m ? ': ' + m : '') + ')'));
          }
        };
        x.onerror = function () { red(new Error('Failed to fetch')); };
        x.onabort = function () { red(new Error('iptal')); };
        x.send(blob);
      });
    });
    p.iptal = function () { try { x.abort(); } catch (e) { /* zaten bitti */ } };
    return p;
  };
  E.dosyaSil = function (yollar) {
    yollar = (yollar || []).filter(Boolean);
    if (!yollar.length) return Promise.resolve();
    return E.sb.storage.from('gorseller').remove(yollar).catch(function () { /* önemsiz */ });
  };
  E.yeniYol = function (ad, uzanti) {
    return E.ben.id + '/' + ad + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.' + uzanti;
  };

  // ---------- video ----------
  // Telefonda: Android köprüsü videoyu seçer, 720p'ye sıkıştırır ve yükler; olaylar window.E_video'ya gelir.
  // Köprü yoksa (tarayıcı): video olduğu gibi yüklenir.
  var videoDinleyici = {};
  window.E_video = function (o) {
    var f = o && videoDinleyici[o.id];
    if (f) f(o);
  };
  E.videoBaslat = function (id, dinle) {
    videoDinleyici[id] = dinle;
    var k = window.Android;
    if (k && k.videoSec) {
      return E.sb.auth.getSession().then(function (r) {
        var t = r && r.data && r.data.session && r.data.session.access_token;
        if (!t) throw new Error('giris_gerekli');
        k.videoSec(JSON.stringify({ id: id, url: E.ayar.url, anahtar: E.ayar.anahtar, token: t, klasor: E.ben.id, enUzun: E.VIDEO_SN }));
      });
    }
    return tarayicidaVideo(id, dinle);
  };
  E.videoIptal = function (id) {
    delete videoDinleyici[id];
    try { if (window.Android && Android.videoIptal) Android.videoIptal(id); } catch (e) { /* köprü yok */ }
  };

  function tarayicidaVideo(id, dinle) {
    return E.dosyalarSec('video/mp4,video/*', false).then(function (l) {
      var d = l[0];
      if (!d) { dinle({ id: id, durum: 'iptal' }); return; }
      if (d.size > E.VIDEO_MB * 1024 * 1024) { dinle({ id: id, durum: 'hata', mesaj: 'Video en fazla ' + E.VIDEO_MB + ' MB olabilir.' }); return; }
      var url = URL.createObjectURL(d), v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.src = url;
      v.onloadedmetadata = function () {
        if (v.duration > E.VIDEO_SN + 1) { dinle({ id: id, durum: 'hata', mesaj: 'Video en fazla 1 dakika olabilir.' }); return; }
        v.currentTime = Math.min(1, v.duration / 2);
      };
      v.onseeked = function () {
        var o = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight, 1));
        var c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * o) || 320; c.height = Math.round(v.videoHeight * o) || 180;
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        var onizleme = c.toDataURL('image/jpeg', 0.7);
        dinle({ id: id, durum: 'secildi', sure: v.duration, g: v.videoWidth, y: v.videoHeight, kapak: onizleme, boyut: d.size });
        dinle({ id: id, durum: 'sikistirildi', boyut: d.size });
        c.toBlob(function (kb) {
          var vy = E.yeniYol('video', 'mp4'), ky = E.yeniYol('kapak', 'jpg');
          E.yukle(d, vy, 'video/mp4', function (y) { dinle({ id: id, durum: 'yukleniyor', yuzde: Math.round(y * 0.95) }); })
            .then(function () { return E.yukle(kb, ky, 'image/jpeg'); })
            .then(function () { URL.revokeObjectURL(url); dinle({ id: id, durum: 'tamam', yol: vy, kapak_yol: ky }); })
            .catch(function (h) { dinle({ id: id, durum: 'hata', mesaj: E.hataMetni(h) }); });
        }, 'image/jpeg', 0.8);
      };
      v.onerror = function () { dinle({ id: id, durum: 'hata', mesaj: 'Bu video açılamadı.' }); };
    });
  }

  // ---------- kelamda gösterme ----------
  E.medyaListesi = function (k) {
    if (k.medya && k.medya.length) return k.medya;
    return k.gorsel_yol ? [{ tur: 'foto', yol: k.gorsel_yol }] : [];
  };
  E.medyaHtml = function (k) {
    var m = E.medyaListesi(k);
    if (!m.length) return '';
    E._medya[k.id] = m;
    if (m[0].tur === 'video') {
      var v = m[0];
      var oran = v.g && v.y ? Math.max(0.56, Math.min(1.25, v.y / v.g)) : 0.56;
      return '<div class="km km-v" data-is="medya-ac" data-km="' + k.id + '" data-i="0" style="padding-top:' + (oran * 100).toFixed(1) + '%">' +
        (v.kapak ? '<img src="' + esc(E.gorselUrl(v.kapak)) + '" alt="" loading="lazy">' : '') +
        '<span class="km-oynat">' + ikon('play') + '</span><span class="km-sure">' + ikon('video') + E.sureYaz(v.sure) + '</span></div>';
    }
    return '<div class="km km' + Math.min(m.length, 4) + '">' + m.map(function (x, i) {
      return '<div class="km-k" data-is="medya-ac" data-km="' + k.id + '" data-i="' + i + '"><img src="' + esc(E.gorselUrl(x.yol)) + '" alt="" loading="lazy"></div>';
    }).join('') + '</div>';
  };

  // ---------- tam ekran izleyici ----------
  E.is['medya-ac'] = function (el) {
    var m = E._medya[el.getAttribute('data-km')];
    if (!m) return;
    var i = +el.getAttribute('data-i') || 0, x = m[i];
    var ic = x.tur === 'video'
      ? '<video src="' + esc(E.gorselUrl(x.yol)) + '"' + (x.kapak ? ' poster="' + esc(E.gorselUrl(x.kapak)) + '"' : '') + ' controls autoplay playsinline></video>'
      : '<img src="' + esc(E.gorselUrl(x.yol)) + '" alt="">';
    var p = E.katmanAc('<button class="izle-x" data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button>' + ic +
      (m.length > 1 ? '<div class="izle-sayi">' + (i + 1) + ' / ' + m.length + '</div>' : ''), 'izle');
    if (m.length > 1 && x.tur !== 'video') {
      var bas = null;
      function git(yon) {
        i = (i + yon + m.length) % m.length;
        E.$('img', p).src = E.gorselUrl(m[i].yol);
        E.$('.izle-sayi', p).textContent = (i + 1) + ' / ' + m.length;
      }
      p.addEventListener('touchstart', function (o) { bas = o.touches[0].clientX; }, { passive: true });
      p.addEventListener('touchend', function (o) {
        if (bas == null) return;
        var d = o.changedTouches[0].clientX - bas; bas = null;
        if (Math.abs(d) > 40) git(d < 0 ? 1 : -1);
      });
      p.addEventListener('click', function (o) {
        if (o.target.closest('.izle-x')) return;
        git(o.clientX > p.clientWidth / 2 ? 1 : -1);
      });
    }
  };
})();
