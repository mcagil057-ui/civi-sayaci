// Fotosentez PANOSU: ders kitabındaki şemanın 3B, sökülüp takılabilir hâli.
// Zemin plakasında soketler var; moleküller ve yapılar pimli parçalar olarak takılır.
// Bütün pimler aynı çapta — öğrenci hangi parçanın nereye gittiğini kendi bulmalı.
import {
  Mesh, circlePts, ellipsePts, roundedRectPts, arrowPts,
  extrude, extrudeRing, cylinder, pill
} from './mesh.js';
import { yazi, yaziGenisligi } from './yazi.js';

/* ---- ortak ölçüler (mm) ---- */
export const P = {
  panoW: 200, panoD: 150, panoH: 5,     // zemin plakası
  pimR: 4, pimH: 2.9, bosluk: 0.35,     // pim / soket geçmesi
  soketR: 7.6, soketH: 3,               // yükseltilmiş soket halkası
  tileH: 3, yaziH: 0.8, yaziBoy: 5.4, yaziKal: 1.0,
  kabartma: 1.8,                        // pano üzerindeki sabit kabartmalar
};
const SOKET_IC = P.pimR + P.bosluk;

// Kloroplast ovali
const OV = { cx: 2, cy: -2, rx: 84, ry: 36 };

/* ---- soket konumları: [x, y, etiket] ---- */
export const SOKETLER = [
  [-72,  49, 'IŞIK'],
  [-18,  49, 'H2O'],
  [ 38,  49, 'CO2'],
  [-50,  -4, 'GRANUM'],
  [-18,  12, 'ATP'],
  [ 14,  12, 'NADPH'],
  [ 22, -16, 'NADP+'],
  [-14, -16, 'ADP'],
  [ 58,  -6, 'KALVİN'],
  [-34, -58, 'O2'],
  [ 46, -58, 'GLİKOZ'],
];

// Pano üzerindeki sabit yazılar: [metin, merkez x, alt kenar y, harf boyu]
export const YAZILAR = [
  ['FOTOSENTEZ', 0, 66, 7],
  ['STROMA', 4, 22, 4.2],
  ['ÇİFT ZAR', 76, 36, 4.6],
  ['IŞIK TEPKİMELERİ', -48, -45, 3.6],
  ['IŞIKSIZ TEPKİMELER', 46, -45, 3.6],
  ['KLOROPLAST', -74, -62, 5],
  ['6CO_2 + 6H_2O + IŞIK → C_6H_1_2O_6 + 6O_2', 6, -71, 4.0],
];

const pim = () => cylinder(P.pimR, P.pimH + 0.01, 40).translate(0, 0, -P.pimH);

// Üstüne yazı kabartılmış, altına pim eklenmiş karo.
function karo(kontur, metin, o = {}) {
  const m = new Mesh();
  m.add(extrude(kontur, 0, P.tileH));
  m.add(pim());
  const boy = o.boy ?? P.yaziBoy;
  const g = yaziGenisligi(metin, boy);
  m.add(yazi(metin, { boy, kal: P.yaziKal, h: P.yaziH, z0: P.tileH })
    .translate((o.mx ?? 0) - g / 2, (o.my ?? 0) - boy / 2, 0));
  return m;
}

