// ERKAM — Emanet ve Hukuk: ilk giriş tanıtımı + onay (ahid), metin okuyucu, verilerimi indir, KVKK başvurusu
(function () {
  'use strict';
  var E = window.E, esc = E.esc, ikon = E.ikon, H = window.HUKUK;

  // ---------- Selçuklu yıldızı onay rozeti ----------
  var YILDIZ = 'M19.78 19.78 4.22 19.78 4.22 4.22 19.78 4.22ZM12 23 1 12 12 1 23 12Z';
  var TIK = 'M7.6 12.3 10.6 15.3 16.6 9.1';
  E.rozet = function (sinif) {
    return '<svg class="ik onayr' + (sinif ? ' ' + sinif : '') + '" viewBox="0 0 24 24" aria-label="Onaylı"><path d="' + YILDIZ + '" fill="#10b981"/>' +
      '<path d="' + TIK + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  E.rozetVar = function (k) { return k && (k.rol === 'yonetim' || k.onayli) ? E.rozet() : ''; };
  E.rozetCanvas = function (x, ox, oy, boy) {
    x.save(); x.translate(ox, oy); x.scale(boy / 24, boy / 24);
    x.fillStyle = '#10b981'; x.fill(new Path2D(YILDIZ));
    x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(new Path2D(TIK));
    x.restore();
  };

  // ---------- çizim yardımcıları ----------
  function ip(ad, x, y, boy, renk, ek) {
    return '<path transform="translate(' + x + ' ' + y + ') scale(' + (boy / 24) + ')" d="' + ((window.IKON || {})[ad] || '') + '" fill="' + renk + '"' + (ek || '') + '/>';
  }
  function yildiz(cx, cy, r, renk, ek) {
    var s = r / 11;
    return '<path transform="translate(' + (cx - 12 * s) + ' ' + (cy - 12 * s) + ') scale(' + s + ')" d="' + YILDIZ + '" fill="' + renk + '"' + (ek || '') + '/>';
  }
  var DEF = '<defs>' +
    '<linearGradient id="eg-gok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1530"/><stop offset="1" stop-color="#123a3a"/></linearGradient>' +
    '<linearGradient id="eg-yes" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient>' +
    '<linearGradient id="eg-alt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#d97706"/></linearGradient>' +
    '<radialGradient id="eg-isik" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fcd34d" stop-opacity=".9"/><stop offset="1" stop-color="#fcd34d" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="eg-hale" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#34d399" stop-opacity=".45"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient>' +
    '</defs>';
  function yildizlar() {
    var s = '', n = [[22, 18, 1.2], [58, 34, .8], [96, 14, 1], [140, 28, .7], [188, 12, 1.1], [262, 88, .8], [262, 56, 1], [30, 60, .7], [120, 50, .6], [178, 64, .6]];
    n.forEach(function (p, i) { s += '<circle class="pirilti" style="animation-delay:' + (i * 0.37).toFixed(2) + 's" cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="#fff"/>'; });
    return s;
  }
  var CIZIM = {
    // Safa tepesinin eteğinde, kapısından ışık sızan Erkam'ın evi
    ev: function () {
      return '<svg viewBox="0 0 280 180">' + DEF + '<rect width="280" height="180" fill="url(#eg-gok)"/>' + yildizlar() +
        '<defs><mask id="eg-hm"><rect width="280" height="180" fill="#fff"/><circle cx="230" cy="39.6" r="14" fill="#000"/></mask><filter id="eg-bl" filterUnits="userSpaceOnUse" x="170" y="-10" width="110" height="100"><feGaussianBlur stdDeviation="4"/></filter></defs>' +
        '<g filter="url(#eg-bl)" opacity=".6"><circle cx="224" cy="40" r="17" fill="#fbbf24" mask="url(#eg-hm)"/><path d="M232.40 33.20 L233.99 37.82 L238.87 37.90 L234.97 40.83 L236.40 45.50 L232.40 42.70 L228.40 45.50 L229.83 40.83 L225.93 37.90 L230.81 37.82Z" fill="#fbbf24"/></g>' +
        '<circle cx="224" cy="40" r="17" fill="url(#eg-alt)" mask="url(#eg-hm)"/><path d="M232.40 33.20 L233.99 37.82 L238.87 37.90 L234.97 40.83 L236.40 45.50 L232.40 42.70 L228.40 45.50 L229.83 40.83 L225.93 37.90 L230.81 37.82Z" fill="url(#eg-alt)"/>' +
        '<path d="M0 132 C50 104 92 112 140 120 S230 100 280 116 V180 H0Z" fill="#163f3b"/>' +
        '<path d="M0 150 C60 132 120 142 170 140 S250 128 280 136 V180 H0Z" fill="#0f2f2c"/>' +
        '<ellipse cx="140" cy="142" rx="70" ry="20" fill="url(#eg-isik)" opacity=".55"/>' +
        '<rect x="92" y="88" width="96" height="54" rx="3" fill="#e7d3b1"/><rect x="92" y="88" width="96" height="54" rx="3" fill="#000" opacity=".08"/>' +
        '<rect x="88" y="82" width="104" height="9" rx="2" fill="#cdb48c"/><rect x="104" y="72" width="40" height="12" rx="2" fill="#d9c29c"/>' +
        '<path d="M128 142 V114 a12 12 0 0 1 24 0 V142Z" fill="#fbbf24"/><path d="M128 142 V114 a12 12 0 0 1 24 0 V142Z" fill="url(#eg-isik)"/>' +
        '<rect x="102" y="100" width="14" height="12" rx="7" fill="#fcd34d" opacity=".9"/><rect x="164" y="100" width="14" height="12" rx="7" fill="#fcd34d" opacity=".9"/>' +
        '<path d="M140 142 L118 180 H162Z" fill="#fcd34d" opacity=".18"/>' +
        '<circle cx="64" cy="150" r="3" fill="#fde68a" opacity=".7"/><path d="M60 162 q4 -10 8 0" stroke="#fde68a" stroke-width="2" fill="none" opacity=".5"/>' +
        '<circle cx="214" cy="148" r="3" fill="#fde68a" opacity=".7"/><path d="M210 160 q4 -10 8 0" stroke="#fde68a" stroke-width="2" fill="none" opacity=".5"/>' +
        '</svg>';
    },
    // emanet kalkanı
    kalkan: function () {
      return '<svg viewBox="0 0 280 180">' + DEF + '<rect width="280" height="180" fill="url(#eg-gok)"/>' + yildizlar() +
        '<circle cx="140" cy="92" r="78" fill="url(#eg-hale)"/>' +
        '<circle cx="140" cy="92" r="62" fill="none" stroke="#34d399" stroke-opacity=".25" stroke-dasharray="3 6"/>' +
        '<circle cx="140" cy="92" r="48" fill="none" stroke="#fde68a" stroke-opacity=".25"/>' +
        '<path d="M140 40 L180 56 V92 C180 118 162 136 140 146 C118 136 100 118 100 92 V56Z" fill="url(#eg-yes)"/>' +
        '<path d="M140 40 L180 56 V92 C180 118 162 136 140 146Z" fill="#000" opacity=".12"/>' +
        yildiz(140, 90, 20, '#0b1530', ' opacity=".35"') + ip('lock', 126, 76, 28, '#fff') +
        '<g class="yuzer">' + '<circle cx="62" cy="64" r="17" fill="#0b1530" stroke="#34d399" stroke-opacity=".6"/>' + ip('cash-off', 52, 54, 20, '#34d399') + '</g>' +
        '<g class="yuzer g2"><circle cx="218" cy="64" r="17" fill="#0b1530" stroke="#34d399" stroke-opacity=".6"/>' + ip('eye-off-outline', 208, 54, 20, '#34d399') + '</g>' +
        '<g class="yuzer g3"><circle cx="70" cy="138" r="15" fill="#0b1530" stroke="#fde68a" stroke-opacity=".6"/>' + ip('hand-heart-outline', 61, 129, 18, '#fde68a') + '</g>' +
        '<g class="yuzer"><circle cx="210" cy="138" r="15" fill="#0b1530" stroke="#fde68a" stroke-opacity=".6"/>' + ip('delete-outline', 201, 129, 18, '#fde68a') + '</g>' +
        '</svg>';
    },
    // şeffaf defter: alınanlar ve alınmayanlar
    defter: function () {
      function satir(y, ad, ok) {
        return '<rect x="96" y="' + y + '" width="104" height="16" rx="8" fill="' + (ok ? '#123a3a' : '#3b1420') + '"/>' +
          ip(ad, 101, y + 2, 12, ok ? '#6ee7b7' : '#fca5a5') + '<rect x="118" y="' + (y + 6) + '" width="' + (ok ? 52 : 44) + '" height="4" rx="2" fill="' + (ok ? '#6ee7b7' : '#fca5a5') + '" opacity=".5"/>' +
          ip(ok ? 'check' : 'close', 182, y + 2, 12, ok ? '#34d399' : '#f87171');
      }
      return '<svg viewBox="0 0 280 180">' + DEF + '<rect width="280" height="180" fill="url(#eg-gok)"/>' + yildizlar() +
        '<circle cx="148" cy="92" r="80" fill="url(#eg-hale)"/>' +
        '<rect x="84" y="24" width="128" height="146" rx="14" fill="#0e1f38" stroke="#34d399" stroke-opacity=".5"/>' +
        '<rect x="84" y="24" width="128" height="22" rx="14" fill="#10b981" opacity=".18"/>' + yildiz(100, 35, 6, '#34d399') +
        '<rect x="112" y="32" width="56" height="5" rx="2.5" fill="#6ee7b7" opacity=".7"/>' +
        satir(54, 'email-outline', 1) + satir(74, 'account-circle-outline', 1) + satir(94, 'message-text-outline', 1) +
        '<line x1="96" y1="117" x2="200" y2="117" stroke="#64748b" stroke-dasharray="3 4"/>' +
        satir(124, 'map-marker-off', 0) + satir(144, 'microphone-off', 0) +
        '<g class="yuzer"><circle cx="234" cy="50" r="20" fill="url(#eg-alt)"/>' + ip('magnify', 222, 38, 24, '#0b1530') + '</g>' +
        '</svg>';
    },
    // hakların: ortada yoldaş, etrafında dört hak
    haklar: function () {
      function uydu(x, y, ad, renk, s) { return '<g class="yuzer ' + s + '"><circle cx="' + x + '" cy="' + y + '" r="19" fill="#0b1530" stroke="' + renk + '" stroke-opacity=".7"/>' + ip(ad, x - 11, y - 11, 22, renk) + '</g>'; }
      return '<svg viewBox="0 0 280 180">' + DEF + '<rect width="280" height="180" fill="url(#eg-gok)"/>' + yildizlar() +
        '<circle cx="140" cy="94" r="74" fill="url(#eg-hale)"/>' +
        '<circle cx="140" cy="94" r="56" fill="none" stroke="#34d399" stroke-opacity=".3"/>' +
        '<circle cx="140" cy="94" r="30" fill="url(#eg-yes)"/>' + ip('account', 124, 78, 32, '#fff') +
        uydu(84, 60, 'download-outline', '#34d399', '') + uydu(196, 60, 'pencil-outline', '#34d399', 'g2') +
        uydu(84, 130, 'delete-outline', '#fde68a', 'g3') + uydu(196, 130, 'gavel', '#fde68a', '') +
        '</svg>';
    },
    // meclis nizamı: Selçuklu yıldızı içinde musafaha
    nizam: function () {
      var desen = '';
      for (var i = 0; i < 7; i++) desen += yildiz(20 + i * 40, 160, 9, 'none', ' stroke="#34d399" stroke-opacity=".25" stroke-width="1.2"');
      for (i = 0; i < 6; i++) desen += yildiz(40 + i * 40, 20, 7, 'none', ' stroke="#fde68a" stroke-opacity=".2" stroke-width="1.2"');
      return '<svg viewBox="0 0 280 180">' + DEF + '<rect width="280" height="180" fill="url(#eg-gok)"/>' + desen +
        '<circle cx="140" cy="90" r="76" fill="url(#eg-hale)"/>' +
        '<g class="don">' + yildiz(140, 90, 58, 'none', ' stroke="#fde68a" stroke-opacity=".55" stroke-width="1"') + '</g>' +
        yildiz(140, 90, 46, 'url(#eg-yes)') + yildiz(140, 90, 46, '#000', ' opacity=".1" transform-origin="140 90"') +
        ip('handshake-outline', 122, 72, 36, '#fff') + '</svg>';
    },
    // ahid: mühür
    muhur: function () {
      return '<svg viewBox="0 0 280 180">' + DEF + '<rect width="280" height="180" fill="url(#eg-gok)"/>' + yildizlar() +
        '<circle cx="140" cy="96" r="80" fill="url(#eg-hale)"/>' +
        '<rect x="74" y="48" width="132" height="104" rx="6" fill="#f3e7cf"/><rect x="74" y="48" width="132" height="10" rx="5" fill="#e2cfa8"/><rect x="74" y="142" width="132" height="10" rx="5" fill="#e2cfa8"/>' +
        '<rect x="90" y="68" width="70" height="5" rx="2.5" fill="#a8916a"/><rect x="90" y="80" width="96" height="4" rx="2" fill="#c7b38c"/>' +
        '<rect x="90" y="90" width="88" height="4" rx="2" fill="#c7b38c"/><rect x="90" y="100" width="60" height="4" rx="2" fill="#c7b38c"/>' +
        '<g class="bas">' + yildiz(178, 124, 24, 'url(#eg-alt)') + '<path d="M168.5 124.4 174.5 130.4 186.5 118" stroke="#7c2d12" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
        '</svg>';
    }
  };

  E.CIZIM = CIZIM;

  // ---------- tanıtım adımları ----------
  function maddeler(l) {
    return '<div class="emn-md">' + l.map(function (m) {
      return '<div class="emn-m' + (m[3] ? ' ' + m[3] : '') + '"><span>' + ikon(m[0]) + '</span><div><b>' + esc(m[1]) + '</b><small>' + esc(m[2]) + '</small></div></div>';
    }).join('') + '</div>';
  }
  var ADIM = [
    { cizim: 'ev', ust: 'BİR EVİN HİKÂYESİ', baslik: "Dârü'l-Erkam'a hoş geldin",
      govde: function () {
        return '<p>Mekke\'de, Safa tepesinin eteğinde bir ev vardı. Erkam bin Ebi\'l-Erkam\'ın bu evi; ilk Müslümanların emniyet içinde toplandığı, ilim öğrendiği ve birbirine yoldaş olduğu yerdi.</p>' +
          '<p><b>ERKAM</b>, o evin emniyetini dijital dünyaya taşıma gayretidir. Kapıdan girmeden önce, bu evin sana verdiği sözleri ve senden beklediklerini anlatalım.</p>' +
          '<div class="emn-uc"><div>' + ikon('shield-check-outline') + '<b>Emniyet</b></div><div>' + ikon('book-open-variant') + '<b>İlim</b></div><div>' + ikon('handshake-outline') + '<b>Yoldaşlık</b></div></div>';
      } },
    { cizim: 'kalkan', ust: 'EMANET', baslik: 'Verin, sana ait bir emanettir',
      govde: function () {
        return '<p>Bir emanet nasıl korunursa, verilerini de öyle koruyoruz. Bu sözlerimiz yazılıdır ve sözleşmemizin parçasıdır.</p>' + maddeler([
          ['cash-off', 'Satılmaz, kiralanmaz', 'Verilerin hiçbir şirkete, hiçbir bedelle verilmez.'],
          ['eye-off-outline', 'Reklam yok, takip yok', 'Profil çıkarılmaz, reklam gösterilmez, izleme aracı kullanılmaz.'],
          ['hand-heart-outline', 'Gerekenden fazlası istenmez', 'Yalnızca meclisin çalışması için zorunlu olan bilgiler alınır.'],
          ['delete-outline', 'Son söz senin', 'İstediğin an indirir, düzeltir ya da tamamen silersin.']
        ]);
      } },
    { cizim: 'defter', ust: 'ŞEFFAFLIK', baslik: 'Neyi, niçin alıyoruz?',
      govde: function () {
        return maddeler([
          ['email-outline', 'E-posta adresin', 'Giriş, kod ile tasdik ve şifre yenileme için. Kimse göremez.'],
          ['account-circle-outline', 'Profilin ve kelamların', 'Meclisle paylaşmayı kendin seçtiklerin.'],
          ['message-text-outline', 'Mesajların', 'Yalnızca sen ve karşındaki yoldaş görür.'],
          ['cake-variant-outline', 'Doğum tarihin', 'Yasal yaş sınırı için. Kimseye gösterilmez.'],
          ['bell-ring-outline', 'Bildirim anahtarın', 'Sadece sana ulak gönderebilmek için.']
        ]) + '<div class="emn-yok">' + ikon('cancel') + '<div><b>Asla almadıklarımız</b><small>Konum · Rehber · Mikrofon · Arama kayıtları · Reklam kimliği</small></div></div>';
      } },
    { cizim: 'haklar', ust: 'HAKLARIN', baslik: 'Söz senin, karar senin',
      govde: function () {
        return '<p>KVKK sana güçlü haklar tanır. ERKAM bunları uzun dilekçelere gerek bırakmadan, birkaç dokunuşla kullanabilmen için tasarlandı.</p>' +
          '<div class="emn-izgara">' +
            '<div>' + ikon('download-outline') + '<b>Verilerini indir</b><small>Hepsi tek dosyada</small></div>' +
            '<div>' + ikon('pencil-outline') + '<b>Düzelt</b><small>Künye ve profil</small></div>' +
            '<div>' + ikon('delete-outline') + '<b>Hesabını sil</b><small>Tek dokunuşla, kalıcı</small></div>' +
            '<div>' + ikon('gavel') + '<b>KVKK başvurusu</b><small>30 gün içinde cevap</small></div>' +
          '</div>' +
          '<div class="emn-not">' + ikon('server-network') + '<span>Verilerin Almanya\'daki (AB) sunucularda, şifreli bağlantıyla saklanır.</span></div>';
      } },
    { cizim: 'nizam', ust: 'MECLİS NİZAMI', baslik: 'Bu evin bir edebi var',
      govde: function () {
        return maddeler([
          ['account-heart-outline', 'Edep', 'Kişiye değil söze itiraz edilir; hakaret ve alay yoktur.'],
          ['incognito-circle', 'Mahremiyet', 'Kimsenin fotoğrafı, sırrı, mesajı izinsiz paylaşılmaz.'],
          ['check-circle-outline', 'Doğruluk', 'Yalan haber, iftira ve fitne yayılmaz.'],
          ['shield-sword', 'Temiz içerik', 'Müstehcenlik, şiddet ve yasa dışı içerik barınmaz.']
        ]) + '<div class="emn-uyar">' + ikon('feather') + '<span><b>Kelamının mesuliyeti sana aittir.</b> Kurala aykırı içerik kaldırılır; gerekirse hesap susturulur veya meclisten uzaklaştırılır.</span></div>';
      } },
    { cizim: 'muhur', ust: 'AHİD', baslik: 'Ahdini ver, meclise gir', son: true }
  ];

  var AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  function secenek(bas, l) { return '<option value="">' + bas + '</option>' + l.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join(''); }

  function ahidHtml(guncelleme, dogumVar) {
    var yil = new Date().getFullYear(), gun = [], ay = [], yl = [];
    for (var i = 1; i <= 31; i++) gun.push([i, i]);
    AY.forEach(function (a, i) { ay.push([i + 1, a]); });
    for (i = yil - 15; i >= yil - 100; i--) yl.push([i, i]);
    return (guncelleme ? '<div class="emn-guncel">' + ikon('update') + '<span>Emanet metinlerimiz güncellendi. Devam etmeden önce yeni hâllerini onaylaman gerekiyor.</span></div>' : '') +
      (dogumVar ? '' :
      '<label class="emn-et">Doğum tarihin</label><div class="emn-dogum">' +
        '<select id="em-g">' + secenek('Gün', gun) + '</select><select id="em-a">' + secenek('Ay', ay) + '</select><select id="em-y">' + secenek('Yıl', yl) + '</select></div>' +
      '<small class="emn-ipucu">' + ikon('lock-outline') + '15 yaşından küçükler meclise katılamaz. Doğum tarihin kimseye gösterilmez.</small>') +
      '<button class="emn-onay" data-o="sartlar"><i>' + ikon('check') + '</i><span><a data-metin="sartlar">Kullanım Şartları</a>\'nı ve <a data-metin="nizam">Topluluk Nizamı</a>\'nı okudum; kabul ediyorum.</span></button>' +
      '<button class="emn-onay" data-o="aydinlatma"><i>' + ikon('check') + '</i><span><a data-metin="aydinlatma">KVKK Aydınlatma Metni</a>\'ni ve <a data-metin="gizlilik">Gizlilik Politikası</a>\'nı okudum.</span></button>' +
      '<div class="emn-sorumlu">Veri sorumlusu: ' + esc(H.sorumlu) + ' · ' + esc(H.eposta) + '</div>';
  }

  // Tanıtım + onay. tamam(): meclise giriş devam eder.
  E.emanetSihirbaz = function (tamam) {
    var b = E.ben || {}, guncelleme = (b.emanet_surum || 0) > 0, dogumVar = !!b.dogum_var;
    var sira = guncelleme ? ADIM.length - 1 : 0, onay = { sartlar: false, aydinlatma: false };
    var kok = document.createElement('div');
    kok.className = 'emn';
    kok.innerHTML = '<div class="emn-ust"><div class="emn-nokta">' + ADIM.map(function () { return '<i></i>'; }).join('') + '</div></div>' +
      '<div class="emn-sahne"></div>' +
      '<div class="emn-alt"><button class="emn-geri">' + ikon('arrow-left') + '</button><button class="emn-ileri"></button></div>';
    document.getElementById('uyg').appendChild(kok);
    document.body.classList.add('emn-acik');
    var sahne = E.$('.emn-sahne', kok), ileri = E.$('.emn-ileri', kok), geri = E.$('.emn-geri', kok);

    function ciz(yon) {
      var a = ADIM[sira];
      [].forEach.call(E.$('.emn-nokta', kok).children, function (n, i) { n.className = i < sira ? 'gecti' : i === sira ? 'on' : ''; });
      sahne.innerHTML = '<div class="emn-kart ' + (yon || '') + '"><div class="emn-cizim">' + CIZIM[a.cizim]() + '</div>' +
        '<div class="emn-yazi"><div class="emn-eb">' + yildizMini() + a.ust + '</div><h2>' + esc(a.baslik) + '</h2>' +
        (a.son ? ahidHtml(guncelleme, dogumVar) : a.govde()) + '</div></div>';
      sahne.scrollTop = 0;
      geri.style.visibility = sira === 0 || guncelleme ? 'hidden' : '';
      if (a.son) {
        ileri.innerHTML = 'Ahdimi Veriyorum';
        ileri.classList.add('son');
        geri.style.visibility = 'visible';
        geri.innerHTML = guncelleme ? 'Çıkış' : ikon('arrow-left');
        denetle();
        [].forEach.call(sahne.querySelectorAll('select'), function (s) { s.onchange = denetle; });
      } else {
        ileri.innerHTML = (sira === 0 ? 'Kapıdan Gir' : 'Devam') + ikon('arrow-right');
        ileri.classList.remove('son'); ileri.disabled = false;
        geri.innerHTML = ikon('arrow-left');
      }
    }
    function yildizMini() { return '<svg viewBox="0 0 24 24"><path d="' + YILDIZ + '" fill="currentColor"/></svg>'; }
    function dogum() {
      if (dogumVar) return null;
      var g = +E.$('#em-g', kok).value, a = +E.$('#em-a', kok).value, y = +E.$('#em-y', kok).value;
      if (!g || !a || !y) return undefined;
      var d = new Date(y, a - 1, g);
      if (d.getMonth() !== a - 1) return false;
      return y + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g;
    }
    function denetle() {
      var d = dogum();
      ileri.disabled = !(onay.sartlar && onay.aydinlatma && d !== undefined && d !== false);
    }
    sahne.addEventListener('click', function (o) {
      var m = o.target.closest('[data-metin]');
      if (m) { o.preventDefault(); o.stopPropagation(); metinAc(m.getAttribute('data-metin'), true); return; }
      var k = o.target.closest('[data-o]');
      if (k) { var ad = k.getAttribute('data-o'); onay[ad] = !onay[ad]; k.classList.toggle('on', onay[ad]); try { if (window.Android && Android.titret) Android.titret(12); } catch (e) { /* yok */ } denetle(); }
    });
    geri.onclick = function () {
      if (ADIM[sira].son && (guncelleme || sira === 0)) {
        E.sor('Ahid vermeden çık', 'Onay vermeden meclise giremezsin. Oturumun kapatılacak; istediğin zaman geri dönebilirsin.', 'Çıkış Yap', true).then(function (e) {
          if (e) { kapat(); E.cikisYap(); }
        });
        return;
      }
      if (sira > 0) { sira--; ciz('geri'); }
    };
    ileri.onclick = function () {
      if (!ADIM[sira].son) { sira++; ciz('ileri'); return; }
      var d = dogum();
      if (d === false) { E.tost('Geçerli bir doğum tarihi seç.', 'kotu'); return; }
      ileri.disabled = true; ileri.innerHTML = '<span class="cark kucuk"></span>';
      E.rpc('emanet_onayla', { p_surum: H.surum, p_dogum: d, p_onaylar: { sartlar: true, aydinlatma: true, nizam: true, gizlilik: true, metin_tarihi: H.tarih } }).then(function (r) {
        E.ben.emanet_surum = H.surum; E.ben.emanet_tarih = new Date().toISOString(); E.ben.dogum_var = true; E.ben.genc = !!(r && r.genc);
        if (r && r.genc) E.ben.izole = true;
        muhurle(r && r.genc);
      }).catch(function (h) {
        var m = String(h && h.message || '');
        if (m.indexOf('yas_kucuk') !== -1) { kucukEkrani(); return; }
        ileri.innerHTML = 'Ahdimi Veriyorum'; denetle();
        E.tost(m.indexOf('dogum_gecersiz') !== -1 ? 'Geçerli bir doğum tarihi seç.' : E.hataMetni(h), 'kotu');
      });
    };
    function muhurle(genc) {
      kok.classList.add('bitti');
      sahne.innerHTML = '<div class="emn-tamam"><div class="emn-muhur">' + E.rozet() + '</div><h2>Meclise hoş geldin, yoldaş</h2>' +
        '<p>' + (genc ? 'Hesabın, yaşına uygun olarak gizli açıldı. Profilini yalnızca onayladığın yoldaşlar görecek.' : 'Ahdin mühürlendi. Kapı artık sana açık.') + '</p></div>';
      E.$('.emn-alt', kok).style.display = 'none';
      setTimeout(function () { kapat(); tamam(); }, genc ? 2600 : 1700);
    }
    function kucukEkrani() {
      sahne.innerHTML = '<div class="emn-tamam kucuk">' + ikon('account-child-outline') + '<h2>Biraz daha büyümelisin</h2>' +
        '<p>Kanun gereği 15 yaşını doldurmamış kişiler sosyal ağlara üye olamaz. Hesabın silindi; 15 yaşına girdiğinde seni meclisimizde görmekten mutluluk duyarız.</p></div>';
      E.$('.emn-alt', kok).innerHTML = '<button class="emn-ileri son" id="em-cik">Tamam</button>';
      E.dosyalarimiSil().then(function () { return E.rpc('hesabimi_sil'); }).catch(function () {}).then(function () {
        E.$('#em-cik', kok).onclick = function () { kapat(); E.cikisYap(); };
      });
    }
    function kapat() { document.body.classList.remove('emn-acik'); if (kok.parentNode) kok.parentNode.removeChild(kok); }
    E._emanetKapat = kapat;
    ciz();
  };
  E.emanetGerekli = function () { return E.ben && (E.ben.emanet_surum || 0) < H.surum; };

  // ---------- metin okuyucu ----------
  function paragraf(t) {
    return t.split('\n').map(function (s) {
      if (!s.trim()) return '<div class="hk-ara"></div>';
      if (/^• /.test(s)) return '<div class="hk-li"><i></i><span>' + esc(s.slice(2)) + '</span></div>';
      if (/^[a-zçğıöşü]\) /.test(s)) return '<div class="hk-li harf"><em>' + esc(s.slice(0, 2)) + '</em><span>' + esc(s.slice(3)) + '</span></div>';
      return '<p>' + esc(s) + '</p>';
    }).join('');
  }
  function metinAc(ad, katman) {
    var m = H.metinler[ad];
    if (!m) return;
    var govde = '<div class="hk-kahraman"><span class="hk-ik">' + ikon(m.ikon) + '</span><h2>' + esc(m.baslik) + '</h2><p>' + esc(m.ozet) + '</p>' +
        '<div class="hk-etiket"><span>' + ikon('calendar-check') + 'Yürürlük: ' + esc(H.tarih) + '</span><span>Sürüm ' + H.surum + '</span></div></div>' +
      '<div class="hk-icindekiler">' + m.bolumler.map(function (b, i) { return '<button data-b="' + i + '">' + esc(b[0]) + '</button>'; }).join('') + '</div>' +
      m.bolumler.map(function (b, i) { return '<section class="hk-bolum" id="hk-' + ad + '-' + i + '"><h3>' + esc(b[0]) + '</h3>' + paragraf(b[1]) + '</section>'; }).join('') +
      '<div class="hk-imza">' + E.rozet() + '<span>ERKAM · ' + esc(H.sorumlu) + '<br>' + esc(H.eposta) + '</span></div>';
    function kur(el) {
      el.addEventListener('click', function (o) {
        var b = o.target.closest('[data-b]');
        if (b) { var s = E.$('#hk-' + ad + '-' + b.getAttribute('data-b'), el); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    }
    if (katman) {
      var p = E.katmanAc('<div class="hk-yaprak"><div class="hk-tutamac"></div><button class="hk-kapat" data-is="katman-kapat">' + ikon('close') + '</button><div class="hk-kay">' + govde + '</div>' +
        '<button class="dolu hk-tamam" data-is="katman-kapat">Okudum</button></div>', 'yaprak hk-tam');
      kur(p);
    } else {
      E.sayfaAc({ ad: 'hukuk-' + ad, html: E.sayfaBasligi('<div class="ad">' + esc(m.baslik) + '</div>') + '<div class="ic hk">' + govde + '</div>', kur: kur });
    }
  }
  E.hukukMetni = metinAc;
  E.is['hukuk-metin'] = function (el) { metinAc(el.getAttribute('data-metin'), el.hasAttribute('data-katman')); };

  // ---------- Emanet ve Hukuk sayfası ----------
  E.is['emanet-ac'] = function () {
    var b = E.ben || {};
    function satir(ik, ad, alt, is, ek) {
      return '<button class="satir duz' + (ek || '') + '" data-is="' + is[0] + '"' + (is[1] ? ' data-metin="' + is[1] + '"' : '') + '><span class="ikon-kutu">' + ikon(ik) + '</span>' +
        '<span class="orta"><b>' + ad + '</b><span>' + alt + '</span></span>' + ikon('chevron-right', 'ok') + '</button>';
    }
    var tarih = b.emanet_tarih ? new Date(b.emanet_tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    E.sayfaAc({
      ad: 'emanet',
      html: E.sayfaBasligi('<div class="ad">Emanet ve Hukuk</div>') + '<div class="ic emh">' +
        '<div class="emh-kahraman">' + CIZIM.kalkan() + '<div class="emh-yazi"><b>Verilerin sana emanettir</b><span>Satılmaz · reklama verilmez · istediğinde silinir</span>' +
          (tarih ? '<em>' + E.rozet() + 'Ahdin ' + esc(tarih) + ' tarihinde mühürlendi · Sürüm ' + (b.emanet_surum || 0) + '</em>' : '') + '</div></div>' +
        '<div class="bolum">METİNLER</div><div class="grup">' +
          satir('script-text-outline', 'KVKK Aydınlatma Metni', 'Veri sorumlusu, amaçlar, hukuki sebepler', ['hukuk-metin', 'aydinlatma']) +
          satir('lock-outline', 'Gizlilik Politikası', 'Kim neyi görür, nasıl korunur', ['hukuk-metin', 'gizlilik']) +
          satir('scale-balance', 'Kullanım Şartları', 'Meclisin hukuku', ['hukuk-metin', 'sartlar']) +
          satir('handshake-outline', 'Topluluk Nizamı', 'Edep ve kurallar', ['hukuk-metin', 'nizam']) + '</div>' +
        '<div class="bolum">HAKLARIN</div><div class="grup">' +
          satir('download-outline', 'Verilerimi İndir', 'Tüm verilerin tek dosyada', ['verilerim-indir']) +
          satir('gavel', 'KVKK Başvurusu', 'Bilgi, düzeltme, silme, itiraz', ['kvkk-basvuru']) +
          satir('file-document-edit-outline', 'Başvurularım', 'Durum ve cevaplar', ['kvkk-basvurularim']) +
          satir('account-remove', 'Hesabımı Sil', 'Kalıcı ve geri dönüşsüz', ['hesap-sil'], ' kirmizi') + '</div>' +
        '<div class="emh-alt">Veri sorumlusu: <b>' + esc(H.sorumlu) + '</b><br>' + esc(H.eposta) + '<br>Metinlerin yürürlük tarihi: ' + esc(H.tarih) + '</div></div>'
    });
  };

  // ---------- verilerimi indir ----------
  E.is['verilerim-indir'] = function () {
    E.katmanAc('<div class="vi">' + ikon('database-lock') + '<h3>Verilerimi İndir</h3><p>Hesabın, profilin, kelamların, mesajların, yoldaşlıkların, heyben, şikâyetlerin, onay kayıtların ve KVKK başvuruların tek bir dosyada hazırlanır.</p>' +
      '<div class="vi-l"><span>' + ikon('file-download-outline') + 'JSON dosyası</span><span>' + ikon('folder-outline') + 'İndirilenler klasörü</span></div>' +
      '<div class="dgm"><button class="cerceve" data-is="katman-kapat">Vazgeç</button><button class="dolu" data-is="verilerim-hazirla">Hazırla ve İndir</button></div></div>', 'yaprak kisa');
  };
  E.is['verilerim-hazirla'] = function (el) {
    el.disabled = true; el.innerHTML = '<span class="cark kucuk"></span>';
    return E.rpc('verilerim').then(function (v) {
      var ad = 'erkam-verilerim-' + new Date().toISOString().slice(0, 10) + '.json';
      var metin = JSON.stringify(v, null, 2), ok = false;
      try { if (window.Android && Android.dosyaKaydet) ok = Android.dosyaKaydet(ad, metin, 'application/json'); } catch (e) { ok = false; }
      if (!ok && !window.Android) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([metin], { type: 'application/json' })); a.download = ad; a.click();
        ok = true;
      }
      E.katmanKapat();
      E.tost(ok ? 'Dosya İndirilenler klasörüne kaydedildi: ' + ad : 'Dosya kaydedilemedi. Tekrar dene.', ok ? 'iyi' : 'kotu');
    }, function (h) { el.disabled = false; el.textContent = 'Hazırla ve İndir'; throw h; });
  };

  // ---------- KVKK başvurusu ----------
  var TUR = [['bilgi', 'Bilgi talebi', 'information-outline'], ['duzeltme', 'Düzeltme', 'pencil-outline'], ['silme', 'Silme', 'delete-outline'],
    ['itiraz', 'İtiraz', 'hand-back-left-outline'], ['tazmin', 'Zararın giderilmesi', 'scale-balance'], ['diger', 'Diğer', 'dots-horizontal']];
  E.KVKK_TUR = {}; TUR.forEach(function (t) { E.KVKK_TUR[t[0]] = t[1]; });
  E.is['kvkk-basvuru'] = function () {
    var secili = 'bilgi';
    E.sayfaAc({
      ad: 'kvkk-basvuru',
      html: E.sayfaBasligi('<div class="ad">KVKK Başvurusu</div>') + '<div class="ic kb">' +
        '<div class="kb-bilgi">' + ikon('gavel') + '<span>KVKK m.11 kapsamındaki haklarını kullanmak için başvur. Başvurun <b>en geç 30 gün</b> içinde ücretsiz olarak cevaplanır; cevap bildirim olarak gelir.</span></div>' +
        '<label class="emn-et">Başvuru konusu</label><div class="kb-tur">' + TUR.map(function (t) {
          return '<button data-t="' + t[0] + '"' + (t[0] === secili ? ' class="on"' : '') + '>' + ikon(t[2]) + t[1] + '</button>'; }).join('') + '</div>' +
        '<label class="emn-et">Talebin</label><textarea class="girdi" id="kb-metin" maxlength="2000" rows="7" placeholder="Talebini açıkça yaz. Örn: Hakkımda işlenen verilerin hangi üçüncü kişilere aktarıldığını öğrenmek istiyorum."></textarea>' +
        '<div class="kb-say"><span id="kb-say">0</span>/2000</div>' +
        '<button class="dolu genis" id="kb-gonder" disabled>Başvuruyu Gönder</button>' +
        '<p class="kb-alt">Dilersen ERKAM\'a kayıtlı e-posta adresinden ' + esc(H.eposta) + ' adresine de yazabilirsin.</p></div>',
      kur: function (el) {
        var t = E.$('#kb-metin', el), g = E.$('#kb-gonder', el);
        E.$('.kb-tur', el).onclick = function (o) {
          var b = o.target.closest('[data-t]'); if (!b) return;
          secili = b.getAttribute('data-t');
          [].forEach.call(this.children, function (c) { c.classList.toggle('on', c === b); });
        };
        t.oninput = function () { E.$('#kb-say', el).textContent = t.value.length; g.disabled = t.value.trim().length < 10; };
        g.onclick = function () {
          g.disabled = true;
          E.rpc('kvkk_basvur', { p_tur: secili, p_metin: t.value }).then(function () {
            E.sayfaKapat();
            E.tost('Başvurun alındı. En geç 30 gün içinde cevaplanacak.', 'iyi');
          }).catch(function (h) {
            g.disabled = false;
            E.tost(String(h && h.message).indexOf('basvuru_cok') !== -1 ? 'Cevap bekleyen 3 başvurun var. Önce onların sonuçlanmasını bekle.' : E.hataMetni(h), 'kotu');
          });
        };
      }
    });
  };
  E.is['kvkk-basvurularim'] = function () {
    E.sayfaAc({
      ad: 'kvkk-basvurularim',
      html: E.sayfaBasligi('<div class="ad">Başvurularım</div>') + '<div class="ic kb" id="kb-liste"><div class="yukleniyor"><div class="cark"></div></div></div>',
      kur: function (el) {
        E.rpc('basvurularim').then(function (l) {
          E.$('#kb-liste', el).innerHTML = l.length ? l.map(function (b) {
            return '<div class="kb-kart"><div class="kb-ust"><b>' + esc(E.KVKK_TUR[b.tur] || b.tur) + '</b><em class="' + b.durum + '">' + (b.durum === 'yeni' ? 'İnceleniyor' : 'Cevaplandı') + '</em></div>' +
              '<p>' + esc(b.metin) + '</p><small>' + esc(new Date(b.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })) + '</small>' +
              (b.cevap ? '<div class="kb-cevap">' + E.rozet() + '<div><b>ERKAM cevabı</b><span>' + esc(b.cevap) + '</span></div></div>' : '') + '</div>';
          }).join('') : '<div class="bos-not">' + ikon('file-document-edit-outline') + 'Henüz bir başvurun yok.</div>';
        }).catch(function (h) { E.$('#kb-liste', el).innerHTML = '<div class="bos-not">' + ikon('wifi-off') + esc(E.hataMetni(h)) + '</div>'; });
      }
    });
  };
})();
