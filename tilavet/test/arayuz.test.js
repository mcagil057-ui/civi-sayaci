/* Arayüz testleri — uygulamayı gerçek bir tarayıcıda sürer.
 *
 * Çalıştırmak için:
 *   npm i playwright-core
 *   python3 -m http.server 8765 --directory .        # deponun kökünde
 *   node tilavet/test/arayuz.test.js
 *
 * Ayarlar (ortam değişkeni):
 *   TILAVET_URL  varsayılan http://127.0.0.1:8765/tilavet/
 *   CHROME       chrome/chromium çalıştırılabilir dosyasının yolu
 *   EKRAN        ekran görüntülerinin yazılacağı klasör (boşsa yazılmaz)
 *
 * Mikrofon gerçek değildir: SpeechRecognition sahte bir sınıfla değiştirilir
 * ve ayetin kelimeleri sırayla "duyulur". Böylece tanıma zincirinin tamamı
 * (hizalama, vurgulama, hata sınıflandırma, rapor, tekrar planı) sınanır.
 */
const { chromium } = require('playwright-core');
const path = require('path');

const KOK = process.env.TILAVET_URL || 'http://127.0.0.1:8765/tilavet/';
const EKRAN = process.env.EKRAN || '';
const CHROME = process.env.CHROME ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecti++; console.log('  ✓ ' + ad); }
  else { kaldi++; console.log('  ✗ ' + ad + (ek ? '\n      ' + ek : '')); }
}
function baslik(s) { console.log('\n' + s); }

/** Tarayıcıya enjekte edilir: mikrofon yerine geçen sahte tanıyıcı. */
const sahteTanima = () => {
  class SahteTanima {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this._s = []; }
    // Gerçek tanıyıcı gibi: her açılış yeni bir oturumdur, sonuç listesi sıfırlanır.
    start() { this._s = []; window.__tanima = this; if (this.onstart) setTimeout(() => this.onstart(), 0); }
    stop() { if (this.onend) this.onend(); }
    abort() { this.stop(); }
    soyle(metin) {
      const i = this._s.length;
      this._s.push({ 0: { transcript: metin, confidence: 0.9 }, length: 1, isFinal: true });
      if (this.onresult) this.onresult({ resultIndex: i, results: this._s });
    }
  }
  window.SpeechRecognition = SahteTanima;
  window.webkitSpeechRecognition = SahteTanima;
};

