// ERKAM — uygulama içi güncelleme: GitHub'daki son sürümü denetler, indirir ve kurar
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon;
  var API = 'https://api.github.com/repos/mitturkeyhack/Erkam/releases?per_page=15';
  var aktif = null;   // açık güncelleme penceresi

  function no(s) { var m = String(s || '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+m[3]) : 0; }
  function buSurum() { try { return (window.Android && Android.surum) ? Android.surum() : ''; } catch (e) { return ''; } }
  // Play'den kurulan sürümü Play günceller; kendi güncelleyicimiz susar
  E.playSurumu = function () { try { return !!(window.Android && Android.playSurumu && Android.playSurumu()); } catch (e) { return false; } };
  function bugun() { return new Date().toISOString().slice(0, 10); }
  function mb(b) { return b ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : ''; }

  function notlar(govde) {
    return String(govde || '').split('---')[0].split('\n')
      .map(function (s) { return s.replace(/^[-*•\s]+/, '').trim(); })
      .filter(function (s) { return s && !/^Telefona indir/i.test(s); })
      .slice(0, 6);
  }

  // elle: Nizam'dan basıldıysa sonuç ne olursa olsun haber ver
  E.guncellemeDenetle = function (elle) {
    if (E.playSurumu()) { if (elle) E.tost('Güncellemeler Google Play üzerinden gelir.'); return Promise.resolve(); }
    var simdiki = buSurum();
    if (!simdiki) { if (elle) E.tost('Güncelleme yalnızca Android uygulamasında denetlenir.'); return Promise.resolve(); }
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error('github ' + r.status);
      return r.json();
    }).then(function (l) {
      // "latest" etiketine güvenme: en yüksek numaralı sürümü seç (geç biten eski derlemeler karışmasın)
      var s = (Array.isArray(l) ? l : [l]).filter(function (x) { return x && !x.draft && !x.prerelease && (x.assets || []).some(function (a) { return /\.apk$/i.test(a.name); }); })
        .sort(function (a, b) { return no(b.tag_name) - no(a.tag_name); })[0] || {};
      var tag = s.tag_name || '', apk = (s.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
      if (!apk || no(tag) <= no(simdiki)) { if (elle) E.tost('ERKAM güncel. En son sürümü kullanıyorsun.', 'iyi'); return; }
      if (!elle && E.tercih('guncelleme_ertele') === tag + '|' + bugun()) return;
      goster({ tag: tag, eski: simdiki, url: apk.browser_download_url, boy: apk.size, notlar: notlar(s.body), tarih: s.published_at });
    }).catch(function () { if (elle) E.tost('Güncelleme denetlenemedi. İnternetini kontrol et.', 'kotu'); });
  };

  function goster(g) {
    if (aktif) return;
    var liste = g.notlar.length ? g.notlar : ['Hata düzeltmeleri ve iyileştirmeler'];
    var p = E.katmanAc(
      '<div class="gn-ust"><div class="gn-isik"></div>' +
        '<div class="gn-simge"><span class="gn-halka"></span>' + ikon('star-crescent') + '<i class="gn-ok">' + ikon('arrow-up-bold') + '</i></div>' +
        '<b>Yeni sürüm hazır</b>' +
        '<div class="gn-surum"><span>v' + esc(g.eski) + '</span>' + ikon('arrow-right') + '<span class="yeni">' + esc(g.tag) + '</span></div>' +
      '</div>' +
      '<div class="gn-ic"><div class="gn-baslik">' + ikon('creation') + 'Neler yeni' + (g.boy ? '<small>' + mb(g.boy) + '</small>' : '') + '</div>' +
        '<ul class="gn-not">' + liste.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' +
        '<div class="gn-guven">' + ikon('shield-check-outline') + '<span>Kelamların, mesajların ve girişin korunur.</span></div>' +
        '<button class="gn-dgm" data-g="indir"><span class="gn-dolu"></span><span class="gn-yazi">' + ikon('download') + 'Şimdi Güncelle</span></button>' +
        '<button class="gn-sonra" data-g="sonra">Daha sonra</button>' +
      '</div>', 'gnc');
    aktif = p;
    var dgm = E.$('.gn-dgm', p), dolu = E.$('.gn-dolu', p), yazi = E.$('.gn-yazi', p), sonra = E.$('.gn-sonra', p);
    var durum = 'bekliyor';
    function yaz(h) { yazi.innerHTML = h; }
    window.E_guncelleme = function (o) {
      if (!aktif) return;
      if (o.tur === 'ilerleme') {
        durum = 'iniyor';
        var y = o.yuzde >= 0 ? o.yuzde : 0;
        dolu.style.width = y + '%';
        yaz('<span class="gn-cark"></span>' + (o.yuzde >= 0 ? 'İndiriliyor %' + o.yuzde : 'İndiriliyor...'));
      } else if (o.tur === 'indi' || o.tur === 'kurulum') {
        durum = 'hazir';
        dolu.style.width = '100%';
        yaz(ikon('check') + 'Kurulum açılıyor');
        sonra.textContent = 'Kurulum açılmadıysa tekrar dene';
        sonra.setAttribute('data-g', 'kur');
      } else if (o.tur === 'izin') {
        durum = 'izin';
        dolu.style.width = '100%';
        yaz(ikon('shield-key-outline') + 'İzni verdim, kur');
        p.classList.add('izin');
        E.$('.gn-guven', p).innerHTML = ikon('information-outline') + '<span>Açılan ayarda <b>“Bu kaynaktan izin ver”</b> seçeneğini aç, geri dön ve düğmeye bas.</span>';
      } else if (o.tur === 'hata') {
        durum = 'bekliyor';
        dolu.style.width = '0';
        yaz(ikon('refresh') + 'Tekrar dene');
        if (o.hata !== 'iptal') E.tost('Güncelleme indirilemedi: ' + (o.hata || 'bilinmeyen hata'), 'kotu');
      }
    };
    p.addEventListener('click', function (o) {
      var b = o.target.closest('[data-g]');
      if (!b) return;
      var k = b.getAttribute('data-g');
      if (k === 'sonra') { E.tercih('guncelleme_ertele', g.tag + '|' + bugun()); E.katmanKapat(); return; }
      if (k === 'kur' || durum === 'izin' || durum === 'hazir') { try { Android.guncellemeKur(); } catch (e) { /* yok */ } return; }
      if (durum !== 'bekliyor') return;
      if (window.Android && Android.guncellemeIndir) {
        durum = 'iniyor';
        yaz('<span class="gn-cark"></span>Başlıyor...');
        Android.guncellemeIndir(g.url);
      } else {
        location.href = g.url;
      }
    });
    p.parentNode._kapaninca = function () {
      if (durum === 'iniyor') { try { Android.guncellemeIptal(); } catch (e) { /* yok */ } }
      aktif = null; window.E_guncelleme = null;
    };
  }
  E._guncellemeGoster = goster;   // önizleme için

  E.is['guncelleme-denetle'] = function () { E.guncellemeDenetle(true); };
})();
