// Fotosentez PANOSU — ders kitabındaki bilgi görselinin 3B, sökülüp takılabilir hâli.
// Zeminde soketler var; moleküller ve yapılar pimli parçalar olarak takılır.
import {
  Mesh, circlePts, ellipsePts, roundedRectPts, arrowPts,
  extrude, extrudeRing, cylinder, pill
} from './mesh.js';
import { yazi, yaziGenisligi } from './yazi.js';

/* ---- ortak ölçüler (mm) ---- */
export const P = {
  panoW: 210, panoD: 165, panoH: 5,     // zemin plakası
  pimR: 4, pimH: 2.9, bosluk: 0.35,     // pim / soket geçmesi
  soketR: 7.6, soketH: 3,               // yükseltilmiş soket halkası
  tileH: 3,
  yaziH: 1.0,                           // kabartma yüksekliği: keçeli kalem üstünü boyasın
  yaziKal: 1.3,                         // çizgi kalınlığı
  kabartma: 3.5,                        // pano üzerindeki sabit kabartmalar
  okKalinlik: 2.5,                      // üste yapıştırılan renkli ok kalınlığı
  pad: 4.5,                             // karo içindeki yazı boşluğu
};
const SOKET_IC = P.pimR + P.bosluk;

// Kloroplast konturu
const OV = { cx: 8, cy: -4, rx: 94, ry: 56 };

/* ---- soket konumları: [x, y, ad] ---- */
export const SOKETLER = [
  [-78,  58, 'IŞIK'],
  [-20,  70, 'H2O'],
  [ 62,  70, 'CO2'],
  [-32,   0, 'GRANUM'],
  [  6,  32, 'ATP'],
  [ 16,   6, 'NADPH'],
  [ 16, -16, 'NADP+'],
  [  8, -42, 'ADP'],
  [ 34, -42, 'P'],
  [ 68,   0, 'KALVİN'],
  [-32, -72, 'O2'],
  [ 70, -72, 'GLİKOZ'],
];

// Pano üzerindeki sabit yazılar: [metin, merkez x, alt kenar y, harf boyu]
export const YAZILAR = [
  ['GRANUM', -56.8, -19.5, 5.4],
  ['STROMA', 39.5, 30, 4.8],
  ['KLOROPLAST', -72, -74, 5.4],
];

/* ---- oklar: tek bir 2B tanımdan hem panoya kabartılır hem de
       üste yapıştırılacak renkli parça olarak basılır ---- */
const don2 = (pts, deg) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
  return pts.map(p => [p[0] * c - p[1] * si, p[0] * si + p[1] * c]);
};
const tasi2 = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);

// dik ok: yukarıdan aşağı
const dikOkPts = (x, y0, uzun) => tasi2(don2(arrowPts(uzun, 8.5, 19, 13), -90), x, y0);
const egikOk = (x, y, aci, uzun, kal, basW, basL) =>
  tasi2(don2(arrowPts(uzun, kal, basW, basL), aci), x, y);

export const OKLAR = [
  { id: 'ok-h2o',    ad: 'ok H2O',          poly: [dikOkPts(-20, 60, 40)] },
  { id: 'ok-co2',    ad: 'ok CO2',          poly: [dikOkPts(62, 60, 36)] },
  { id: 'ok-o2',     ad: 'ok O2',           poly: [dikOkPts(-32, -18, 44)] },
  { id: 'ok-glikoz', ad: 'ok glikoz',       poly: [dikOkPts(70, -36, 26)] },
  { id: 'ok-isik',   ad: 'ışık okları',
    poly: [0, 1, 2].map(i => egikOk(-70 - i * 7, 44 - i * 12.1, -30, 30, 6, 14, 9)) },
  { id: 'ok-dongu',  ad: 'döngü okları',
    poly: [
      egikOk(-12, 16, 62, 21, 5.5, 13, 8),
      egikOk(-8, -34, 152, 21, 5.5, 13, 8),
      egikOk(27, 26, -38, 21, 5.5, 13, 8),
      egikOk(44, -16, 202, 21, 5.5, 13, 8),
    ] },
];