(async () => {
  const tarayici = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking',
           '--disable-component-update', '--disable-sync', '--no-first-run',
           '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const ctx = await tarayici.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR',
    permissions: ['microphone']
  });
  const s = await ctx.newPage();
  const konsolHatalari = [];
  s.on('pageerror', e => konsolHatalari.push('sayfa: ' + e.message));
  s.on('console', m => { if (m.type() === 'error') konsolHatalari.push('konsol: ' + m.text()); });
  await s.addInitScript(sahteTanima);

  const resim = async (ad) => { if (EKRAN) await s.screenshot({ path: path.join(EKRAN, ad + '.png') }); };
  const takipHazir = () => s.waitForFunction(() => {
    const d = document.querySelector('.durum .kucuk');
    return d && /Dinliyorum/.test(d.textContent);
  }, { timeout: 40000 });
  async function oku(kelimeler, atla) {
    for (let i = 0; i < kelimeler.length; i++) {
      if (atla && atla.indexOf(i) >= 0) continue;
      await s.evaluate(k => window.__tanima && window.__tanima.soyle(k), kelimeler[i]);
      await s.waitForTimeout(20);
    }
  }
  async function koke() {                      // alt şerit görünene dek geri git
    for (let i = 0; i < 8; i++) {
      if (await s.locator('#serit').isVisible()) return;
      await s.click('#geri'); await s.waitForTimeout(140);
    }
  }
  async function sureAc(ad) {
    await koke();
    await s.click('#serit button[data-sekme="kuran"]');
    await s.waitForSelector('.sekmeler');
    await s.click('.sekmeler button:nth-child(1)');
    await s.fill('.arama', ad); await s.waitForTimeout(220);
    await s.locator('.oge').first().click();
    await s.waitForSelector('.hat .k');
  }
  async function sayfaAc(no) {
    await koke();
    await s.click('#serit button[data-sekme="kuran"]');
    await s.waitForSelector('.sekmeler');
    await s.click('.sekmeler button:nth-child(3)');
    await s.fill('.arama', String(no)); await s.waitForTimeout(250);
    await s.locator('.oge').first().click();
    await s.waitForSelector('.mushaf');
  }

  /* ---------------------------------------------------------------- */
  baslik('Açılış ve gezinme');
  await s.goto(KOK, { waitUntil: 'networkidle' });
  await s.waitForSelector('.seri-kart', { timeout: 20000 });
  ok('Bugün ekranı açıldı', await s.locator('.seri-kart').isVisible());
  await resim('01-bugun');

  await s.click('#serit button[data-sekme="kuran"]');
  await s.waitForSelector('.oge');
  ok('114 sûre listelendi', (await s.locator('.liste .oge').count()) === 114);
  await s.fill('.arama', 'rahman'); await s.waitForTimeout(200);
  ok('sûre araması çalışıyor', (await s.locator('.oge .ad').first().textContent()) === 'Rahmân');
  await s.click('.sekmeler button:nth-child(2)');
  await s.waitForSelector('.oge');
  ok('30 cüz listelendi', (await s.locator('.oge').count()) === 30);

  /* ---------------------------------------------------------------- */
  baslik('Okuma yüzeyi sade mi');
  await sureAc('yasin');
  ok('mushaf düzeniyle açılıyor', (await s.locator('.mushaf').count()) === 1);
  ok('ayet altında meal yok', (await s.locator('.meal').count()) === 0);
  ok('ayet başına düğme satırı yok', (await s.locator('.ayet-arac').count()) === 0);
  ok('altta düğme çubuğu yok', (await s.locator('.alt-cubuk').count()) === 0);
  ok('tek bir mikrofon düğmesi var', (await s.locator('.mik-fab').count()) === 1);
  ok('83 ayet ve 83 madalyon', (await s.locator('.mushaf-ayet').count()) === 83 &&
     (await s.locator('.nisan').count()) === 83);
  ok('mushaf yazı tipi yüklendi', await s.evaluate(() => document.fonts.check('16px "Amiri Quran"')));
  await resim('02-okuyucu');

  baslik('Ayete dokunma ve üst menü');
  await s.locator('.mushaf-ayet').nth(2).click();
  await s.waitForSelector('.ayet-islem');
  ok('ayet işlem çubuğu açıldı', (await s.locator('.ayet-islem .minik').textContent()).indexOf('36:3') > 0);
  await s.click('.ayet-islem button:has-text("Meal")');
  await s.waitForSelector('.tabaka .meal');
  ok('meal ayete dokununca geliyor',
     (await s.locator('.tabaka .meal').textContent()).indexOf('peygamber') >= 0);
  await s.click('.tabaka', { position: { x: 195, y: 60 } });
  await s.waitForTimeout(200);

  await s.click('#menu-ac');
  await s.waitForSelector('.menu-oge');
  const menuOgeleri = await s.locator('.menu-oge').allTextContents();
  ok('üst menüde okuma dışı işlemler var',
     menuOgeleri.some(x => /dinle/i.test(x)) && menuOgeleri.some(x => /Aralık/.test(x)) &&
     menuOgeleri.some(x => /Ezbere/.test(x)) && menuOgeleri.some(x => /Meali/.test(x)),
     menuOgeleri.join(' | '));
  await s.click('.menu-oge:has-text("Ayet ayet")');
  await s.waitForSelector('.ayet');
  ok('ayet ayet düzenine geçildi', (await s.locator('.ayet').count()) === 83);
  ok('ayet ayet düzeninde de meal yapışık değil', (await s.locator('.meal').count()) === 0);
  await s.click('#menu-ac');
  await s.click('.menu-oge:has-text("Meali göster")');
  await s.waitForTimeout(300);
  ok('meal menüden açılabiliyor', (await s.locator('.meal').count()) > 0);
  await s.click('#menu-ac');
  await s.click('.menu-oge:has-text("Meali gizle")');
  await s.waitForTimeout(300);
  ok('meal menüden kapanabiliyor', (await s.locator('.meal').count()) === 0);

  /* ---------------------------------------------------------------- */
  baslik('Mikrofonla takip');
  await sureAc('ihlas');
  const ihlas = await s.locator('.k').allTextContents();
  await s.click('.mik-fab');
  await takipHazir();
  ok('mikrofon düğmesi durdurmaya döndü', (await s.getAttribute('.mik-fab', 'data-durum')) === 'dinliyor');
  await oku(ihlas.slice(0, 9));
  await s.waitForTimeout(350);
  ok('okunan kelimeler işaretlendi', (await s.locator('.k.okundu').count()) === 9);
  ok('imleç sonraki kelimede', (await s.locator('.k.simdi').textContent()) === ihlas[9]);
  ok('ilerleme çubuğu hareket etti', /width: [1-9]/.test(await s.getAttribute('.olcek i', 'style')));
  await resim('03-takip');
  await s.click('.mik-fab');
  await s.waitForSelector('.kutu');
  ok('temiz okumada isabet %100', (await s.locator('.kart div').first().textContent()) === '%100');
  ok('hata listesi boş', (await s.locator('.liste .oge').count()) === 0);

  await s.click('button:has-text("Tekrar oku")');
  await takipHazir();
  await oku(ihlas, [3, 9]);                       // iki kelime atla
  await s.waitForSelector('.kutu', { timeout: 15000 });
  const kutular = await s.locator('.kutu .buyuk').allTextContents();
  ok('iki atlama tam olarak iki hata sayıldı', kutular[2] === '2' && kutular[3] === '0', kutular.join('/'));
  await resim('04-rapor');
  await s.click('#geri'); await s.waitForTimeout(400);
  ok('rapordan geri dönünce mikrofon yeniden açılmıyor', (await s.locator('.durum').count()) === 0);
  ok('mikrofon düğmesi yeniden hazır', (await s.getAttribute('.mik-fab', 'data-durum')) !== 'dinliyor');

  /* ---------------------------------------------------------------- */
  baslik('Mushaf sayfası');
  await sayfaAc(604);
  ok('sayfa üç sûreyi kapsıyor', (await s.locator('.sure-ayrac').count()) === 3);
  ok('15 ayet ve 15 madalyon', (await s.locator('.mushaf-ayet').count()) === 15 &&
     (await s.locator('.nisan').count()) === 15);
  ok('sayfa altlığı var', (await s.locator('.sayfa-altlik').textContent()).indexOf('604') >= 0);
  await resim('05-mushaf');
  await s.click('.sayfa-oklar button >> nth=0');
  await s.waitForSelector('.mushaf');
  ok('önceki sayfaya geçildi', (await s.textContent('#baslik')) === '603. sayfa');
  ok('sayfa sayacı doğru', (await s.locator('.sayfa-oklar .orta').textContent()) === '603 / 604');

  /* ---------------------------------------------------------------- */
  baslik('Aralık ve tekrar');
  await sayfaAc(604);
  await s.click('#menu-ac');
  await s.click('.menu-oge:has-text("Aralık ve tekrar")');
  await s.waitForSelector('.tabaka select');
  ok('aralık paneli sayfanın tüm ayetlerini sunuyor',
     (await s.locator('.tabaka select').first().locator('option').count()) === 15);
  await s.selectOption('.tabaka select >> nth=0', { index: 0 });
  await s.selectOption('.tabaka select >> nth=1', { index: 3 });
  await s.click('.tabaka button:has-text("Oku")');
  await takipHazir();
  ok('aralık takibi başladı', (await s.textContent('#baslik')) === 'İhlâs 1–4');
  await oku(await s.locator('.k').allTextContents());
  await s.waitForSelector('.kutu', { timeout: 15000 });
  ok('aralık raporu kapsamı adıyla veriyor',
     (await s.locator('.kart .kucuk').first().textContent()).indexOf('İhlâs 1–4') === 0);

  /* ---------------------------------------------------------------- */
  baslik('Ezber');
  await s.click('button:has-text("Metne dön")');
  await s.waitForSelector('.mushaf, .ayet');
  await s.click('#menu-ac'); await s.click('.menu-oge:has-text("Ezbere ekle")');
  await s.waitForTimeout(250);
  await sayfaAc(604);
  await s.click('#menu-ac'); await s.click('.menu-oge:has-text("Ezbere ekle")');
  await s.waitForTimeout(250);
  await koke();
  await s.click('#serit button[data-sekme="ezber"]');
  await s.waitForSelector('.liste .oge');
  const birimler = await s.locator('.liste .oge .ad').allTextContents();
  ok('aralık ve sayfa birimleri listede, yinelenmeden',
     birimler.length === 2 && birimler.indexOf('604. sayfa') >= 0, birimler.join(' | '));
  await resim('06-ezber');

  await s.locator('.liste .oge', { hasText: '604. sayfa' }).first().locator('.oge-ac').click();
  await takipHazir();
  ok('ezber testinde metin gizli başlıyor', (await s.locator('.k.gizli').count()) === 58);
  const sayfaKelimeleri = await s.locator('.k').allTextContents();
  await oku(sayfaKelimeleri.slice(0, 6));
  await s.waitForTimeout(300);
  ok('okudukça kelimeler açılıyor', (await s.locator('.k.gizli').count()) === 52);
  await resim('07-ezber-testi');
  await oku(sayfaKelimeleri.slice(6));
  await s.waitForSelector('.kutu', { timeout: 20000 });
  const plan = await s.evaluate(() => JSON.parse(localStorage.getItem('tilavet.v1')).ezber);
  ok('sayfa ezberi sınır aşarak tamamlandı ve tekrar planı ilerledi',
     plan['sayfa:604'] && plan['sayfa:604'].aralik >= 3, JSON.stringify(plan['sayfa:604']));

  /* ---------------------------------------------------------------- */
  baslik('Mikrofon zinciri');
  await sureAc('felak');
  const felak = await s.locator('.k').allTextContents();
  await s.click('.mik-fab');
  await takipHazir();
  ok('mikrofon akışı açıldı (ses düzeyi göstergesi var)', (await s.locator('.ses-olcek').count()) === 1);
  await oku(felak.slice(0, 4));
  await s.waitForTimeout(300);
  ok('duyulan metin ekranda gösteriliyor', !(await s.locator('.duyulan').isHidden()));
  ok('ilk kelimeler işlendi', (await s.locator('.k.okundu').count()) === 4);

  // Asıl kusur: tanıyıcı her cümleden sonra kapanıp yeniden açılır. Yeni
  // oturumda sonuç listesi sıfırdan başlar; sayaç taşınırsa sonraki kelimeler
  // "zaten işlendi" sanılıp atılır ve mikrofon hiç algılamıyor gibi görünür.
  await s.evaluate(() => window.__tanima.stop());
  await s.waitForTimeout(900);
  ok('kapanan tanıyıcı kendiliğinden yeniden açıldı',
     await s.evaluate(() => !!window.__tanima));
  await oku(felak.slice(4, 9));
  await s.waitForTimeout(300);
  ok('yeniden başladıktan sonra da kelimeler işleniyor',
     (await s.locator('.k.okundu').count()) === 9,
     'işlenen: ' + (await s.locator('.k.okundu').count()) + ' / 9');
  await s.click('.mik-fab');
  await s.waitForSelector('.kutu');
  ok('kesintili oturum yine de temiz rapor veriyor',
     (await s.locator('.kart div').first().textContent()) === '%100');

  baslik('Mikrofon testi ekranı');
  await koke();
  await s.click('#ayarlar-ac');
  await s.waitForSelector('.ayar');
  await s.click('button:has-text("Mikrofon testi")');
  await s.waitForSelector('.rozet');
  const tani = await s.locator('.ayar .rozet').allTextContents();
  ok('cihaz bilgileri raporlanıyor', tani.length >= 4, tani.join(' | '));
  await s.click('button:has-text("Başlat")');
  await s.waitForFunction(() => /Dinliyorum/.test(document.querySelector('.durum .kucuk').textContent), { timeout: 30000 });
  await s.evaluate(() => window.__tanima.soyle('قل اعوذ برب الفلق'));
  await s.waitForSelector('.tani-satir');
  ok('duyulan söz Kur\'an\'da eşleştiriliyor',
     (await s.locator('.tani-satir .not').first().textContent()).indexOf('Felak') > 0,
     await s.locator('.tani-satir .not').first().textContent());
  await resim('09-miktest');

  /* ---------------------------------------------------------------- */
  baslik('Durum ve ayarlar');
  await koke();
  await s.click('#serit button[data-sekme="istatistik"]');
  await s.waitForSelector('.takvim');
  ok('takvim 35 gün gösteriyor', (await s.locator('.takvim i').count()) === 35);
  ok('oturumlar kaydedildi', (await s.locator('.liste .oge').count()) > 0);
  ok('kök ekranlarda mikrofon düğmesi yok', (await s.locator('.mik-fab').count()) === 0);
  await s.click('#ayarlar-ac');
  await s.waitForSelector('.ayar');
  await s.selectOption('.ayar select:has(option[value="acik"])', 'acik');
  await s.waitForTimeout(150);
  ok('açık temaya geçildi', (await s.getAttribute('html', 'data-tema')) === 'acik');
  await resim('08-ayarlar');

  ok('konsol hatası yok', konsolHatalari.length === 0, konsolHatalari.join('\n      '));
  console.log('\n' + (kaldi === 0 ? '✓ ' : '✗ ') + gecti + ' geçti, ' + kaldi + ' kaldı\n');
  await tarayici.close();
  process.exit(kaldi === 0 ? 0 : 1);
})().catch(e => { console.error('ÇÖKTÜ:', e.message); process.exit(1); });
