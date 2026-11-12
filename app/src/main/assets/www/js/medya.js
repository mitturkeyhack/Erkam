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
        c.toBlob(function (b) {
          if (!b) return red(new Error('Görsel işlenemedi.'));
          // akış önizlemesi: en uzun kenar 800 px (büyük hâli yalnızca açınca iner)
          var ok = Math.min(1, 800 / Math.max(w, h));
          if (ok >= 1) return coz({ blob: b, g: w, y: h, kucuk: null });
          var k = document.createElement('canvas');
          k.width = Math.max(1, Math.round(w * ok)); k.height = Math.max(1, Math.round(h * ok));
          k.getContext('2d').drawImage(c, 0, 0, k.width, k.height);
          k.toBlob(function (kb) { coz({ blob: b, g: w, y: h, kucuk: kb || null }); }, 'image/jpeg', 0.74);
        }, 'image/jpeg', 0.82);
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
        x.setRequestHeader('cache-control', 'max-age=31536000');   // yollar benzersiz: dosya hiç değişmez
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
      return '<div class="km km-v" data-is="video-dokun" data-km="' + k.id + '" style="padding-top:' + (oran * 100).toFixed(1) + '%">' +
        '<video muted loop playsinline preload="none" data-src="' + esc(E.gorselUrl(v.yol)) + '"' +
        (v.kapak ? ' poster="' + esc(E.gorselUrl(v.kapak)) + '"' : '') + '></video>' +
        '<span class="km-isaret"></span>' +
        '<span class="km-kalan">' + E.sureYaz(v.sure) + '</span>' +
        '<button class="km-ses" data-is="video-ses" aria-label="Ses">' + ikon(E.vSes ? 'volume-high' : 'volume-off') + '</button>' +
        '<button class="km-tam" data-is="video-tam" aria-label="Tam ekran">' + ikon('fullscreen') + '</button>' +
        '<span class="km-cizgi"><i></i></span></div>';
    }
    return '<div class="km km' + Math.min(m.length, 4) + '">' + m.map(function (x, i) {
      return '<div class="km-k" data-is="medya-ac" data-km="' + k.id + '" data-i="' + i + '"><img src="' + esc(E.gorselUrl(x.kucuk || x.yol)) + '" alt="" loading="lazy"></div>';
    }).join('') + '</div>';
  };


  // ---------- akışta video oynatıcı ----------
  // Ekranda en çok görünen video sessiz başlar, kaydırınca durur; aynı anda tek video oynar.
  E.vSes = false;               // bir kez ses açılırsa sonraki videolar da sesli başlar
  var gorunur = new Map();      // video -> görünme oranı
  var aktif = null, elle = new WeakSet();   // elle durdurulanlar kendiliğinden başlamaz
  function vKap(v) { return v.parentNode; }
  function kaynakAyarla(v) { if (!v.src && v.getAttribute('data-src')) { v.src = v.getAttribute('data-src'); v.preload = 'auto'; } }
  function gercektenGorunur(v) {
    var r = v.getBoundingClientRect();
    if (r.height < 20 || r.bottom < 0 || r.top > innerHeight) return false;
    var x = r.left + r.width / 2, y = Math.min(Math.max(r.top + r.height / 2, 60), innerHeight - 60);
    var e = document.elementFromPoint(x, y);
    return !!(e && vKap(v).contains(e));
  }
  function sec() {
    var en = null, enOran = 0.55;
    gorunur.forEach(function (o, v) {
      if (!document.body.contains(v)) { gorunur.delete(v); return; }
      if (o > enOran && !elle.has(v) && gercektenGorunur(v)) { en = v; enOran = o; }
    });
    if (aktif && aktif !== en && !(elle.has(aktif) && aktif.paused)) { aktif.pause(); }
    if (en && (en !== aktif || en.paused)) {
      aktif = en; kaynakAyarla(en);
      en.muted = !E.vSes; sesSimge(en);
      var s = en.play(); if (s && s.catch) s.catch(function () { /* izin yok */ });
    } else if (!en && aktif && !aktif.paused) { aktif.pause(); }
    if (!en) aktif = aktif && !aktif.paused ? aktif : null;
  }
  E.videoSec = sec;
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (l) {
    l.forEach(function (g) {
      gorunur.set(g.target, g.isIntersecting ? g.intersectionRatio : 0);
      if (g.isIntersecting && g.intersectionRatio > 0) kaynakAyarla(g.target);
    });
    sec();
  }, { threshold: [0, 0.25, 0.55, 0.75, 1] }) : null;
  function bagla(v) {
    if (v._bagli) return; v._bagli = 1;
    var kap = vKap(v), cizgi = kap.querySelector('.km-cizgi i'), kalan = kap.querySelector('.km-kalan');
    v.addEventListener('timeupdate', function () {
      if (!v.duration) return;
      cizgi.style.width = (v.currentTime / v.duration * 100).toFixed(2) + '%';
      kalan.textContent = E.sureYaz(v.duration - v.currentTime);
    });
    v.addEventListener('playing', function () { kap.classList.add('oynuyor'); kap.classList.remove('bekliyor'); });
    v.addEventListener('waiting', function () { kap.classList.add('bekliyor'); });
    v.addEventListener('pause', function () { kap.classList.remove('oynuyor'); });
    if (io) io.observe(v);
  }
  new MutationObserver(function () {
    var l = document.querySelectorAll('.km-v video');
    for (var i = 0; i < l.length; i++) bagla(l[i]);
  }).observe(document.documentElement, { childList: true, subtree: true });
  // sayfa/katman açılınca ya da kaydırınca yeniden seç (üstü örtülen video durur)
  var bekle = 0;
  function sonra() { clearTimeout(bekle); bekle = setTimeout(sec, 120); }
  document.addEventListener('scroll', sonra, true);
  setInterval(function () { if (gorunur.size) sec(); }, 800);
  document.addEventListener('visibilitychange', function () { if (document.hidden && aktif) aktif.pause(); else sonra(); });

  function sesSimge(v) {
    var b = vKap(v).querySelector('.km-ses');
    if (b) b.innerHTML = ikon(v.muted ? 'volume-off' : 'volume-high');
  }
  function isaret(kap, ad) {
    var s = kap.querySelector('.km-isaret');
    s.innerHTML = ikon(ad); s.classList.remove('goster'); void s.offsetWidth; s.classList.add('goster');
  }
  E.is['video-dokun'] = function (el) {
    var v = el.querySelector('video');
    kaynakAyarla(v);
    if (v.paused) {
      elle.delete(v);
      if (aktif && aktif !== v) aktif.pause();
      aktif = v; v.muted = !E.vSes; sesSimge(v);
      var s = v.play(); if (s && s.catch) s.catch(function () {});
      isaret(el, 'play');
    } else { v.pause(); elle.add(v); isaret(el, 'pause'); }
  };
  E.is['video-ses'] = function (el) {
    var v = vKap(el).querySelector('video');
    E.vSes = v.muted;            // sessizse aç, açıksa kapat
    v.muted = !E.vSes;
    var l = document.querySelectorAll('.km-v video');
    for (var i = 0; i < l.length; i++) { l[i].muted = !E.vSes; sesSimge(l[i]); }
    if (v.paused) { elle.delete(v); aktif = v; kaynakAyarla(v); v.play().catch(function () {}); }
  };

  // ---------- tam ekran video ----------
  E.is['video-tam'] = function (el) {
    var kap = vKap(el), kv = kap.querySelector('video');
    var m = E._medya[kap.getAttribute('data-km')], x = m && m[0];
    if (!x) return;
    var bas = kv.currentTime || 0;
    kv.pause();
    var p = E.katmanAc('<div class="tv">' +
      '<video playsinline loop src="' + esc(E.gorselUrl(x.yol)) + '"' + (x.kapak ? ' poster="' + esc(E.gorselUrl(x.kapak)) + '"' : '') + '></video>' +
      '<span class="km-isaret"></span>' +
      '<button class="izle-x" data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button>' +
      '<div class="tv-alt"><button class="tv-oy" aria-label="Oynat">' + ikon('pause') + '</button>' +
      '<span class="tv-zaman">0:00</span><div class="tv-cubuk"><div class="tv-dolu"><i></i></div></div>' +
      '<span class="tv-zaman tv-top">' + E.sureYaz(x.sure) + '</span>' +
      '<button class="tv-ses" aria-label="Ses">' + ikon('volume-high') + '</button></div></div>', 'izle');
    var tv = E.$('.tv', p), v = E.$('video', p), oy = E.$('.tv-oy', p), sesB = E.$('.tv-ses', p);
    var dolu = E.$('.tv-dolu', p), z1 = E.$('.tv-zaman', p), z2 = E.$('.tv-top', p), cubuk = E.$('.tv-cubuk', p);
    v.muted = false;
    v.currentTime = bas;
    v.play().catch(function () { v.muted = true; sesB.innerHTML = ikon('volume-off'); v.play().catch(function () {}); });
    var gizle = 0;
    function goster() { tv.classList.add('acik'); clearTimeout(gizle); gizle = setTimeout(function () { if (!v.paused) tv.classList.remove('acik'); }, 2600); }
    goster();
    v.addEventListener('timeupdate', function () {
      if (!v.duration || surukle) return;
      dolu.style.width = (v.currentTime / v.duration * 100) + '%';
      z1.textContent = E.sureYaz(v.currentTime); z2.textContent = E.sureYaz(v.duration);
    });
    v.addEventListener('play', function () { oy.innerHTML = ikon('pause'); goster(); });
    v.addEventListener('pause', function () { oy.innerHTML = ikon('play'); tv.classList.add('acik'); });
    function oynatDur() { if (v.paused) { v.play().catch(function () {}); isaret(tv, 'play'); } else { v.pause(); isaret(tv, 'pause'); } }
    oy.onclick = function (o) { o.stopPropagation(); oynatDur(); };
    sesB.onclick = function (o) {
      o.stopPropagation(); v.muted = !v.muted; E.vSes = !v.muted;
      sesB.innerHTML = ikon(v.muted ? 'volume-off' : 'volume-high'); goster();
    };
    // ilerleme çubuğunda sarma
    var surukle = false;
    function sar(cx) {
      var r = cubuk.getBoundingClientRect(), o = Math.max(0, Math.min(1, (cx - r.left) / r.width));
      dolu.style.width = (o * 100) + '%';
      if (v.duration) { v.currentTime = o * v.duration; z1.textContent = E.sureYaz(v.currentTime); }
    }
    cubuk.addEventListener('touchstart', function (o) { surukle = true; sar(o.touches[0].clientX); goster(); o.stopPropagation(); }, { passive: true });
    cubuk.addEventListener('touchmove', function (o) { sar(o.touches[0].clientX); goster(); }, { passive: true });
    cubuk.addEventListener('touchend', function () { surukle = false; });
    cubuk.addEventListener('click', function (o) { o.stopPropagation(); sar(o.clientX); });
    // videoya dokun: kontrolleri göster / oynat-durdur
    v.addEventListener('click', function () { if (tv.classList.contains('acik')) oynatDur(); else goster(); });
    // aşağı kaydırınca kapat
    var y0 = null, dy = 0;
    v.addEventListener('touchstart', function (o) { y0 = o.touches[0].clientY; dy = 0; }, { passive: true });
    v.addEventListener('touchmove', function (o) {
      if (y0 == null) return; dy = Math.max(0, o.touches[0].clientY - y0);
      tv.style.transform = 'translateY(' + dy + 'px)'; tv.style.opacity = String(Math.max(0.3, 1 - dy / 500));
    }, { passive: true });
    v.addEventListener('touchend', function () {
      if (y0 == null) return; y0 = null;
      if (dy > 110) { E.katmanKapat(); return; }
      tv.style.transform = ''; tv.style.opacity = '';
    });
    p.parentNode._kapaninca = function () {
      clearTimeout(gizle);
      var t = v.currentTime; v.pause(); v.removeAttribute('src'); v.load();
      if (document.body.contains(kv)) {
        try { kv.currentTime = t; } catch (e) { /* daha yüklenmedi */ }
        kv.muted = !E.vSes; sesSimge(kv); elle.delete(kv);
      }
      setTimeout(sec, 50);
    };
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