// Yıldız (ATP / ADP patlama biçimi)
const yildizPts = (uc, disR, icR) => {
  const p = [];
  for (let i = 0; i < uc * 2; i++) {
    const a = Math.PI * i / uc - Math.PI / 2;
    const r = i % 2 ? icR : disR;
    p.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return p;
};

// Yay biçimli şerit (dairesel ok gövdesi)
function yaySerit(cx, cy, rIc, rDis, a0, a1, n = 40) {
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
  const t = [-Math.sin(a) * yon, Math.cos(a) * yon];     // teğet
  const n = [Math.cos(a), Math.sin(a)];                  // normal
  const u = [cx + r * n[0] + t[0] * b * 1.4, cy + r * n[1] + t[1] * b * 1.4];
  return [
    [cx + (r + b) * n[0], cy + (r + b) * n[1]],
    u,
    [cx + (r - b) * n[0], cy + (r - b) * n[1]],
  ];
}

/* ================= PANO ================= */

// Panonun üzerindeki her kabartma öğe ayrı ayrı döner.
// Böylece yerleşim denetleyicisi (tools/yerlesim-denetle.mjs) çakışmaları ölçebilir.
export function panoOgeleri() {
  const dis = roundedRectPts(P.panoW, P.panoD, 6, 10);
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
  const ovalPts = (rx, ry) => ellipsePts(rx, ry, 120).map(p => [p[0] + OV.cx, p[1] + OV.cy]);
  ekle('dış zar', extrudeRing(ovalPts(OV.rx, OV.ry), ovalPts(OV.rx - 1.8, OV.ry - 1.8), z, kz), 'zar');
  ekle('iç zar', extrudeRing(ovalPts(OV.rx - 4.4, OV.ry - 4.4), ovalPts(OV.rx - 6.2, OV.ry - 6.2), z, kz), 'zar');

  // dik oklar: üstten giren (aşağı bakar), alttan çıkan (aşağı bakar)
  const dikOk = (x, y0, uzun) => extrude(arrowPts(uzun, 5, 11, 7), z, kz)
    .rotateZ(-90).translate(x, y0, 0);
  ekle('ok H2O', dikOk(-18, 40, 7), 'ok');
  ekle('ok CO2', dikOk(38, 40, 9), 'ok');
  ekle('ok O2', dikOk(-34, -34, 7), 'ok');
  ekle('ok glikoz', dikOk(46, -33, 8), 'ok');

  const isikOk = new Mesh();
  for (let i = 0; i < 3; i++) {
    isikOk.add(extrude(arrowPts(18, 4, 9, 6), z, kz).translate(-95, 18 - i * 10, 0));
  }
  ekle('ışık okları', isikOk, 'ok');

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

// Granum: tilakoit yığını (panonun en belirgin parçası)
export function granum(n = 6) {
  const m = new Mesh();
  const r = 12, disk = 2.8, bogaz = 1.6;
  m.add(extrude(circlePts(r + 3, 48), 0, 2));          // oturma tabanı
  m.add(pim());
  let z = 2;
  for (let i = 0; i < n; i++) {
    m.add(pill(r, disk, 0.9).translate(0, 0, z));
    z += disk;
    if (i < n - 1) { m.add(cylinder(4.2, bogaz + 0.2, 32).translate(0, 0, z - 0.1)); z += bogaz; }
  }
  const g = yaziGenisligi('GRANUM', 4.4);
  m.add(yazi('GRANUM', { boy: 4.4, kal: 0.9, h: 0.7, z0: z }).translate(-g / 2, -2.2, 0));
  return m;
}

// Kalvin döngüsü: dairesel ok
export function kalvin() {
  const m = new Mesh();
  m.add(extrude(circlePts(20, 64), 0, 2));
  m.add(pim());
  m.add(extrude(yaySerit(0, 0, 12, 17.5, 125, -200, 50), 2, 2 + P.tileH));
  m.add(extrude(yayUcu(0, 0, 14.8, -200, -1, 4.5), 2, 2 + P.tileH));
  const t1 = 'KALVİN', t2 = 'DÖNGÜSÜ';
  m.add(yazi(t1, { boy: 3.6, kal: 0.85, h: 0.7, z0: 2 }).translate(-yaziGenisligi(t1, 3.6) / 2, 0.8, 0));
  m.add(yazi(t2, { boy: 3.6, kal: 0.85, h: 0.7, z0: 2 }).translate(-yaziGenisligi(t2, 3.6) / 2, -5.2, 0));
  return m;
}

export const atp = () => karo(yildizPts(10, 11, 7.5), 'ATP', { boy: 5 });
// ADP ile fosfat tek parça: panoda ikisi ayrı durduğunda yer kalmıyordu
export const adpFosfat = () => karo(roundedRectPts(38, 14, 6, 8), 'ADP + P', { boy: 4.6 });
export const nadph = () => karo(roundedRectPts(28, 13, 6, 8), 'NADPH', { boy: 4.6 });
export const nadpArti = () => karo(roundedRectPts(27, 13, 6, 8), 'NADP^+', { boy: 4.6 });
export const su = () => karo(roundedRectPts(26, 14, 6, 8), 'H_2O', { boy: 5.2 });
export const karbondioksit = () => karo(roundedRectPts(26, 14, 6, 8), 'CO_2', { boy: 5.2 });
export const oksijen = () => karo(roundedRectPts(24, 14, 6, 8), 'O_2', { boy: 5.2 });
export const glikoz = () => karo(roundedRectPts(42, 14, 6, 8), 'C_6H_1_2O_6', { boy: 4.8 });

// Işık: güneş + yazı
export function isik() {
  const m = new Mesh();
  m.add(extrude(circlePts(9, 48), 0, P.tileH));
  m.add(pim());
  for (let i = 0; i < 8; i++) {
    m.add(extrude(arrowPts(5, 2.2, 4.5, 3), 0, P.tileH).translate(9, 0, 0).rotateZ(i * 45));
  }
  const g = yaziGenisligi('IŞIK', 4.2);
  m.add(yazi('IŞIK', { boy: 4.2, kal: 0.85, h: 0.7, z0: P.tileH }).translate(-g / 2, -2.1, 0));
  return m;
}

export const PANO_PARCALARI = [
  { id: 'pano-zemin', ad: 'Pano zemini (kloroplast şeması)', soket: null, yap: pano },
  { id: 'parca-granum', ad: 'Granum — tilakoit yığını', soket: 'GRANUM', yap: () => granum(6) },
  { id: 'parca-kalvin', ad: 'Kalvin döngüsü', soket: 'KALVİN', yap: kalvin },
  { id: 'parca-atp', ad: 'ATP', soket: 'ATP', yap: atp },
  { id: 'parca-adp-fosfat', ad: 'ADP + P', soket: 'ADP', yap: adpFosfat },
  { id: 'parca-nadph', ad: 'NADPH', soket: 'NADPH', yap: nadph },
  { id: 'parca-nadp-arti', ad: 'NADP⁺', soket: 'NADP+', yap: nadpArti },
  { id: 'parca-su', ad: 'H₂O', soket: 'H2O', yap: su },
  { id: 'parca-karbondioksit', ad: 'CO₂', soket: 'CO2', yap: karbondioksit },
  { id: 'parca-oksijen', ad: 'O₂', soket: 'O2', yap: oksijen },
  { id: 'parca-glikoz', ad: 'Glikoz C₆H₁₂O₆', soket: 'GLİKOZ', yap: glikoz },
  { id: 'parca-isik', ad: 'Işık', soket: 'IŞIK', yap: isik },
];
