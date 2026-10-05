// Fotosentez PANOSU — ders kitabı şemasının 3B, sökülüp takılabilir hâli.
// Parçalar panodaki KENDİ BİÇİMİNDEKİ oyuklara tam oturur.
import {
  Mesh, circlePts, ellipsePts, roundedRectPts, arrowPts,
  extrude, extrudeRing, cylinder, pill,
  radyalOrnekle, ringFace, rectFace, wall, fanFace, offsetPts,
} from './mesh.js';
import { yazi, yaziGenisligi } from './yazi.js';

/* ---- ortak ölçüler (mm) ---- */
export const P = {
  panoW: 280, panoD: 220, panoH: 6,
  icX: 132, icY: 102,          // oyukların yerleştiği iç dikdörtgen
  oyukDerin: 2.5,              // parçanın gömüldüğü derinlik
  bosluk: 0.4,                 // oyuk ile parça arasındaki pay
  tileH: 4.5,                  // parça kalınlığı (2 mm dışarıda kalır, kolay tutulur)
  yaziH: 1.0, yaziKal: 1.3,
  kabartma: 3.5,               // pano üzerindeki sabit kabartmalar
  okKalinlik: 2.5,
  pad: 5,                      // karo içindeki yazı boşluğu
  N: 96,                       // oyuk konturu nokta sayısı
};

// Kloroplast konturu
const OV = { cx: 12, cy: -8, rx: 118, ry: 82 };

/* ---- yerleşim: dilimlenmiş ızgara. Her hücrede en çok bir oyuk. ---- */
const KOLON_X = [-132, -92, -53, -24, 12, 62, 132];
// her kolonun satır sınırları ve hangi satırda hangi parça var
const KOLONLAR = [
  { satir: [-102, 38, 82, 102], parca: { 1: 'IŞIK' } },
  { satir: [-102, -70, -26, 32, 102], parca: { 0: 'O2', 2: 'GRANUM' } },
  { satir: [-102, 70, 102], parca: { 1: 'H2O' } },
  { satir: [-102, -42, 20, 74, 102], parca: { 0: 'ADP', 2: 'ATP' } },
  { satir: [-102, -48, -6, 40, 70, 102], parca: { 0: 'P', 1: 'NADP+', 2: 'NADPH', 4: 'CO2' } },
  { satir: [-102, -68, -36, 36, 102], parca: { 0: 'GLİKOZ', 2: 'KALVİN' } },
];

// Soket konumu = hücrenin merkezi
export const SOKETLER = (() => {
  const s = [];
  KOLONLAR.forEach((k, ci) => {
    const cx = (KOLON_X[ci] + KOLON_X[ci + 1]) / 2;
    for (const [ri, ad] of Object.entries(k.parca)) {
      const i = +ri;
      s.push([cx, (k.satir[i] + k.satir[i + 1]) / 2, ad]);
    }
  });
  return s;
})();

// Pano üzerindeki sabit yazılar: [metin, merkez x, alt kenar y, harf boyu]
export const YAZILAR = [
  ['GRANUM', -50, -26, 6],
  ['STROMA', 20.75, 26, 7],
  ['KLOROPLAST', -60, -106, 6],
];

/* ---- parça konturları: oyuk da bu kontura göre açılır ---- */
const yildizPts = (icR, uc = 10) => {
  const disR = icR * 1.45, p = [];
  for (let i = 0; i < uc * 2; i++) {
    const a = Math.PI * i / uc - Math.PI / 2;
    const r = i % 2 ? icR : disR;
    p.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return p;
};

const gunesPts = (R, rayL, n = 8) => {
  const p = [], yariv = Math.PI / n * 0.45;
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    for (let k = 0; k <= 6; k++) {
      const t = a + yariv + (2 * Math.PI / n - 2 * yariv) * k / 6;
      p.push([R * Math.cos(t), R * Math.sin(t)]);
    }
    const b = a + 2 * Math.PI / n;
    p.push([R * Math.cos(b - yariv * 0.6), R * Math.sin(b - yariv * 0.6)]);
    p.push([(R + rayL) * Math.cos(b), (R + rayL) * Math.sin(b)]);
    p.push([R * Math.cos(b + yariv * 0.6), R * Math.sin(b + yariv * 0.6)]);
  }
  return p;
};

