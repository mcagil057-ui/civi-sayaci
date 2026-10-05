// Fotosentez PANOSU — ders kitabı şemasının 3B, sökülüp takılabilir hâli.
// Parçalar panodaki KENDİ BİÇİMİNDEKİ oyuklara tam oturur.
import {
  Mesh, circlePts, ellipsePts, roundedRectPts, arrowPts,
  extrude, extrudeRing, cylinder, pill,
  radyalOrnekle, ringFace, rectFace, wall, fanFace, offsetPts,
} from './mesh.js';
import { giyotin } from './bolme.js';
import { yazi, yaziGenisligi } from './yazi.js';

/* ---- ortak ölçüler (mm) ---- */
export const P = {
  panoW: 290, panoD: 240, panoH: 6,
  icX: 136, icY: 111,          // oyukların yerleştiği iç dikdörtgen
  cerceveH: 10, cerceveW: 7,   // dış kenardaki yükselti
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
const OV = { cx: 8, cy: -3, rx: 125, ry: 85 };     // zarın dış konturu
const ZAR_KAL = 13;                                // zar şeridinin genişliği
const ZAR_ORTA = { rx: OV.rx - ZAR_KAL / 2, ry: OV.ry - ZAR_KAL / 2 };

/* ---- yerleşim: bütün oyuklar tek listede ----
   Panodaki gözler bu listeden otomatik hesaplanır (assets/bolme.js). */
export const YERLER = [
  ['ZAR-SOL',  -110.5,  -3], ['ZAR-SAG', 126.5,  -3],
  ['ZAR-UST',     8,  75.5], ['ZAR-ALT',     8, -81.5],
  ['IŞIK',     -114,    91], ['H2O',       -36,  100], ['CO2',      85,   99],
  ['O2',        -74, -100.5], ['GLİKOZ',     85, -101],
  ['GRANUM',    -71,     5], ['KALVİN',     84,   -2],
  ['ATP',        -2,    42], ['NADPH',      34,   16],
  ['NADP+',      34,   -24], ['ADP',        -2,  -48], ['P',       34,  -50],
];

// Pano üzerindeki sabit yazılar: [metin, merkez x, alt kenar y, harf boyu]
export const YAZILAR = [
  ['GRANUM', -46, -22, 6],
  ['STROMA', 26.75, 23, 7],
  ['KLOROPLAST', -108, -74, 5],
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

const karoPts = (metin, boy, pad = P.pad) =>
  roundedRectPts(yaziGenisligi(metin, boy) + 2 * pad, boy + 2 * pad, 5, 10);

// Her parçanın adı → { kontur, govde }
/* ---- 2B dönüşüm yardımcıları ---- */
const don2 = (pts, deg) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
  return pts.map(p => [p[0] * c - p[1] * si, p[0] * si + p[1] * c]);
};
const tasi2 = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);

export const OK_TANIM = [
  { id: 'ok-h2o',     ad: 'H₂O oku',        kuyruk: [-36, 89],   aci: -90, uzun: 11, kal: 5.5, basW: 13, basL: 7 },
  { id: 'ok-co2',     ad: 'CO₂ oku',        kuyruk: [85, 85],    aci: -90, uzun: 19, kal: 5.5, basW: 13, basL: 7 },
  { id: 'ok-o2',      ad: 'O₂ oku',         kuyruk: [-74, -71],  aci: -90, uzun: 16, kal: 5.5, basW: 13, basL: 7 },
  { id: 'ok-glikoz',  ad: 'Glikoz oku',     kuyruk: [85, -73],   aci: -90, uzun: 15, kal: 5.5, basW: 13, basL: 7 },
  { id: 'ok-isik-1',  ad: 'Işık oku 1',     kuyruk: [-126, 66],  aci: -40, uzun: 14, kal: 4.5, basW: 11, basL: 7 },
  { id: 'ok-isik-2',  ad: 'Işık oku 2',     kuyruk: [-126, 47],  aci: -40, uzun: 14, kal: 4.5, basW: 11, basL: 7 },
  { id: 'ok-isik-3',  ad: 'Işık oku 3',     kuyruk: [-126, 28],  aci: -40, uzun: 14, kal: 4.5, basW: 11, basL: 7 },
  { id: 'ok-granum-atp',  ad: 'Granum → ATP oku',   kuyruk: [-48, 14],  aci: 38,  uzun: 30, kal: 4.5, basW: 11, basL: 7 },
  { id: 'ok-atp-kalvin',  ad: 'ATP → Kalvin oku',   kuyruk: [22, 54],   aci: -25, uzun: 44, kal: 4.5, basW: 11, basL: 7 },
  { id: 'ok-kalvin-nadp', ad: 'Kalvin → NADP⁺ oku', kuyruk: [71, -42],  aci: 190, uzun: 22, kal: 4.5, basW: 11, basL: 7 },
  { id: 'ok-adp-granum',  ad: 'ADP+P → granum oku', kuyruk: [-26, -56], aci: 125, uzun: 40, kal: 4.5, basW: 11, basL: 7 },
];