// Renkli ok parçası: panodaki kabartmanın üstüne tam oturur.
export const okParcasi = id => {
  const o = OKLAR.find(q => q.id === id);
  const m = new Mesh();
  for (const p of o.poly) m.add(extrude(p, 0, P.okKalinlik));
  return m;
};

const pim = () => cylinder(P.pimR, P.pimH + 0.01, 40).translate(0, 0, -P.pimH);

// Yazıyı ortalayıp karonun üstüne kabartır.
function etiket(m, metin, boy, cy = 0, z0 = P.tileH) {
  const g = yaziGenisligi(metin, boy);
  m.add(yazi(metin, { boy, kal: P.yaziKal, h: P.yaziH, z0 }).translate(-g / 2, cy - boy / 2, 0));
  return m;
}

// Karo ölçüsü yazıdan türetilir: yazı hiçbir zaman taşmaz.
function karoOto(metin, boy, r = 6) {
  const w = yaziGenisligi(metin, boy) + 2 * P.pad;
  const h = boy + 2 * P.pad;
  const m = new Mesh();
  m.add(extrude(roundedRectPts(w, h, Math.min(r, h / 2 - 0.5), 8), 0, P.tileH));
  m.add(pim());
  return etiket(m, metin, boy);
}

// Yıldız (ATP / ADP patlama biçimi) — yazıya göre boyutlanır
function yildizKaro(metin, boy, uc = 10) {
  const icR = yaziGenisligi(metin, boy) / 2 + 2.6;
  const disR = icR * 1.45;
  const p = [];
  for (let i = 0; i < uc * 2; i++) {
    const a = Math.PI * i / uc - Math.PI / 2;
    const r = i % 2 ? icR : disR;
    p.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const m = new Mesh();
  m.add(extrude(p, 0, P.tileH));
  m.add(pim());
  return etiket(m, metin, boy);
}

// Yay biçimli şerit (dairesel ok gövdesi)
function yaySerit(cx, cy, rIc, rDis, a0, a1, n = 44) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    p.push([cx + rDis * Math.cos(a), cy + rDis * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    p.push([cx + rIc * Math.cos(a), cy + rIc * Math.sin(a)]);
  }
  return p;
}

// Yayın ucuna üçgen ok başı
function yayUcu(cx, cy, r, aci, yon = 1, b = 7) {
  const a = aci * Math.PI / 180;
  const t = [-Math.sin(a) * yon, Math.cos(a) * yon];
  const n = [Math.cos(a), Math.sin(a)];
  return [
    [cx + (r + b) * n[0], cy + (r + b) * n[1]],
    [cx + r * n[0] + t[0] * b * 1.5, cy + r * n[1] + t[1] * b * 1.5],
    [cx + (r - b) * n[0], cy + (r - b) * n[1]],
  ];
}

/* ================= PANO ================= */

export function panoOgeleri() {
  const dis = roundedRectPts(P.panoW, P.panoD, 7, 10);
  const o = [];
  const ekle = (ad, m, tur) => o.push({ ad, m, tur });

  const taban = new Mesh();
  taban.add(extrude(dis, 0, P.panoH));
  for (const [x, y] of SOKETLER) {
    taban.add(extrudeRing(circlePts(P.soketR, 36), circlePts(SOKET_IC, 36), P.panoH, P.panoH + P.soketH)
      .translate(x, y, 0));
  }
  ekle('plaka', taban, 'taban');

  const z = P.panoH, kz = z + P.kabartma;
  const oval = (rx, ry) => ellipsePts(rx, ry, 150).map(p => [p[0] + OV.cx, p[1] + OV.cy]);
  ekle('dış zar', extrudeRing(oval(OV.rx, OV.ry), oval(OV.rx - 2.2, OV.ry - 2.2), z, kz), 'zar');
  ekle('iç zar', extrudeRing(oval(OV.rx - 5.4, OV.ry - 5.4), oval(OV.rx - 7.6, OV.ry - 7.6), z, kz), 'zar');

  for (const o of OKLAR) {
    const m = new Mesh();
    for (const p of o.poly) m.add(extrude(p, z, kz));
    ekle(o.ad, m, 'ok');
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

// Granum: tilakoit yığını. Üzerinde yazı yok; adı panoda.
export function granum(n = 7) {
  const m = new Mesh();
  const r = 13, disk = 2.8, bogaz = 1.6;
  m.add(extrude(circlePts(r + 3, 48), 0, 2));
  m.add(pim());
  let z = 2;
  for (let i = 0; i < n; i++) {
    m.add(pill(r, disk, 0.9).translate(0, 0, z));
    z += disk;
    if (i < n - 1) { m.add(cylinder(4.4, bogaz + 0.2, 32).translate(0, 0, z - 0.1)); z += bogaz; }
  }
  return m;
}

// Kalvin döngüsü: kitaptaki iki kalın yaylı dairesel ok, içinde üç satır yazı
export function kalvin() {
  const m = new Mesh();
  m.add(extrude(circlePts(32, 80), 0, 2));
  m.add(pim());
  for (const [a0, a1] of [[88, -78], [-92, -262]]) {
    m.add(extrude(yaySerit(0, 0, 25.5, 31, a0, a1, 44), 2, 2 + P.tileH));
    m.add(extrude(yayUcu(0, 0, 28.2, a1, -1, 6.5), 2, 2 + P.tileH));
  }
  ['IŞIĞIN', 'KULLANILMADIĞI', 'TEPKİMELER'].forEach((t, i) => {
    etiket(m, t, 3.8, 5.4 - i * 6.2, 2);
  });
  return m;
}

export const atp = () => yildizKaro('ATP', 6);
export const adp = () => yildizKaro('ADP', 5.6);
export const fosfat = () => yildizKaro('P', 6.5, 12);
export const nadph = () => karoOto('NADPH', 5.6);
export const nadpArti = () => karoOto('NADP^+', 5.6);
export const su = () => karoOto('H_2O', 6.4);
export const karbondioksit = () => karoOto('CO_2', 6.4);
export const oksijen = () => karoOto('O_2', 6.4);
export const glikoz = () => karoOto('C_6H_1_2O_6', 5.6);

// Işık: güneş + yazı
export function isik() {
  const m = new Mesh();
  const r = 11;
  m.add(extrude(circlePts(r, 56), 0, P.tileH));
  m.add(pim());
  for (let i = 0; i < 8; i++) {
    m.add(extrude(arrowPts(6, 2.6, 5.5, 3.5), 0, P.tileH).translate(r - 0.5, 0, 0).rotateZ(i * 45));
  }
  return etiket(m, 'IŞIK', 5);
}

export const PANO_PARCALARI = [
  { id: 'pano-zemin', ad: 'Pano zemini (kloroplast şeması)', soket: null, yap: pano },
  { id: 'parca-granum', ad: 'Granum — tilakoit yığını', soket: 'GRANUM', yap: () => granum(7) },
  { id: 'parca-kalvin', ad: 'Kalvin döngüsü', soket: 'KALVİN', yap: kalvin },
  { id: 'parca-isik', ad: 'Işık (güneş)', soket: 'IŞIK', yap: isik },
  { id: 'parca-su', ad: 'H₂O', soket: 'H2O', yap: su },
  { id: 'parca-karbondioksit', ad: 'CO₂', soket: 'CO2', yap: karbondioksit },
  { id: 'parca-oksijen', ad: 'O₂', soket: 'O2', yap: oksijen },
  { id: 'parca-glikoz', ad: 'Glikoz C₆H₁₂O₆', soket: 'GLİKOZ', yap: glikoz },
  { id: 'parca-atp', ad: 'ATP', soket: 'ATP', yap: atp },
  { id: 'parca-adp', ad: 'ADP', soket: 'ADP', yap: adp },
  { id: 'parca-fosfat', ad: 'Fosfat (P)', soket: 'P', yap: fosfat },
  { id: 'parca-nadph', ad: 'NADPH', soket: 'NADPH', yap: nadph },
  { id: 'parca-nadp-arti', ad: 'NADP⁺', soket: 'NADP+', yap: nadpArti },
];

// İsteğe bağlı: okları renkli basıp panodaki kabartmanın üstüne yapıştırmak için.
export const OK_PARCALARI = OKLAR.map(o => ({
  id: 'renkli-' + o.id, ad: 'Renkli ' + o.ad, yap: () => okParcasi(o.id),
}));
