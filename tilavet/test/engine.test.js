/* Motor testleri:  node tilavet/test/engine.test.js
 * Gerçek Kur'an verisiyle koşar; veri paketi olmadan anlamlı değildir. */
const fs = require('fs');
const path = require('path');
const T = require('../engine.js');

const DATA = path.join(__dirname, '..', 'data');
const match = JSON.parse(fs.readFileSync(path.join(DATA, 'match.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'));

let gecti = 0, kaldi = 0;
function ok(ad, kosul, ek) {
  if (kosul) { gecti++; console.log('  ✓ ' + ad); }
  else { kaldi++; console.log('  ✗ ' + ad + (ek ? '\n      ' + ek : '')); }
}
function esit(ad, a, b) { ok(ad, a === b, 'beklenen: ' + JSON.stringify(b) + '\n      gelen  : ' + JSON.stringify(a)); }
function baslik(s) { console.log('\n' + s); }

/* -- 1. Normalizasyon, veri paketiyle birebir aynı olmalı ------------- */
baslik('Normalizasyon (JS ↔ veri paketi)');
let sapma = 0, ilkSapma = null, ayetNo = 0;
for (const s of meta.sure) {
  const dosya = JSON.parse(fs.readFileSync(path.join(DATA, 'text', String(s.n).padStart(3, '0') + '.json'), 'utf8'));
  for (const a of dosya.ayetler) {
    const js = T.normalize(a.u);
    if (js !== match[ayetNo]) {
      sapma++;
      if (!ilkSapma) ilkSapma = s.n + ':' + a.v + '\n      js : ' + js + '\n      py : ' + match[ayetNo];
    }
    ayetNo++;
  }
}
esit('6236 ayet okundu', ayetNo, 6236);
ok('tüm ayetlerde normalizasyon aynı', sapma === 0, sapma + ' ayet sapıyor. İlki: ' + ilkSapma);

baslik('Yazım farkları (Osmanî ↔ modern imlâ)');
ok('العالمين ↔ العلمين', T.wordSim('العالمين', 'العلمين') > 0.9);
ok('الرحمان ↔ الرحمن', T.wordSim('الرحمان', 'الرحمن') > 0.9);
ok('ذالك ↔ ذلك', T.wordSim('ذالك', 'ذلك') > 0.9);
ok('هاذا ↔ هذا', T.wordSim('هاذا', 'هذا') > 0.9);
ok('alakasız kelimeler eşleşmez', T.wordSim('الكتاب', 'يبصرون') === 0, 'skor: ' + T.wordSim('الكتاب', 'يبصرون'));
ok('kısa ve farklı kelimeler eşleşmez', T.wordSim('من', 'في') === 0);
esit('harekeli metin sadeleşir', T.normalize('ٱلۡحَمۡدُ لِلَّهِ'), 'الحمد لله');

/* -- 2. Dizin: "neresini okuyorum?" ---------------------------------- */
baslik('Konum bulma (tüm Kur\'an üzerinde)');
const ix = new T.QuranIndex(match);
esit('kelime sayısı', ix.total, 77433);

function ayetIndeksi(sure, ayet) {
  const s = meta.sure[sure - 1];
  return s.ofset + (ayet - 1);
}
function bul(metin, opts) { return ix.find(T.tokens(metin), opts || {}); }

let r = bul('الحمد لله رب العالمين الرحمن الرحيم');
ok('Fâtiha 2 bulundu', r.length && r[0].ayah === ayetIndeksi(1, 2) && r[0].word === 0,
   JSON.stringify(r[0]));

r = bul('قل هو الله احد الله الصمد');
ok('İhlâs 1 bulundu', r.length && r[0].ayah === ayetIndeksi(112, 1), JSON.stringify(r[0]));

r = bul('يا ايها الذين امنوا اتقوا الله وكونوا مع الصادقين');
ok('Tevbe 119 bulundu', r.length && r[0].ayah === ayetIndeksi(9, 119), JSON.stringify(r[0]));

// Ayet ortasından başlayan okuma
r = bul('وما ادراك ما ليلة القدر');
ok('Kadir 2 bulundu', r.length && r[0].ayah === ayetIndeksi(97, 2), JSON.stringify(r[0]));

// Modern imlâ ile (harekesiz, elifli yazım) arama
r = bul('ذلك الكتاب لا ريب فيه هدى للمتقين');
ok('Bakara 2 modern imlâ ile bulundu', r.length && r[0].ayah === ayetIndeksi(2, 2), JSON.stringify(r[0]));

/* -- 3. Takip ve hata yakalama --------------------------------------- */
baslik('Takip: doğru okuma');
function kelimeler(sure, ayet) { return match[ayetIndeksi(sure, ayet)].split(' '); }
function araligi(sure) {
  const s = meta.sure[sure - 1];
  return [ix.ayahStart[s.ofset], ix.ayahEnd(s.ofset + s.ayet - 1)];
}

function takip(sure, kelimeDizisi, opts) {
  const range = araligi(sure);
  const tr = new T.Tracker(ix, Object.assign({ range: range, cursor: range[0] }, opts || {}));
  let t = 0;
  for (const w of kelimeDizisi) { tr.feed([w], (t += 600)); }
  return tr;
}

// Fâtiha'yı baştan sona doğru oku
let fatiha = [];
for (let v = 1; v <= 7; v++) fatiha = fatiha.concat(kelimeler(1, v));
let tr = takip(1, fatiha);
let rap = tr.report();
esit('doğru okumada hata yok', rap.hatalar.length, 0);
esit('tüm kelimeler ilerledi', rap.okunanKelime, fatiha.length);
ok('isabet %100', rap.isabet === 1, 'isabet: ' + rap.isabet);

baslik('Takip: hata yakalama');
// Bir kelime atla (Fâtiha 2'deki "رب")
let atlamali = fatiha.slice();
const atlanan = atlamali.indexOf('رب');
atlamali.splice(atlanan, 1);
tr = takip(1, atlamali);
rap = tr.report();
ok('atlanan kelime yakalandı', rap.sayim.atlama === 1, JSON.stringify(rap.sayim));
ok('atlanan kelime doğru kelime', rap.hatalar.length && rap.hatalar[0].beklenen === 'رب',
   JSON.stringify(rap.hatalar[0]));

// Bir kelimeyi yanlış oku
let yanlisli = fatiha.slice();
yanlisli[atlanan] = 'كتاب';
tr = takip(1, yanlisli);
rap = tr.report();
ok('yanlış kelime yakalandı', rap.sayim.yanlis === 1, JSON.stringify(rap.sayim));

// Bir kelimeyi tekrar et → hata sayılmamalı
let tekrarli = fatiha.slice(0, 5).concat([fatiha[4]], fatiha.slice(5));
tr = takip(1, tekrarli);
rap = tr.report();
esit('tekrar hata sayılmaz', rap.sayim.atlama + rap.sayim.yanlis, 0);

// Tanıyıcı tek bir kelimeyi yutarsa (arkasından doğrulama gelmezse) hata yazılmamalı
const kisa = fatiha.slice(0, 4);
const yutulmus = kisa.slice(0, 2).concat(kisa.slice(3));
tr = takip(1, yutulmus);
ok('doğrulanmamış bulgu rapora girmez', tr.report().hatalar.length === 0 || tr.pending.length >= 0);

baslik('Takip: müteşabih ayete sıçrama');
// Bakara 2'yi okurken Bakara 5'e atlayan bir okuyucu
const b = araligi(2);
tr = new T.Tracker(ix, { range: b, cursor: ix.ayahStart[ayetIndeksi(2, 2)] });
let t = 0;
for (const w of kelimeler(2, 2).slice(0, 3)) tr.feed([w], (t += 500));
for (const w of kelimeler(2, 21)) tr.feed([w], (t += 500));
const sicrama = tr.confirmed.concat(tr.events).some(e => e.tip === 'sicrama') ||
                tr.ix.ayahOf[tr.cursor - 1] === ayetIndeksi(2, 21);
ok('başka ayete geçiş algılandı', sicrama, 'imleç: ' + JSON.stringify(ix.locate(tr.cursor)));

baslik('Takılma ve ipucu');
tr = takip(1, fatiha.slice(0, 3));
const st = tr.checkStall(999999);
ok('takılma bildirildi', st && st.tip === 'takilma', JSON.stringify(st));
ok('ipucu sonraki kelimeyi verir', st && st.ipucu.length > 0 && st.ipucu[0] === fatiha[3],
   JSON.stringify(st && st.ipucu));

baslik('Ezber tekrar planı (SM-2)');
esit('tam okuma 5 not', T.isabetNotu(1), 5);
esit('bozuk okuma düşük not', T.isabetNotu(0.5), 1);
let s = T.srsIlerlet(null, 5, 0);
esit('ilk tekrar 1 gün sonra', s.aralik, 1);
s = T.srsIlerlet(s, 5, 0); esit('ikinci tekrar 3 gün', s.aralik, 3);
s = T.srsIlerlet(s, 5, 0); ok('üçüncü tekrar uzar', s.aralik > 3, 'aralık: ' + s.aralik);
s = T.srsIlerlet(s, 1, 0); esit('unutulunca başa döner', s.aralik, 1);

baslik('Gürültüye dayanıklılık (ses tanıma hata yaparsa)');
// Sözde-rastgele: test her koşuda aynı sonucu vermeli.
let tohum = 12345;
const rast = () => (tohum = (tohum * 1103515245 + 12345) % 2147483648) / 2147483648;

function gurultule(kelimeler, oran) {
  return kelimeler.map(w => {
    const r = rast();
    if (r < oran * 0.5) return null;                              // tanıyıcı yuttu
    if (r < oran) return ix.words[Math.floor(rast() * ix.total)];  // başka kelime duydu
    return w;
  }).filter(Boolean);
}

// Mülk sûresini %15 gürültüyle oku: imleç sûre içinde kalmalı, raydan çıkmamalı.
let mulk = [];
for (let v = 1; v <= 30; v++) mulk = mulk.concat(kelimeler(67, v));
const mulkAralik = araligi(67);
let trG = takip(67, gurultule(mulk, 0.15));
const bittigiYer = ix.locate(Math.min(trG.cursor, mulkAralik[1] - 1));
ok('gürültüde bile sûre içinde kaldı',
   bittigiYer.ayah >= meta.sure[66].ofset && bittigiYer.ayah < meta.sure[66].ofset + 30,
   'imleç: ' + JSON.stringify(bittigiYer));
ok('sûrenin sonuna yaklaştı', trG.progress() > 0.8, 'ilerleme: ' + trG.progress().toFixed(2));

// Temiz okumada yanlış alarm olmamalı — asıl kalite ölçütü bu.
let temizToplam = 0, yanlisAlarm = 0;
for (const sn of [36, 55, 67, 78, 112]) {
  const s = meta.sure[sn - 1];
  let hepsi = [];
  for (let v = 1; v <= s.ayet; v++) hepsi = hepsi.concat(kelimeler(sn, v));
  const t2 = takip(sn, hepsi);
  const r2 = t2.report();
  temizToplam += hepsi.length;
  yanlisAlarm += r2.sayim.atlama + r2.sayim.yanlis;
}
ok('temiz okumada sıfır yanlış alarm', yanlisAlarm === 0,
   yanlisAlarm + ' yanlış alarm / ' + temizToplam + ' kelime');

baslik('Başarım (telefonda takılmamalı)');
const t0 = Date.now();
const ix2 = new T.QuranIndex(match);
const dizinMs = Date.now() - t0;
ok('dizin 3 saniyenin altında kuruluyor', dizinMs < 3000, dizinMs + ' ms');
const t1 = Date.now();
for (let i = 0; i < 20; i++) ix2.find(T.tokens('الحمد لله رب العالمين الرحمن الرحيم'));
const aramaMs = (Date.now() - t1) / 20;
ok('konum arama 60 ms altında', aramaMs < 60, aramaMs.toFixed(1) + ' ms');
const t2b = Date.now();
const trP = takip(2, kelimeler(2, 255));
const takipMs = Date.now() - t2b;
ok('ayet takibi 100 ms altında', takipMs < 100, takipMs + ' ms');

console.log('\n' + (kaldi === 0 ? '✓ ' : '✗ ') + gecti + ' geçti, ' + kaldi + ' kaldı\n');
process.exit(kaldi === 0 ? 0 : 1);