// Okun gövde-uç birleşim noktası: oyuğun ışın merkezi burasıdır.
// Okun konturu bu noktaya göre yıldız-biçimlidir, oyuk doğru çıkar.
export const okMerkezi = o => {
  const a = o.aci * Math.PI / 180;
  return [o.kuyruk[0] + (o.uzun - o.basL) * Math.cos(a),
          o.kuyruk[1] + (o.uzun - o.basL) * Math.sin(a)];
};
// Okun konturu, merkezi orijinde olacak şekilde
export const okKonturu = o => {
  const m = okMerkezi(o);
  return tasi2(don2(arrowPts(o.uzun, o.kal, o.basW, o.basL), o.aci),
               o.kuyruk[0] - m[0], o.kuyruk[1] - m[1]);
};

// Bütün oyuklar: parçalar + zar pimleri + oklar
export const PARCA_TANIM = {
  'IŞIK':   { boy: 5.6, metin: 'IŞIK',        kontur: () => gunesPts(12, 5) },
  'H2O':    { boy: 7,   metin: 'H_2O',        kontur: () => karoPts('H_2O', 7) },
  'CO2':    { boy: 7,   metin: 'CO_2',        kontur: () => karoPts('CO_2', 7) },
  'O2':     { boy: 7,   metin: 'O_2',         kontur: () => karoPts('O_2', 7) },
  'GLİKOZ': { boy: 6,   metin: 'C_6H_1_2O_6', kontur: () => karoPts('C_6H_1_2O_6', 6) },
  'ATP':    { boy: 5.6, metin: 'ATP',         kontur: () => yildizPts(yaziGenisligi('ATP', 5.6) / 2 + 3) },
  'ADP':    { boy: 5.4, metin: 'ADP',         kontur: () => yildizPts(yaziGenisligi('ADP', 5.4) / 2 + 3) },
  'P':      { boy: 7,   metin: 'P',           kontur: () => yildizPts(5.6, 12) },
  'NADPH':  { boy: 4.8, metin: 'NADPH',       kontur: () => karoPts('NADPH', 4.8, 4) },
  'NADP+':  { boy: 4.8, metin: 'NADP^+',      kontur: () => karoPts('NADP^+', 4.8, 4) },
  'GRANUM': { boy: 0,   metin: '',            kontur: () => circlePts(16, 72) },
  'KALVİN': { boy: 0,   metin: '',            kontur: () => circlePts(29, 96) },
  // kloroplast zarının yerleşim pimleri
  'ZAR-SOL':{ boy: 0,   metin: '',            kontur: () => circlePts(3.2, 36) },
  'ZAR-SAG':{ boy: 0,   metin: '',            kontur: () => circlePts(3.2, 36) },
  'ZAR-UST':{ boy: 0,   metin: '',            kontur: () => circlePts(3.2, 36) },
  'ZAR-ALT':{ boy: 0,   metin: '',            kontur: () => circlePts(3.2, 36) },
};

for (const o of OK_TANIM) PARCA_TANIM[o.id] = { boy: 0, metin: '', kontur: () => okKonturu(o) };

// Oyuk konturu: parça konturunun her yönde eşit mesafede dışa ötelenmişi.
// Ölçekleme yapılırsa uzun kenarda bol, kısa kenarda sıkı olur; öteleme
// her kenarda aynı payı bırakır.
const oyukKonturu = ad => offsetPts(PARCA_TANIM[ad].kontur(), P.bosluk);