const karoPts = (metin, boy) =>
  roundedRectPts(yaziGenisligi(metin, boy) + 2 * P.pad, boy + 2 * P.pad, 6, 10);

// Her parçanın adı → { kontur, govde }
export const PARCA_TANIM = {
  'IŞIK':   { boy: 5.6, metin: 'IŞIK',        kontur: () => gunesPts(12, 5) },
  'H2O':    { boy: 7,   metin: 'H_2O',        kontur: () => karoPts('H_2O', 7) },
  'CO2':    { boy: 7,   metin: 'CO_2',        kontur: () => karoPts('CO_2', 7) },
  'O2':     { boy: 7,   metin: 'O_2',         kontur: () => karoPts('O_2', 7) },
  'GLİKOZ': { boy: 6,   metin: 'C_6H_1_2O_6', kontur: () => karoPts('C_6H_1_2O_6', 6) },
  'ATP':    { boy: 6.4, metin: 'ATP',         kontur: () => yildizPts(yaziGenisligi('ATP', 6.4) / 2 + 3) },
  'ADP':    { boy: 6,   metin: 'ADP',         kontur: () => yildizPts(yaziGenisligi('ADP', 6) / 2 + 3) },
  'P':      { boy: 7,   metin: 'P',           kontur: () => yildizPts(5.6, 12) },
  'NADPH':  { boy: 6,   metin: 'NADPH',       kontur: () => karoPts('NADPH', 6) },
  'NADP+':  { boy: 6,   metin: 'NADP^+',      kontur: () => karoPts('NADP^+', 6) },
  'GRANUM': { boy: 0,   metin: '',            kontur: () => circlePts(16, 72) },
  'KALVİN': { boy: 0,   metin: '',            kontur: () => circlePts(32, 96) },
};

// Oyuk konturu: parça konturunun her yönde eşit mesafede dışa ötelenmişi.
// Ölçekleme yapılırsa uzun kenarda bol, kısa kenarda sıkı olur; öteleme
// her kenarda aynı payı bırakır.
const oyukKonturu = ad => offsetPts(PARCA_TANIM[ad].kontur(), P.bosluk);

/* ---- oklar: tek 2B tanımdan hem panoya kabartılır hem renkli parça olur ---- */
const don2 = (pts, deg) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
  return pts.map(p => [p[0] * c - p[1] * si, p[0] * si + p[1] * c]);
};
const tasi2 = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
const dikOkPts = (x, y0, uzun) => tasi2(don2(arrowPts(uzun, 10, 22, 15), -90), x, y0);
const egikOk = (x, y, aci, uzun, kal, basW, basL) =>
  tasi2(don2(arrowPts(uzun, kal, basW, basL), aci), x, y);

export const OKLAR = [
  { id: 'ok-h2o',    ad: 'ok H2O',    poly: [dikOkPts(-38.5, 76, 30)] },
  { id: 'ok-co2',    ad: 'ok CO2',    poly: [dikOkPts(37, 76, 30)] },
  { id: 'ok-o2',     ad: 'ok O2',     poly: [dikOkPts(-72.5, -16, 60)] },
  { id: 'ok-glikoz', ad: 'ok glikoz', poly: [dikOkPts(97, -36, 40)] },
  { id: 'ok-isik',   ad: 'ışık okları',
    // kaydırma, okun DİK yönünde olmalı; yoksa oklar üst üste biner.
    // yön -40° → dik birim (0.643, 0.766), aralık 20 mm
    poly: [0, 1, 2].map(i => egikOk(-100 - i * 12.9, 36 - i * 15.3, -40, 20, 7, 16, 10)) },
  { id: 'ok-dongu',  ad: 'döngü okları',
    poly: [
      egikOk(-50, 20, 48, 30, 7, 16, 10),
      egikOk(-30, -50, 150, 26, 7, 16, 10),
      egikOk(24, 44, -25, 34, 7, 16, 10),
      egikOk(62, -45, 195, 34, 7, 16, 10),
    ] },
];

