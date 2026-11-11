// ERKAM — uçtan uca deneme: gerçek sunucuya karşı, başsız Chrome ile uygulamanın ana akışlarını yürütür.
// Depoda hiçbir şifre tutulmaz: e-posta tasdiki kapalıysa her çalışmada iki taze deneme hesabı açılır
// ve sonunda silinir. Tasdik açıksa yalnızca girişsiz denemeler yapılır. Sonuç ci/rapor/ altına yazılır.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');

const KOK = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const RAPOR = path.join(__dirname, 'rapor');
fs.mkdirSync(RAPOR, { recursive: true });

const ayarMetni = fs.readFileSync(path.join(KOK, 'js', 'ayar.js'), 'utf8');
const SUNUCU = /url:\s*'([^']+)'/.exec(ayarMetni)[1];
const ANAHTAR = /anahtar:\s*'([^']+)'/.exec(ayarMetni)[1];
const rast = () => crypto.randomBytes(5).toString('hex');
const hesap = {
  a: { isim: 'Deneme Bir', kunye: 'ci_a_' + rast(), eposta: 'ci-a-' + rast() + '@erkam.test', sifre: crypto.randomBytes(12).toString('base64url') },
  b: { isim: 'Deneme İki', kunye: 'ci_b_' + rast(), eposta: 'ci-b-' + rast() + '@erkam.test', sifre: crypto.randomBytes(12).toString('base64url') }
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const sunucu = http.createServer((istek, yanit) => {
  let yol = decodeURIComponent(istek.url.split('?')[0]);
  if (yol === '/') yol = '/index.html';
  const dosya = path.join(KOK, yol);
  if (!dosya.startsWith(KOK) || !fs.existsSync(dosya)) { yanit.writeHead(404); yanit.end('yok'); return; }
  yanit.writeHead(200, { 'Content-Type': MIME[path.extname(dosya)] || 'application/octet-stream' });
  fs.createReadStream(dosya).pipe(yanit);
});

const sonuc = { zaman: new Date().toISOString(), surum: process.env.GITHUB_RUN_NUMBER || 'yerel', adimlar: [], konsol: [] };
const damga = 'CI' + Date.now().toString(36);
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
const ADRES = 'http://127.0.0.1:8123/';

async function adim(ad, f) {
  const t = Date.now();
  try {
    const not = await f();
    sonuc.adimlar.push({ ad, tamam: true, ms: Date.now() - t, not: not === undefined ? null : not });
    console.log('  TAMAM', ad, Date.now() - t + 'ms', not === undefined ? '' : JSON.stringify(not).slice(0, 200));
  } catch (e) {
    sonuc.adimlar.push({ ad, tamam: false, ms: Date.now() - t, hata: String((e && e.message) || e).slice(0, 500) });
    console.log('  HATA ', ad, String((e && e.message) || e).slice(0, 300));
  }
}

(async () => {
  await new Promise((c) => sunucu.listen(8123, '127.0.0.1', c));
  const tarayici = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  async function yeniSayfa(ad) {
    const baglam = tarayici.createBrowserContext ? await tarayici.createBrowserContext() : await tarayici.createIncognitoBrowserContext();
    const s = await baglam.newPage();
    await s.setViewport({ width: 411, height: 891, deviceScaleFactor: 1 });
    s.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') sonuc.konsol.push(ad + ' [' + m.type() + '] ' + m.text().slice(0, 300)); });
    s.on('pageerror', (e) => sonuc.konsol.push(ad + ' [SAYFA HATASI] ' + String(e).slice(0, 300)));
    s.on('requestfailed', (r) => sonuc.konsol.push(ad + ' [İSTEK] ' + r.url().slice(0, 140) + ' ' + ((r.failure() && r.failure().errorText) || '')));
    s.on('response', (r) => { if (r.status() >= 400) sonuc.konsol.push(ad + ' [HTTP ' + r.status() + '] ' + r.url().slice(0, 160)); });
    return s;
  }
  const cek = (s, ad) => s.screenshot({ path: path.join(RAPOR, ad + '.jpg'), type: 'jpeg', quality: 72 }).catch(() => {});
  async function ac(s) {
    await s.goto(ADRES, { waitUntil: 'domcontentloaded' });
    await s.waitForSelector('#g-dugme', { timeout: 25000 });
  }
  async function kayitOl(s, h) {
    await ac(s);
    await s.click('#g-gecis');
    await s.waitForSelector('#g-kunye');
    await s.type('#g-isim', h.isim);
    await s.type('#g-kunye', h.kunye);
    await s.type('#g-eposta', h.eposta);
    await s.type('#g-sifre', h.sifre);
    await s.waitForFunction(() => /müsait/.test(document.querySelector('#g-kunye-not').textContent), { timeout: 15000 });
    await s.click('#g-dugme');
    await s.waitForSelector('#sura-liste .bos-not, #sura-liste .kelam', { timeout: 30000 });
    return s.evaluate(() => ({ kunye: E.ben.kunye, isim: E.ben.isim }));
  }

  const A = await yeniSayfa('A');
  const B = await yeniSayfa('B');
  let kelamId = null, idB = null, gorselYol = null, otomatikTasdik = false, girildi = false;

  await adim('01 uygulama açılıyor, giriş ekranı geliyor', async () => {
    await ac(A);
    await cek(A, '01_giris');
    return A.evaluate(() => ({ supabase: typeof window.supabase, istemci: !!(window.E && E.sb) }));
  });
  await adim('02 sunucu ayarı okunuyor', async () => {
    const y = await fetch(SUNUCU + '/auth/v1/settings', { headers: { apikey: ANAHTAR } });
    const d = await y.json();
    otomatikTasdik = !!d.mailer_autoconfirm;
    sonuc.eposta_tasdiki_zorunlu = !otomatikTasdik;
    return { durum: y.status, eposta_tasdiki_zorunlu: !otomatikTasdik, kayit_kapali: !!d.disable_signup };
  });
  await adim('03 künye sorgusu (girişsiz çağrı)', async () => {
    const r = await A.evaluate(() => Promise.all([E.rpc('kunye_musait', { p_kunye: 'bu_kunye_bostur_9' }), E.rpc('kunye_musait', { p_kunye: 'X' })]));
    if (r[0] !== true || r[1] !== false) throw new Error('beklenmeyen: ' + JSON.stringify(r));
    return r;
  });
  await adim('04 girişsiz kişi veriye ulaşamaz', async () => {
    const r = await A.evaluate(() => E.sb.rpc('kelam_listesi', { p_kaynak: 'sura' }).then((x) => ({ veri: x.data, hata: x.error && (x.error.code + ' ' + x.error.message) })));
    if (r.veri && r.veri.length !== undefined && !r.hata) throw new Error('girişsiz okuma mümkün: ' + JSON.stringify(r).slice(0, 200));
    return r.hata;
  });
  await adim('05 yanlış şifre reddediliyor', async () => {
    await A.type('#g-eposta', 'olmayan-' + rast() + '@erkam.test');
    await A.type('#g-sifre', 'yanlis-sifre-123');
    await A.click('#g-dugme');
    await A.waitForSelector('#giris .hata', { timeout: 20000 });
    await cek(A, '05_hatali_giris');
    return A.$eval('#giris .hata', (e) => e.textContent);
  });

  if (!otomatikTasdik) {
    sonuc.not = 'E-posta tasdiki zorunlu olduğu için oturum gerektiren adımlar atlandı.';
  } else {
    await adim('06 kayıt (A)', async () => { const r = await kayitOl(A, hesap.a); girildi = true; await cek(A, '06_sura_bos'); return r; });
    await adim('07 dolu künye reddediliyor', async () => {
      const C = await yeniSayfa('C');
      await ac(C);
      await C.click('#g-gecis');
      await C.waitForSelector('#g-kunye');
      await C.type('#g-kunye', hesap.a.kunye);
      await C.waitForFunction(() => /başka bir yoldaşa/.test(document.querySelector('#g-kunye-not').textContent), { timeout: 15000 });
      await cek(C, '07_kayit');
      await C.close();
    });
    await adim('08 yeni neşir', async () => {
      await A.click('[data-is="nesret"]');
      await A.waitForSelector('.nesir textarea');
      await A.type('.nesir textarea', damga + ' deneme kelamı @' + hesap.b.kunye);
      await A.type('.nesir .muhur-kutu input', 'ci, #Deneme');
      await cek(A, '08_nesir');
      await A.click('.nesir .gonder');
      await A.waitForFunction((d) => document.querySelector('#sura-liste') && document.querySelector('#sura-liste').textContent.indexOf(d) !== -1, { timeout: 20000 }, damga);
      kelamId = await A.evaluate((d) => {
        const k = Array.from(document.querySelectorAll('#sura-liste .kelam')).find((x) => x.textContent.indexOf(d) !== -1);
        return k && k.getAttribute('data-kelam');
      }, damga);
      await cek(A, '08_sura');
      return kelamId;
    });
    await adim('09 tasdik ve heybe', async () => {
      await A.click('[data-kelam="' + kelamId + '"] [data-is="tasdik"]');
      await A.waitForSelector('[data-kelam="' + kelamId + '"] .t.acik', { timeout: 15000 });
      await A.click('[data-kelam="' + kelamId + '"] [data-is="heybe"]');
      await A.waitForSelector('[data-kelam="' + kelamId + '"] .heybe.acik', { timeout: 15000 });
      await A.evaluate(() => E.git('heybe'));
      await A.waitForSelector('#heybe-liste [data-kelam="' + kelamId + '"]', { timeout: 15000 });
      await cek(A, '09_heybe');
      return A.$eval('[data-kelam="' + kelamId + '"] .t span', (e) => e.textContent);
    });
    await adim('10 kelam sayfası ve cevap', async () => {
      await A.evaluate((id) => { E.git('sura'); E.kelamSayfa(id); }, kelamId);
      await A.waitForSelector('.sayfa .kelam', { timeout: 15000 });
      await A.type('.sayfa .yaz textarea', 'Kendi kelamıma cevabım');
      await A.click('.sayfa .yaz button');
      await A.waitForSelector('.sayfa .kelam.cevap', { timeout: 15000 });
      await cek(A, '10_kelam');
      await A.evaluate(() => E.sayfaKapat());
    });
    await adim('11 suffe ve ders ilerlemesi', async () => {
      await A.evaluate(() => E.git('suffe'));
      await A.waitForFunction(() => document.querySelectorAll('#suffe-liste .ders').length >= 5, { timeout: 15000 });
      await cek(A, '11_suffe');
      await A.click('#suffe-liste .ders');
      await A.waitForSelector('.sayfa .okuma p', { timeout: 15000 });
      await A.evaluate(() => { const ic = document.querySelector('.sayfa .ic'); ic.scrollTop = ic.scrollHeight; });
      await bekle(1500);
      await cek(A, '11_ders');
      await A.evaluate(() => E.sayfaKapat());
      await bekle(800);
      const y = await A.evaluate(() => E.rpc('suffe_listesi').then((d) => d.map((x) => x.yuzde)));
      if (y[0] !== 100) throw new Error('ilerleme kaydedilmedi: ' + y.join(','));
      return y;
    });
    await adim('12 profil ve künye güncelleme', async () => {
      await A.evaluate(() => E.git('profil'));
      await A.waitForFunction((d) => document.querySelector('#profil-alt') && document.querySelector('#profil-alt').textContent.indexOf(d) !== -1, { timeout: 15000 }, damga);
      await A.evaluate(() => E.git('kunye'));
      await A.waitForSelector('#k-bio');
      await A.$eval('#k-bio', (e) => { e.value = 'ERKAM deneme hesabı'; });
      await A.click('[data-is="kunye-kaydet"]');
      await A.waitForFunction(() => E.ekran === 'profil' && /deneme hesabı/.test(document.querySelector('.profil-bas .bio').textContent), { timeout: 15000 });
      await cek(A, '12_profil');
      return A.$eval('.profil-bas h3', (e) => e.textContent);
    });
    await adim('13 görsel yükleme (depo)', async () => {
      const r = await A.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const x = c.getContext('2d'); x.fillStyle = '#10b981'; x.fillRect(0, 0, 64, 64);
        const blob = await new Promise((coz) => c.toBlob(coz, 'image/png'));
        const yol = await E.gorselYukle(new File([blob], 'ci.png', { type: 'image/png' }), 'ci', 200);
        const y = await fetch(E.gorselUrl(yol));
        return { yol, durum: y.status, tur: y.headers.get('content-type') };
      });
      gorselYol = r.yol;
      if (r.durum !== 200) throw new Error('görsel okunamadı: ' + JSON.stringify(r));
      return r;
    });
    await adim('14 kayıt (B) ve akışta A\'nın kelamı', async () => {
      const b = await kayitOl(B, hesap.b);
      await B.waitForFunction((d) => document.querySelector('#sura-liste').textContent.indexOf(d) !== -1, { timeout: 20000 }, damga);
      idB = await B.evaluate(() => E.ben.id);
      return b;
    });
    await adim('15 canlı bağlantı: A yazar, B anında görür', async () => {
      await bekle(3000); // kanalın bağlanması için
      const t0 = Date.now();
      await A.evaluate((id, d) => E.rpc('mesaj_gonder', { p_alici: id, p_icerik: d + ' selam' }), idB, damga);
      await B.waitForFunction(() => E.ben && E.ben.okunmamis_mesaj > 0, { timeout: 15000 });
      return { gecikme_ms: Date.now() - t0 };
    });
    await adim('16 mesajlar ve sohbet (B)', async () => {
      await B.evaluate(() => E.git('mesajlar'));
      await B.waitForSelector('#mesaj-liste .sohbet-satir', { timeout: 15000 });
      await cek(B, '16_mesajlar');
      await B.click('#mesaj-liste .sohbet-satir');
      await B.waitForSelector('.sayfa .balon.onlar', { timeout: 15000 });
      await B.type('.sayfa .yaz textarea', 'Aleyküm selam');
      await B.click('.sayfa .yaz button');
      await B.waitForSelector('.sayfa .balon.ben', { timeout: 15000 });
      await cek(B, '16_sohbet');
      await B.evaluate(() => E.sayfaKapat());
    });
    await adim('17 yoldaş edin (B → A), tasdik ve bildirimler', async () => {
      await B.evaluate((k) => E.yoldasSayfa(k), hesap.a.kunye);
      await B.waitForSelector('.sayfa [data-is="yoldas-edin"]', { timeout: 15000 });
      await B.click('.sayfa [data-is="yoldas-edin"]');
      await B.waitForFunction(() => /Yoldaşsınız/.test(document.querySelector('.sayfa .profil-dgm').textContent), { timeout: 15000 });
      await cek(B, '17_yoldas');
      await B.evaluate(() => E.sayfaKapat());
      await B.evaluate((id) => E.rpc('tasdik_degistir', { p_kelam: id }), kelamId);
      const tb = await B.evaluate(() => E.rpc('bildirim_listesi').then((d) => d.map((x) => x.tur)));
      const ta = await A.evaluate(() => E.rpc('bildirim_listesi').then((d) => d.map((x) => x.tur)));
      if (tb.indexOf('etiket') === -1) throw new Error('B: etiket bildirimi yok: ' + tb.join(','));
      if (ta.indexOf('yoldas') === -1 || ta.indexOf('tasdik') === -1) throw new Error('A: bildirim eksik: ' + ta.join(','));
      await A.evaluate(() => E.git('sura'));
      await A.click('[data-is="bildirimler"]');
      await A.waitForSelector('.yaprak .bildirim', { timeout: 15000 });
      await cek(A, '17_bildirimler');
      await A.evaluate(() => E.katmanKapat());
      return { a: ta, b: tb };
    });
    await adim('18 izole kimlik: B bırakınca A\'nın kelamı gizlenir', async () => {
      await A.evaluate(() => E.rpc('izole_ayarla', { p_acik: true }));
      await B.evaluate((k) => E.rpc('profil_getir', { p_kunye: k }).then((p) => E.rpc('yoldas_degistir', { p_kisi: p.id })), hesap.a.kunye);
      const r = await B.evaluate((id) => Promise.all([E.rpc('kelam_detay', { p_id: id }), E.rpc('kelam_listesi', { p_kaynak: 'sura' })]), kelamId);
      if (r[0] !== null) throw new Error('izole kelam hâlâ görünüyor');
      if (r[1].some((k) => k.id === kelamId)) throw new Error('izole kelam akışta görünüyor');
      await A.evaluate(() => E.rpc('izole_ayarla', { p_acik: false }));
      return 'gizlendi';
    });
    await adim('19 arama', async () => {
      await A.evaluate((d) => { E.git('sura'); E.araSayfa(d); }, damga);
      await A.waitForSelector('.sayfa .kelam', { timeout: 15000 });
      await cek(A, '19_ara');
      await A.evaluate(() => E.sayfaKapat());
    });
    await adim('20 nizam ve açık tema', async () => {
      await A.evaluate(() => { E.git('nizam'); });
      await A.waitForSelector('[data-is="ayar-fecr"]');
      await A.click('[data-is="ayar-fecr"]');
      await bekle(400);
      await cek(A, '20_nizam_fecr');
      await A.click('[data-is="ayar-fecr"]');
    });
    await adim('21 çıkış ve yeniden giriş (A)', async () => {
      await A.evaluate(() => E.cikisYap());
      await A.waitForSelector('#g-dugme', { timeout: 15000 });
      await A.type('#g-eposta', hesap.a.eposta);
      await A.type('#g-sifre', hesap.a.sifre);
      await A.click('#g-dugme');
      await A.waitForSelector('#sura-liste .bos-not, #sura-liste .kelam', { timeout: 25000 });
      return A.evaluate(() => E.ben.kunye);
    });
  }

  // Temizlik: deneme hesapları ve onlara ait her şey silinir
  if (girildi) {
    await adim('22 temizlik: deneme hesapları siliniyor', async () => {
      const r = {};
      if (gorselYol) r.gorsel = await A.evaluate((y) => E.sb.storage.from('gorseller').remove([y]).then((x) => (x.error ? x.error.message : 'silindi')), gorselYol).catch((e) => String(e));
      r.a = await A.evaluate(() => (E.ben ? E.rpc('hesabimi_sil') : 'oturum yok')).catch((e) => String(e));
      r.b = await B.evaluate(() => (window.E && E.ben ? E.rpc('hesabimi_sil') : 'oturum yok')).catch((e) => String(e));
      return r;
    });
  }

  await tarayici.close();
  sunucu.close();
  sonuc.ozet = sonuc.adimlar.filter((a) => a.tamam).length + '/' + sonuc.adimlar.length + ' adım geçti';
  fs.writeFileSync(path.join(RAPOR, 'rapor.json'), JSON.stringify(sonuc, null, 2));
  console.log(sonuc.ozet);
  process.exit(sonuc.adimlar.every((a) => a.tamam) ? 0 : 1);
})().catch((e) => {
  sonuc.cokme = String((e && e.stack) || e).slice(0, 2000);
  fs.writeFileSync(path.join(RAPOR, 'rapor.json'), JSON.stringify(sonuc, null, 2));
  console.error(e);
  process.exit(2);
});