/* ---- oklar: tek 2B tanımdan hem panoya kabartılır hem renkli parça olur ---- */
const dikOkPts = (x, y0, uzun) => tasi2(don2(arrowPts(uzun, 5.5, 13, 9), -90), x, y0);
const egikOk = (x, y, aci, uzun, kal, basW, basL) =>
  tasi2(don2(arrowPts(uzun, kal, basW, basL), aci), x, y);

// Ok tanımları: kuyruk konumu + açı. Hepsi çıkarılabilir parça.
// Oklar zara DEĞMEZ: giren/çıkanlar zarın dışında durup içeriyi gösterir,
// döngü okları tamamen zarın içinde kalır.
export const SOKETLER = [
  ...YERLER.map(([ad, x, y]) => [x, y, ad]),
  ...OK_TANIM.map(o => { const m = okMerkezi(o); return [m[0], m[1], o.id]; }),
];

export const okParcasi = id => {
  const o = OK_TANIM.find(q => q.id === id);
  return new Mesh().add(extrude(okKonturu(o), 0, P.tileH));
};

/* ================= PANO ================= */

// Oyukların konumlarından panonun gözleri otomatik hesaplanır.
const OYUKLAR = SOKETLER.map(([x, y, ad]) => {
  const k = tasi2(oyukKonturu(ad), x, y);
  const xs = k.map(p => p[0]), ys = k.map(p => p[1]);
  return { ad, x, y, kontur: k,
    // 0,8 mm pay: oyuk göz kenarına değmesin, halka yüzeyi dejenere olmasın
    kutu: { x0: Math.min(...xs) - 0.8, y0: Math.min(...ys) - 0.8,
            x1: Math.max(...xs) + 0.8, y1: Math.max(...ys) + 0.8 } };
});
const BOLME = giyotin(-P.icX, -P.icY, P.icX, P.icY, OYUKLAR);

// Komşu gözlerin ortak kenarda AYNI noktaları üretmesi şart; yoksa
// T-bağlantısı oluşur ve yüzey kapanmaz. Bütün kesik çizgileri genel bir
// listeye alınır, kenarlar da adım'ın katlarına oturtulur.
const X_KESIM = BOLME.xKesim;
const Y_KESIM = BOLME.yKesim;