export const okParcasi = id => {
  const o = OKLAR.find(q => q.id === id);
  const m = new Mesh();
  for (const p of o.poly) m.add(extrude(p, 0, P.okKalinlik));
  return m;
};

/* ================= PANO ================= */

// Komşu hücrelerin ortak kenarda AYNI noktaları üretmesi şart; yoksa
// T-bağlantısı oluşur ve yüzey kapanmaz. Bunun için bütün kolon ve satır
// sınırları genel bir "kesim listesi" olarak her kenara uygulanır.
const X_KESIM = [...new Set(KOLON_X)].sort((a, b) => a - b);
const Y_KESIM = [...new Set(KOLONLAR.flatMap(k => k.satir))].sort((a, b) => a - b);

function kenarOrnek(ax, ay, bx, by, kesim, adim) {
  const yatay = Math.abs(by - ay) < 1e-9;
  const t0 = yatay ? ax : ay, t1 = yatay ? bx : by;
  const yon = Math.sign(t1 - t0);
  const degerler = new Set([t0]);
  for (const k of kesim) if ((k - t0) * yon > 1e-9 && (t1 - k) * yon > 1e-9) degerler.add(k);
  // GENEL kafes: adım'ın katları. Eşit bölme yapılırsa komşu hücreler
  // farklı noktalar üretir ve yüzeyde T-bağlantısı kalır.
  const alt = Math.min(t0, t1), ust = Math.max(t0, t1);
  for (let k = Math.ceil(alt / adim); k * adim < ust - 1e-9; k++) {
    const v = k * adim;
    if (v > alt + 1e-9) degerler.add(v);
  }
  return [...degerler].sort((a, b) => (a - b) * yon).map(t => (yatay ? [t, ay] : [ax, t]));
}

function cerceveOrnek(x0, y0, x1, y1, adim = 4) {
  return [
    ...kenarOrnek(x0, y0, x1, y0, X_KESIM, adim),
    ...kenarOrnek(x1, y0, x1, y1, Y_KESIM, adim),
    ...kenarOrnek(x1, y1, x0, y1, X_KESIM, adim),
    ...kenarOrnek(x0, y1, x0, y0, Y_KESIM, adim),
  ];
}

// Kapalı çokgeni yay uzunluğuna göre N noktaya yeniden örnekler.
function boyaGoreOrnek(pts, N) {
  const n = pts.length, uz = [];
  let top = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    uz.push(d); top += d;
  }
  const out = [];
  let hedef = 0, i = 0, gecen = 0;
  for (let k = 0; k < N; k++) {
    hedef = top * k / N;
    while (gecen + uz[i] < hedef) { gecen += uz[i]; i = (i + 1) % n; }
    const t = uz[i] < 1e-9 ? 0 : (hedef - gecen) / uz[i];
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// Verilen açılarda konturun yarıçapını bulur (yıldız-biçimli kontur gerekir).
function acilardaKontur(pts, c, acilar) {
  return acilar.map(a => {
    const dx = Math.cos(a), dy = Math.sin(a);
    let enUzak = -1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const payda = dx * ey - dy * ex;
      if (Math.abs(payda) < 1e-12) continue;
      const s = ((p[0] - c[0]) * ey - (p[1] - c[1]) * ex) / payda;
      const u = ((p[0] - c[0]) * dy - (p[1] - c[1]) * dx) / payda;
      if (s > 0 && u >= -1e-9 && u <= 1 + 1e-9 && s > enUzak) enUzak = s;
    }
    return [c[0] + dx * enUzak, c[1] + dy * enUzak];
  });
}

