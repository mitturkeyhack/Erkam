// ERKAM — Ulak: kelamı dışarıya (WhatsApp, Telegram, X...) görselli kartla paylaşma
(function () {
  'use strict';
  var E = window.E;
  var INDIR = 'https://github.com/mitturkeyhack/Erkam/releases/latest/download/Erkam.apk';

  // ---------- paylaşılacak yazı ----------
  E.ulakMetni = function (k) {
    var y = k.yazar || {};
    var icerik = (k.icerik || '').trim();
    if (icerik.length > 280) icerik = icerik.slice(0, 277).replace(/\s+\S*$/, '') + '…';
    var satir = [];
    satir.push('☪️ ERKAM\'da bir kelam');
    satir.push('');
    if (icerik) { satir.push('“' + icerik + '”'); satir.push(''); }
    else if (E.medyaListesi(k).length) { satir.push(E.medyaListesi(k)[0].tur === 'video' ? '🎬 Bir video nakşetti.' : '🖼️ Bir görsel nakşetti.'); satir.push(''); }
    satir.push('— ' + (y.isim || 'Bir yoldaş') + (y.kunye ? ' (@' + y.kunye + ')' : ''));
    if (k.muhurler && k.muhurler.length) satir.push(k.muhurler.map(function (m) { return '#' + m; }).join(' '));
    satir.push('');
    satir.push('🌙 Meclise sen de katıl, ERKAM\'ı indir (Android):');
    satir.push(INDIR);
    return satir.join('\n');
  };

  // ---------- paylaşım kartı (görsel) ----------
  function resimAl(url) {
    return new Promise(function (coz) {
      if (!url) return coz(null);
      var i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = function () { coz(i); };
      i.onerror = function () { coz(null); };
      setTimeout(function () { coz(null); }, 6000);
      i.src = url;
    });
  }
  function satirlaraBol(x, metin, gen) {
    var cikti = [];
    metin.split('\n').forEach(function (p) {
      var kel = p.split(/\s+/), s = '';
      if (!p.trim()) { cikti.push(''); return; }
      kel.forEach(function (w) {
        var t = s ? s + ' ' + w : w;
        if (x.measureText(t).width > gen && s) { cikti.push(s); s = w; }
        else s = t;
        while (x.measureText(s).width > gen && s.length > 1) {   // tek uzun kelime
          var n = s.length; while (n > 1 && x.measureText(s.slice(0, n)).width > gen) n--;
          cikti.push(s.slice(0, n)); s = s.slice(n);
        }
      });
      cikti.push(s);
    });
    return cikti;
  }
  function yuvarlak(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  function hilal(x, cx, cy, boy, renk) {
    x.save(); x.translate(cx - boy / 2, cy - boy / 2); x.scale(boy / 24, boy / 24);
    x.fillStyle = renk; x.fill(new Path2D(window.IKON['star-crescent'])); x.restore();
  }

  E.ulakKarti = function (k, resimsiz) {
    var y = k.yazar || {}, W = 1080, P = 64, KP = 56, KW = W - P * 2, IW = KW - KP * 2;
    var FONT = '"Inter","Roboto","Segoe UI",sans-serif';
    var m = E.medyaListesi(k)[0];
    var medyaUrl = resimsiz || !m ? null : E.gorselUrl(m.tur === 'video' ? m.kapak : m.yol);
    return Promise.all([resimsiz ? null : resimAl(y.avatar_yol ? E.gorselUrl(y.avatar_yol) : null), resimAl(medyaUrl)]).then(function (r) {
      var av = r[0], md = r[1];
      var c = document.createElement('canvas'), x = c.getContext('2d');
      // yüksekliği hesapla
      x.font = '500 44px ' + FONT;
      var icerik = (k.icerik || '').trim();
      if (icerik.length > 600) icerik = icerik.slice(0, 597) + '…';
      var sat = icerik ? satirlaraBol(x, icerik, IW) : [];
      if (sat.length > 16) { sat = sat.slice(0, 16); sat[15] = sat[15].replace(/.{0,2}$/, '') + '…'; }
      var mh = md ? Math.min(620, Math.round(IW * md.height / md.width)) : 0;
      var muh = (k.muhurler || []).slice(0, 5);
      var kartH = KP + 104 + 34 + sat.length * 64 + (mh ? mh + 30 : 0) + (muh.length ? 86 : 0) + KP - 10;
      var H = 190 + kartH + 170;
      c.width = W; c.height = H;
      // zemin: gece mavisi → zümrüt
      var g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0f172a'); g.addColorStop(0.6, '#0b3b33'); g.addColorStop(1, '#047857');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.globalAlpha = 0.07; hilal(x, W - 120, 150, 520, '#ffffff'); x.globalAlpha = 1;
      // üst: logo
      hilal(x, P + 34, 98, 68, '#10b981');
      x.fillStyle = '#ffffff'; x.font = '800 58px ' + FONT; x.textBaseline = 'middle';
      x.fillText('ERKAM', P + 86, 100);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 30px ' + FONT; x.textAlign = 'right';
      x.fillText('Yoldaş Meclisi', W - P, 100); x.textAlign = 'left';
      // kart
      var ky = 190;
      x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 50; x.shadowOffsetY = 18;
      yuvarlak(x, P, ky, KW, kartH, 48); x.fillStyle = '#ffffff'; x.fill(); x.restore();
      var sx = P + KP, sy = ky + KP;
      // yazar
      x.save(); x.beginPath(); x.arc(sx + 50, sy + 50, 50, 0, Math.PI * 2); x.closePath();
      if (av) { x.clip(); x.drawImage(av, sx, sy, 100, 100); }
      else { x.fillStyle = '#d1fae5'; x.fill(); x.fillStyle = '#047857'; x.font = '800 46px ' + FONT; x.textAlign = 'center';
        x.fillText((y.isim || 'Y').charAt(0).toLocaleUpperCase('tr'), sx + 50, sy + 52); x.textAlign = 'left'; }
      x.restore();
      x.fillStyle = '#059669'; x.font = '800 40px ' + FONT; x.fillText(y.isim || 'Yoldaş', sx + 128, sy + 32);
      if (y.rol === 'yonetim' || y.onayli) {
        var nw = x.measureText(y.isim || 'Yoldaş').width;
        E.rozetCanvas(x, sx + 128 + nw + 10, sy + 12, 40);
      }
      x.fillStyle = '#94a3b8'; x.font = '500 32px ' + FONT; x.fillText('@' + (y.kunye || ''), sx + 128, sy + 76);
      // metin
      var ty = sy + 104 + 34 + 32;
      x.fillStyle = '#0f172a'; x.font = '500 44px ' + FONT;
      sat.forEach(function (s, i) { x.fillText(s, sx, ty + i * 64); });
      ty += sat.length * 64 - 32;
      // medya
      if (md) {
        ty += 30;
        x.save(); yuvarlak(x, sx, ty, IW, mh, 30); x.clip();
        var o = Math.max(IW / md.width, mh / md.height), dw = md.width * o, dh = md.height * o;
        x.drawImage(md, sx + (IW - dw) / 2, ty + (mh - dh) / 2, dw, dh); x.restore();
        if (m.tur === 'video') {
          x.fillStyle = 'rgba(15,23,42,.6)'; x.beginPath(); x.arc(sx + IW / 2, ty + mh / 2, 62, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#fff'; x.beginPath(); x.moveTo(sx + IW / 2 - 20, ty + mh / 2 - 32); x.lineTo(sx + IW / 2 + 34, ty + mh / 2); x.lineTo(sx + IW / 2 - 20, ty + mh / 2 + 32); x.fill();
        }
        ty += mh;
      }
      // mühürler
      if (muh.length) {
        ty += 34; var mx = sx; x.font = '800 30px ' + FONT;
        muh.forEach(function (t) {
          var w = x.measureText('#' + t).width + 40;
          if (mx + w > sx + IW) return;
          yuvarlak(x, mx, ty, w, 54, 18); x.fillStyle = '#ecfdf5'; x.fill();
          x.fillStyle = '#047857'; x.fillText('#' + t, mx + 20, ty + 28); mx += w + 14;
        });
      }
      // alt bilgi
      var ay = 190 + kartH + 86;
      x.fillStyle = '#ffffff'; x.font = '800 36px ' + FONT; x.textAlign = 'center';
      x.fillText('Meclise sen de katıl', W / 2, ay);
      x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '600 28px ' + FONT;
      x.fillText('ERKAM · Android için indir', W / 2, ay + 48);
      x.textAlign = 'left';
      return c.toDataURL('image/jpeg', 0.9);
    }).catch(function (h) {
      if (!resimsiz) return E.ulakKarti(k, true);   // resimler tuvali kirlettiyse resimsiz dene
      throw h;
    });
  };

  // ---------- Ulak düğmesi ----------
  E.is.ulak = function (el) {
    var k = E._kelamVeri[el.getAttribute('data-id')];
    if (!k) return;
    var metin = E.ulakMetni(k);
    el.disabled = true; el.classList.add('ulak-gidiyor');
    try { if (window.Android && Android.titret) Android.titret(15); } catch (e) { /* köprü yok */ }
    return E.ulakKarti(k).then(function (resim) { return resim; }, function () { return null; }).then(function (resim) {
      el.disabled = false; el.classList.remove('ulak-gidiyor');
      if (window.Android && Android.paylas) {
        Android.paylas(metin, resim ? resim.split(',')[1] : '');
        return;
      }
      // tarayıcı: Web Share ya da panoya kopyala
      if (navigator.share) return navigator.share({ text: metin }).catch(function () {});
      if (navigator.clipboard) return navigator.clipboard.writeText(metin).then(function () { E.tost('Ulak hazır: metin panoya kopyalandı.', 'iyi'); });
    });
  };
})();