function kenarOrnek(ax, ay, bx, by, kesim, adim) {
  const yatay = Math.abs(by - ay) < 1e-9;
  const t0 = yatay ? ax : ay, t1 = yatay ? bx : by;
  const yon = Math.sign(t1 - t0);
  const degerler = new Set([t0]);
  for (const k of kesim) if ((k - t0) * yon > 1e-9 && (t1 - k) * yon > 1e-9) degerler.add(k);
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
  let i = 0, gecen = 0;
  for (let k = 0; k < N; k++) {
    const hedef = top * k / N;
    while (gecen + uz[i] < hedef) { gecen += uz[i]; i = (i + 1) % n; }
    const t = uz[i] < 1e-9 ? 0 : (hedef - gecen) / uz[i];
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// Verilen açılarda konturun yarıçapını bulur (ışın merkezine göre
// yıldız-biçimli kontur gerekir; oklarda merkez gövde-uç birleşimidir).
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
  const ic = cerceveOrnek(-P.icX, -P.icY, P.icX, P.icY, 4);
  const dis = boyaGoreOrnek(disHam, ic.length);

  m.add(fanFace(dis, [0, 0], 0, false));        // alt yüz
  m.add(wall(dis, 0, H, true));                 // dış duvar
  m.add(ringFace(dis, ic, H, true));            // üstte düz kenar

  // dış kenarda 1 cm yükselti: parçalar panodan kaymaz
  const cIc = boyaGoreOrnek(
    roundedRectPts(P.panoW - 2 * P.cerceveW, P.panoD - 2 * P.cerceveW, 6, 12), dis.length);
  m.add(ringFace(dis, cIc, H, false));
  m.add(wall(dis, H, H + P.cerceveH, true));
  m.add(wall(cIc, H, H + P.cerceveH, false));
  m.add(ringFace(dis, cIc, H + P.cerceveH, true));

  for (const h of BOLME.hucreler) {
    const cevre = cerceveOrnek(h.x0, h.y0, h.x1, h.y1, 4);
    if (!h.oyuk) { m.add(fanFace(cevre, [(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2], H, true)); continue; }
    const c = [h.oyuk.x, h.oyuk.y];
    const acilar = cevre.map(p => Math.atan2(p[1] - c[1], p[0] - c[0]));
    const ickontur = acilardaKontur(h.oyuk.kontur, c, acilar);
    m.add(ringFace(cevre, ickontur, H, true));          // üst yüz, oyuk kadar boş
    m.add(wall(ickontur, H - D, H, false));             // oyuk duvarı
    m.add(fanFace(ickontur, c, H - D, true));           // oyuk tabanı
  }
  return m;
}

export function panoOgeleri() {
  const o = [];
  const ekle = (ad, m, tur) => o.push({ ad, m, tur });
  ekle('plaka', zeminPlakasi(), 'taban');

  const z = P.panoH, kz = z + P.kabartma;

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

function etiket(m, metin, boy, cy = 0, z0 = P.tileH - 0.2, kal = P.yaziKal) {
  const g = yaziGenisligi(metin, boy);
  m.add(yazi(metin, { boy, kal, h: P.yaziH, z0 }).translate(-g / 2, cy - boy / 2, 0));
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
    m.add(extrude(yaySerit(0, 0, 23.5, 28, a0, a1, 48), 3.0, P.tileH + 1));
    m.add(extrude(yayUcu(0, 0, 25.7, a1, -1, 6), 3.0, P.tileH + 1));
  }
  ['IŞIĞIN', 'KULLANILMADIĞI', 'TEPKİMELER'].forEach((t, i) =>
    etiket(m, t, 3.2, 5.0 - i * 5.6, 3.0, 1.0));
  return m;
}

// Işık: güneş + yazı
export function isik() {
  const m = new Mesh();
  m.add(extrude(PARCA_TANIM['IŞIK'].kontur(), 0, P.tileH));
  return etiket(m, 'IŞIK', 5.6);
}

// Kloroplast zarı: çift çizgili oval halka. Dört pimle panoya oturur.
export const ZAR_PIM = [[-110.5, -3], [126.5, -3], [8, 75.5], [8, -81.5]];
export function kloroplastZari() {
  const n = 240;
  const oval = (rx, ry) => ellipsePts(rx, ry, n).map(p => [p[0] + OV.cx, p[1] + OV.cy]);
  const dis = oval(OV.rx, OV.ry);
  const ic = oval(OV.rx - ZAR_KAL, OV.ry - ZAR_KAL);
  const olukD = oval(OV.rx - 4.5, OV.ry - 4.5);
  const olukI = oval(OV.rx - 8.5, OV.ry - 8.5);
  const h = 5, olukZ = h - 1.6;
  const m = new Mesh();
  m.add(ringFace(dis, ic, 0, false));            // alt yüz
  m.add(wall(dis, 0, h, true));                  // dış duvar
  m.add(wall(ic, 0, h, false));                  // iç duvar
  m.add(ringFace(dis, olukD, h, true));          // üst: dış şerit
  m.add(wall(olukD, olukZ, h, false));           // oluk dış duvarı
  m.add(ringFace(olukD, olukI, olukZ, true));    // oluk tabanı
  m.add(wall(olukI, olukZ, h, true));            // oluk iç duvarı
  m.add(ringFace(olukI, ic, h, true));           // üst: iç şerit
  for (const [x, y] of ZAR_PIM) {
    m.add(cylinder(3, 2.3, 36).translate(x, y, -2.3));   // oyuk 2,5 derin: 0,2 mm pay
  }
  return m;
}

export const PANO_PARCALARI = [
  { id: 'pano-zemin', ad: 'Pano zemini (kloroplast şeması)', soket: null, yap: pano },
  { id: 'parca-kloroplast-zari', ad: 'Kloroplast zarı (çift zar halkası)', soket: null, konum: [0, 0], yap: kloroplastZari },
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

// Oklar artık çıkarılabilir parça; her biri kendi oyuğuna oturur.
export const OK_PARCALARI = OK_TANIM.map(o => ({
  id: 'parca-' + o.id, ad: o.ad, soket: o.id, yap: () => okParcasi(o.id),
}));
PANO_PARCALARI.push(...OK_PARCALARI);