// Oyuklu zemin plakası.
function zeminPlakasi() {
  const m = new Mesh();
  const H = P.panoH, D = P.oyukDerin;
  const disHam = roundedRectPts(P.panoW, P.panoD, 8, 12);
  const ic = cerceveOrnek(-P.icX, -P.icY, P.icX, P.icY, 3);
  const dis = boyaGoreOrnek(disHam, ic.length);

  m.add(fanFace(dis, [0, 0], 0, false));        // alt yüz
  m.add(wall(dis, 0, H, true));                 // dış duvar
  m.add(ringFace(dis, ic, H, true));            // üstte çerçeve

  KOLONLAR.forEach((k, ci) => {
    const x0 = KOLON_X[ci], x1 = KOLON_X[ci + 1];
    for (let ri = 0; ri < k.satir.length - 1; ri++) {
      const y0 = k.satir[ri], y1 = k.satir[ri + 1];
      const cevre = cerceveOrnek(x0, y0, x1, y1, 3);
      const ad = k.parca[ri];
      if (!ad) { m.add(fanFace(cevre, [(x0 + x1) / 2, (y0 + y1) / 2], H, true)); continue; }
      const c = [(x0 + x1) / 2, (y0 + y1) / 2];
      const oyuk = tasi2(oyukKonturu(ad), c[0], c[1]);
      const acilar = cevre.map(p => Math.atan2(p[1] - c[1], p[0] - c[0]));
      const ickontur = acilardaKontur(oyuk, c, acilar);
      m.add(ringFace(cevre, ickontur, H, true));          // üst yüz, oyuk kadar boş
      m.add(wall(ickontur, H - D, H, false));             // oyuk duvarı
      m.add(fanFace(ickontur, c, H - D, true));           // oyuk tabanı
    }
  });
  return m;
}

export function panoOgeleri() {
  const o = [];
  const ekle = (ad, m, tur) => o.push({ ad, m, tur });
  ekle('plaka', zeminPlakasi(), 'taban');

  const z = P.panoH, kz = z + P.kabartma;
  const oval = (rx, ry) => ellipsePts(rx, ry, 180).map(p => [p[0] + OV.cx, p[1] + OV.cy]);
  ekle('dış zar', extrudeRing(oval(OV.rx, OV.ry), oval(OV.rx - 2.6, OV.ry - 2.6), z, kz), 'zar');
  ekle('iç zar', extrudeRing(oval(OV.rx - 6.6, OV.ry - 6.6), oval(OV.rx - 9.2, OV.ry - 9.2), z, kz), 'zar');

  for (const ok of OKLAR) {
    const m = new Mesh();
    for (const p of ok.poly) m.add(extrude(p, z, kz));
    ekle(ok.ad, m, 'ok');
  }
  for (const [t, x, yy, boy] of YAZILAR) {
    ekle('yazı: ' + t, yazi(t, { boy, kal: P.yaziKal, h: P.yaziH, z0: z })
      .translate(x - yaziGenisligi(t, boy) / 2, yy, 0), 'yazı');
  }
  return o;
}

export function pano() {
  const m = new Mesh();
  for (const o of panoOgeleri()) m.add(o.m);
  return m;
}

/* ================= TAKILAN PARÇALAR ================= */

function etiket(m, metin, boy, cy = 0, z0 = P.tileH - 0.2) {
  const g = yaziGenisligi(metin, boy);
  m.add(yazi(metin, { boy, kal: P.yaziKal, h: P.yaziH, z0 }).translate(-g / 2, cy - boy / 2, 0));
  return m;
}

function duzParca(ad) {
  const t = PARCA_TANIM[ad];
  const m = new Mesh();
  m.add(extrude(t.kontur(), 0, P.tileH));
  return etiket(m, t.metin, t.boy);
}

// Granum: tilakoit yığını. Üzerinde yazı yok.
export function granum(n = 7) {
  const m = new Mesh();
  const r = 13.5, disk = 3.2, bogaz = 1.8;
  m.add(extrude(PARCA_TANIM['GRANUM'].kontur(), 0, P.tileH));
  let z = P.tileH;
  for (let i = 0; i < n; i++) {
    m.add(pill(r, disk, 1).translate(0, 0, z));
    z += disk;
    if (i < n - 1) { m.add(cylinder(4.6, bogaz + 0.2, 32).translate(0, 0, z - 0.1)); z += bogaz; }
  }
  return m;
}

