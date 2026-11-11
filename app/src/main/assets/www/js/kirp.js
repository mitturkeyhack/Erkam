// ERKAM — profil ve kapak görseli: seçme, kırpma (sürükle, iki parmakla yakınlaştır, döndür), yükleme
(function () {
  'use strict';
  var E = window.E, ikon = function (a) { return E.ikon(a); };

  var TUR = {
    avatar: { baslik: 'Profil Görseli', oran: 1, cikG: 480, yuvarlak: true },
    kapak: { baslik: 'Kapak Görseli', oran: 2.5, cikG: 1500, yuvarlak: false }
  };

  // dosyayı tuvale çiz (büyükse 2400 piksele indir)
  function tuvaleAl(dosya) {
    return new Promise(function (coz, red) {
      if (!dosya || !/^image\//.test(dosya.type || '')) return red(new Error('Bu dosya bir görsel değil.'));
      var url = URL.createObjectURL(dosya), img = new Image();
      img.onload = function () {
        var o = Math.min(1, 2400 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * o)); c.height = Math.max(1, Math.round(img.height * o));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); coz(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Bu görsel açılamadı. Başka bir fotoğraf dene.')); };
      img.src = url;
    });
  }
  function dondur(c) {
    var d = document.createElement('canvas');
    d.width = c.height; d.height = c.width;
    var x = d.getContext('2d');
    x.translate(d.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0);
    return d;
  }

  // ---------- kırpma penceresi ----------
  function kirpAc(tur, kaynak) {
    var t = TUR[tur];
    var p = E.katmanAc(
      '<div class="krp-bas"><button class="krp-x" data-k="vazgec" aria-label="Vazgeç">' + ikon('close') + '</button>' +
        '<div><b>' + t.baslik + '</b><span>Sürükle, iki parmakla yakınlaştır</span></div>' +
        '<button class="krp-don" data-k="dondur" aria-label="Döndür">' + ikon('rotate-right') + '</button></div>' +
      '<div class="krp-sahne' + (t.yuvarlak ? ' yuvarlak' : '') + '"><img alt=""><div class="krp-delik"><i></i><i></i></div></div>' +
      '<div class="krp-yakin">' + ikon('image-size-select-small') + '<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Yakınlaştır">' + ikon('image-size-select-large') + '</div>' +
      '<div class="krp-onizle"><span class="krp-on' + (t.yuvarlak ? ' yuvarlak' : '') + '"><canvas></canvas></span><span>Önizleme</span></div>' +
      '<div class="krp-dgm"><button class="cerceve" data-k="vazgec">Vazgeç</button><button class="dolu" data-k="tamam">' + ikon('check') + '<span>Mühürle</span></button></div>',
      'kirp');
    var sahne = E.$('.krp-sahne', p), img = E.$('img', sahne), delik = E.$('.krp-delik', p), kay = E.$('input', p);
    var onC = E.$('.krp-on canvas', p), tamamB = E.$('[data-k=tamam]', p);
    var src = kaynak, sw, sh, hw, hh, enAz, s, tx = 0, ty = 0, bitti = false;

    function olc() {
      sw = sahne.clientWidth; sh = sahne.clientHeight;
      hw = Math.min(sw - 36, t.yuvarlak ? sh - 36 : 9999); hh = hw / t.oran;
      if (hh > sh - 36) { hh = sh - 36; hw = hh * t.oran; }
      delik.style.width = hw + 'px'; delik.style.height = hh + 'px';
      enAz = Math.max(hw / src.width, hh / src.height);
    }
    function yeniKaynak(c) {
      src = c; img.src = c.toDataURL('image/jpeg', 0.9);
      olc(); s = enAz; tx = ty = 0; kay.value = 1; ciz();
    }
    function sinirla() {
      s = Math.max(enAz, Math.min(enAz * 4, s));
      var mx = Math.max(0, (src.width * s - hw) / 2), my = Math.max(0, (src.height * s - hh) / 2);
      tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
    }
    var onizBekle = 0;
    function ciz() {
      sinirla();
      img.style.width = src.width * s + 'px'; img.style.height = src.height * s + 'px';
      img.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px)';
      kay.value = (s / enAz).toFixed(2);
      cancelAnimationFrame(onizBekle); onizBekle = requestAnimationFrame(function () { cikti(onC, 120); });
    }
    function cikti(c, g) {
      var kx = (src.width * s / 2 - tx - hw / 2) / s, ky = (src.height * s / 2 - ty - hh / 2) / s;
      c.width = g; c.height = Math.round(g / t.oran);
      var x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, kx, ky, hw / s, hh / s, 0, 0, c.width, c.height);
      return c;
    }

    // dokunma: tek parmak sürükler, iki parmak yakınlaştırır
    var noktalar = {}, son = null;
    function durum() {
      var l = Object.keys(noktalar).map(function (k) { return noktalar[k]; });
      if (l.length >= 2) {
        var dx = l[0].x - l[1].x, dy = l[0].y - l[1].y;
        return { n: 2, x: (l[0].x + l[1].x) / 2, y: (l[0].y + l[1].y) / 2, d: Math.sqrt(dx * dx + dy * dy) };
      }
      return l.length ? { n: 1, x: l[0].x, y: l[0].y } : null;
    }
    sahne.addEventListener('pointerdown', function (o) {
      sahne.setPointerCapture(o.pointerId);
      noktalar[o.pointerId] = { x: o.clientX, y: o.clientY }; son = durum(); sahne.classList.add('tutuyor');
    });
    sahne.addEventListener('pointermove', function (o) {
      if (!noktalar[o.pointerId]) return;
      noktalar[o.pointerId] = { x: o.clientX, y: o.clientY };
      var d = durum();
      if (!d || !son || d.n !== son.n) { son = d; return; }
      tx += d.x - son.x; ty += d.y - son.y;
      if (d.n === 2 && son.d) {
        var k = d.d / son.d, s0 = s;
        s *= k; sinirla(); k = s / s0;
        // yakınlaşma parmakların ortasına doğru olsun
        var r = sahne.getBoundingClientRect(), cx = d.x - r.left - sw / 2, cy = d.y - r.top - sh / 2;
        tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k;
      }
      son = d; ciz();
    });
    function birak(o) { delete noktalar[o.pointerId]; son = durum(); if (!son) sahne.classList.remove('tutuyor'); }
    sahne.addEventListener('pointerup', birak);
    sahne.addEventListener('pointercancel', birak);
    sahne.addEventListener('wheel', function (o) { o.preventDefault(); s *= o.deltaY < 0 ? 1.08 : 0.93; ciz(); }, { passive: false });
    kay.oninput = function () { var s0 = s; s = enAz * +kay.value; var k = s / s0; tx *= k; ty *= k; ciz(); };

    p.addEventListener('click', function (o) {
      var b = o.target.closest('[data-k]');
      if (!b || bitti) return;
      var k = b.getAttribute('data-k');
      if (k === 'vazgec') E.katmanKapat();
      else if (k === 'dondur') yeniKaynak(dondur(src));
      else if (k === 'tamam') muhurle();
    });

    function muhurle() {
      bitti = true; p.classList.add('isliyor');
      tamamB.innerHTML = '<span class="krp-cark"></span><span>Mühürleniyor</span>';
      var c = cikti(document.createElement('canvas'), t.cikG);
      var eski = tur === 'avatar' ? E.ben.avatar_yol : E.ben.kapak_yol;
      new Promise(function (coz, red) { c.toBlob(function (b) { b ? coz(b) : red(new Error('Görsel işlenemedi.')); }, 'image/jpeg', 0.86); })
        .then(function (b) {
          return E.yukle(b, E.yeniYol(tur, 'jpg'), 'image/jpeg', function (y) {
            tamamB.innerHTML = '<span class="krp-cark"></span><span>%' + y + '</span>';
          });
        })
        .then(function (yol) { return E.rpc('profil_gorsel', { p_tur: tur, p_yol: yol }); })
        .then(function (ben) {
          E.ben = ben;
          if (eski) E.dosyaSil([eski]);
          E.katmanKapat();
          E.tost(tur === 'avatar' ? 'Profil görselin mühürlendi.' : 'Kapak görselin mühürlendi.', 'iyi');
          E.kabukYenile(true);
        })
        .catch(function (h) {
          bitti = false; p.classList.remove('isliyor');
          tamamB.innerHTML = ikon('check') + '<span>Mühürle</span>';
          E.tost(E.hataMetni ? E.hataMetni(h) : 'Görsel yüklenemedi.', 'kotu');
        });
    }

    // katman yerleşince ölç
    requestAnimationFrame(function () { yeniKaynak(src); });
  }

  function secVeKirp(tur) {
    return E.dosyaSec().then(function (d) {
      if (!d) return;
      return tuvaleAl(d).then(function (c) { kirpAc(tur, c); }, function (h) { E.tost(h.message, 'kotu'); });
    });
  }

  // kamera düğmesi: görsel varsa küçük bir menü, yoksa doğrudan seç
  E.is['gorsel-degis'] = function (el) {
    var tur = el.getAttribute('data-tur'), t = TUR[tur];
    var var_ = tur === 'avatar' ? E.ben.avatar_yol : E.ben.kapak_yol;
    if (!var_) return secVeKirp(tur);
    var p = E.katmanAc('<div class="gs-ust">' + (tur === 'avatar'
        ? E.avatar(E.ben, 'gs-av')
        : '<span class="gs-kp" style="background-image:url(\'' + E.esc(E.gorselUrl(var_)) + '\')"></span>') +
      '<b>' + t.baslik + '</b></div>' +
      '<div class="gs-liste"><button data-g="sec"><span>' + ikon('image-plus') + '</span>Yeni görsel seç</button>' +
      '<button data-g="bak"><span>' + ikon('eye') + '</span>Görseli görüntüle</button>' +
      '<button data-g="kaldir" class="kirmizi"><span>' + ikon('delete-outline') + '</span>Görseli kaldır</button></div>' +
      '<button class="gs-vaz" data-g="vaz">Vazgeç</button>', 'gsec');
    p.addEventListener('click', function (o) {
      var b = o.target.closest('[data-g]');
      if (!b) return;
      var g = b.getAttribute('data-g');
      E.katmanKapat();
      if (g === 'vaz') return;
      if (g === 'sec') secVeKirp(tur);
      else if (g === 'bak') E.katmanAc('<button class="izle-x" data-is="katman-kapat" aria-label="Kapat">' + ikon('close') + '</button><img src="' + E.esc(E.gorselUrl(var_)) + '" alt="">', 'izle');
      else if (g === 'kaldir') {
        E.sor(t.baslik, 'Görselin kaldırılacak.', 'Kaldır', true).then(function (evet) {
          if (!evet) return;
          return E.rpc('profil_gorsel', { p_tur: tur, p_yol: null }).then(function (ben) {
            E.ben = ben; E.dosyaSil([var_]);
            E.tost('Görsel kaldırıldı.', 'iyi'); E.kabukYenile(true);
          });
        });
      }
    });
  };
})();