// Kalvin döngüsü: iki kalın yaylı dairesel ok, içinde üç satır yazı
function yaySerit(cx, cy, rIc, rDis, a0, a1, n = 44) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + rDis * Math.cos(a), cy + rDis * Math.sin(a)]); }
  for (let i = n; i >= 0; i--) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + rIc * Math.cos(a), cy + rIc * Math.sin(a)]); }
  return p;
}
function yayUcu(cx, cy, r, aci, yon = 1, b = 7) {
  const a = aci * Math.PI / 180;
  const t = [-Math.sin(a) * yon, Math.cos(a) * yon], n = [Math.cos(a), Math.sin(a)];
  return [[cx + (r + b) * n[0], cy + (r + b) * n[1]],
          [cx + r * n[0] + t[0] * b * 1.5, cy + r * n[1] + t[1] * b * 1.5],
          [cx + (r - b) * n[0], cy + (r - b) * n[1]]];
}
export function kalvin() {
  const m = new Mesh();
  m.add(extrude(PARCA_TANIM['KALVİN'].kontur(), 0, 3.2));   // oyuktan 0,7 mm yüksek: yüzeyle çakışmaz
  for (const [a0, a1] of [[88, -78], [-92, -262]]) {
    m.add(extrude(yaySerit(0, 0, 25.5, 31, a0, a1, 48), 3.0, P.tileH + 1));
    m.add(extrude(yayUcu(0, 0, 28.2, a1, -1, 6.5), 3.0, P.tileH + 1));
  }
  ['IŞIĞIN', 'KULLANILMADIĞI', 'TEPKİMELER'].forEach((t, i) =>
    etiket(m, t, 4.2, 6.2 - i * 7, 3.0));
  return m;
}

// Işık: güneş + yazı
export function isik() {
  const m = new Mesh();
  m.add(extrude(PARCA_TANIM['IŞIK'].kontur(), 0, P.tileH));
  return etiket(m, 'IŞIK', 5.6);
}

export const PANO_PARCALARI = [
  { id: 'pano-zemin', ad: 'Pano zemini (kloroplast şeması)', soket: null, yap: pano },
  { id: 'parca-granum', ad: 'Granum — tilakoit yığını', soket: 'GRANUM', yap: () => granum(7) },
  { id: 'parca-kalvin', ad: 'Kalvin döngüsü', soket: 'KALVİN', yap: kalvin },
  { id: 'parca-isik', ad: 'Işık (güneş)', soket: 'IŞIK', yap: isik },
  { id: 'parca-su', ad: 'H₂O', soket: 'H2O', yap: () => duzParca('H2O') },
  { id: 'parca-karbondioksit', ad: 'CO₂', soket: 'CO2', yap: () => duzParca('CO2') },
  { id: 'parca-oksijen', ad: 'O₂', soket: 'O2', yap: () => duzParca('O2') },
  { id: 'parca-glikoz', ad: 'Glikoz C₆H₁₂O₆', soket: 'GLİKOZ', yap: () => duzParca('GLİKOZ') },
  { id: 'parca-atp', ad: 'ATP', soket: 'ATP', yap: () => duzParca('ATP') },
  { id: 'parca-adp', ad: 'ADP', soket: 'ADP', yap: () => duzParca('ADP') },
  { id: 'parca-fosfat', ad: 'Fosfat (P)', soket: 'P', yap: () => duzParca('P') },
  { id: 'parca-nadph', ad: 'NADPH', soket: 'NADPH', yap: () => duzParca('NADPH') },
  { id: 'parca-nadp-arti', ad: 'NADP⁺', soket: 'NADP+', yap: () => duzParca('NADP+') },
];

export const OK_PARCALARI = OKLAR.map(o => ({
  id: 'renkli-' + o.id, ad: 'Renkli ' + o.ad, yap: () => okParcasi(o.id),
}));
