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
const OV = { cx: 6, cy: 0, rx: 80, ry: 48 };

/* ---- soket konumları: [x, y, etiket] ---- */
export const SOKETLER = [
  [-46,   2, 'GRANUM'],
  [ 56,  -2, 'KALVİN'],
  [  6,  28, 'ATP'],
  [  6,   9, 'NADPH'],
  [  6, -11, 'NADP+'],
  [ -2, -30, 'ADP'],
  [ 22, -30, 'P'],
  [-30,  58, 'H2O'],
  [ 46,  58, 'CO2'],
  [-30, -58, 'O2'],
  [ 46, -58, 'GLİKOZ'],
  [-84,  30, 'IŞIK'],
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

export function pano() {
  const dis = roundedRectPts(P.panoW, P.panoD, 6, 10);
  const m = new Mesh();
  m.add(extrude(dis, 0, P.panoH));
  // soketler: plakaya delik açmak yerine yükseltilmiş halka.
  // Baskıda köprüleme gerekmez, parçalar halkanın içine oturur.
  for (const [x, y] of SOKETLER) {
    m.add(extrudeRing(circlePts(P.soketR, 36), circlePts(SOKET_IC, 36), P.panoH, P.panoH + P.soketH)
      .translate(x, y, 0));
  }

  const z = P.panoH, kz = z + P.kabartma;

  // çift zar: iki kabartma oval şerit
  const ovalPts = (rx, ry) => ellipsePts(rx, ry, 120).map(p => [p[0] + OV.cx, p[1] + OV.cy]);
  m.add(extrudeRing(ovalPts(OV.rx, OV.ry), ovalPts(OV.rx - 1.8, OV.ry - 1.8), z, kz));
  m.add(extrudeRing(ovalPts(OV.rx - 4.4, OV.ry - 4.4), ovalPts(OV.rx - 6.2, OV.ry - 6.2), z, kz));

  // dik oklar: H2O ve CO2 girer (aşağı), O2 ve glikoz çıkar (aşağı)
  const dikOk = (x, y0, uzun) => extrude(arrowPts(uzun, 5, 11, 8), z, kz)
    .rotateZ(-90).translate(x, y0, 0);
  m.add(dikOk(-30, 50, 22));     // H2O içeri
  m.add(dikOk(46, 50, 22));      // CO2 içeri
  m.add(dikOk(-30, -28, 22));    // O2 dışarı
  m.add(dikOk(46, -28, 22));     // glikoz dışarı

  // ışık okları
  for (let i = 0; i < 3; i++) {
    m.add(extrude(arrowPts(26, 4, 9, 7), z, kz).rotateZ(-26).translate(-88, 40 - i * 13, 0));
  }

  // granum -> kalvin (ATP, NADPH taşınır) ve kalvin -> granum (ADP, NADP+ döner)
  const yayZ = (pts) => extrude(pts, z, kz);
  m.add(yayZ(yaySerit(6, 9, 36, 40, 160, 20, 44)));
  m.add(yayZ(yayUcu(6, 9, 38, 20, -1)));
  m.add(yayZ(yaySerit(6, -11, 36, 40, 200, 340, 44)));
  m.add(yayZ(yayUcu(6, -11, 38, 200, -1)));

  // pano üstü sabit yazılar
  const y = (t, x, yy, boy = 5.4) =>
    m.add(yazi(t, { boy, kal: P.yaziKal, h: P.yaziH, z0: z })
      .translate(x - yaziGenisligi(t, boy) / 2, yy, 0));
  y('FOTOSENTEZ', 0, 65, 7);
  y('KLOROPLAST', -68, -62, 5.6);
  y('STROMA', 34, 33);
  y('ÇİFT ZAR', -56, 38);
  y('IŞIĞIN KULLANILDIĞI', -52, -19.5, 3.6);
  y('TEPKİMELER', -52, -25, 3.6);
  y('IŞIĞIN KULLANILMADIĞI', 58, -41, 3.6);
  y('TEPKİMELER', 58, -46.5, 3.6);
  y('6CO_2 + 6H_2O + IŞIK → C_6H_1_2O_6 + 6O_2', 6, -71, 4.0);
  return m;
}

/* ================= TAKILAN PARÇALAR ================= */

// Granum: tilakoit yığını (panonun en belirgin parçası)
export function granum(n = 6) {
  const m = new Mesh();
  const r = 13, disk = 2.8, bogaz = 1.6;
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
  m.add(extrude(circlePts(27, 64), 0, 2));
  m.add(pim());
  m.add(extrude(yaySerit(0, 0, 17, 24, 125, -200, 50), 2, 2 + P.tileH));
  m.add(extrude(yayUcu(0, 0, 20.5, -200, -1, 5.5), 2, 2 + P.tileH));
  const t1 = 'KALVİN', t2 = 'DÖNGÜSÜ';
  m.add(yazi(t1, { boy: 4.6, kal: 0.9, h: 0.7, z0: 2 }).translate(-yaziGenisligi(t1, 4.6) / 2, 1.2, 0));
  m.add(yazi(t2, { boy: 4.6, kal: 0.9, h: 0.7, z0: 2 }).translate(-yaziGenisligi(t2, 4.6) / 2, -6.4, 0));
  return m;
}

export const atp = () => karo(yildizPts(10, 17, 11.5), 'ATP', { boy: 6 });
export const adp = () => karo(yildizPts(10, 15, 10), 'ADP', { boy: 5.4 });
export const nadph = () => karo(roundedRectPts(34, 15, 7, 8), 'NADPH', { boy: 5.4 });
export const nadpArti = () => karo(roundedRectPts(34, 15, 7, 8), 'NADP^+', { boy: 5.4 });
export const fosfat = () => karo(circlePts(9.5, 40), 'P', { boy: 6.5 });
export const su = () => karo(roundedRectPts(26, 15, 7, 8), 'H_2O', { boy: 5.8 });
export const karbondioksit = () => karo(roundedRectPts(26, 15, 7, 8), 'CO_2', { boy: 5.8 });
export const oksijen = () => karo(roundedRectPts(24, 15, 7, 8), 'O_2', { boy: 5.8 });
export const glikoz = () => karo(roundedRectPts(42, 15, 7, 8), 'C_6H_1_2O_6', { boy: 5.2 });

// Işık: güneş + yazı
export function isik() {
  const m = new Mesh();
  m.add(extrude(circlePts(13, 48), 0, P.tileH));
  m.add(pim());
  for (let i = 0; i < 8; i++) {
    m.add(extrude(arrowPts(9, 2.6, 5.5, 4), 0, P.tileH).translate(13, 0, 0).rotateZ(i * 45));
  }
  const g = yaziGenisligi('IŞIK', 5);
  m.add(yazi('IŞIK', { boy: 5, kal: 0.9, h: 0.7, z0: P.tileH }).translate(-g / 2, -2.5, 0));
  return m;
}

export const PANO_PARCALARI = [
  { id: 'pano-zemin', ad: 'Pano zemini (kloroplast şeması)', soket: null, yap: pano },
  { id: 'parca-granum', ad: 'Granum — tilakoit yığını', soket: 'GRANUM', yap: () => granum(6) },
  { id: 'parca-kalvin', ad: 'Kalvin döngüsü', soket: 'KALVİN', yap: kalvin },
  { id: 'parca-atp', ad: 'ATP', soket: 'ATP', yap: atp },
  { id: 'parca-adp', ad: 'ADP', soket: 'ADP', yap: adp },
  { id: 'parca-nadph', ad: 'NADPH', soket: 'NADPH', yap: nadph },
  { id: 'parca-nadp-arti', ad: 'NADP⁺', soket: 'NADP+', yap: nadpArti },
  { id: 'parca-fosfat', ad: 'Fosfat (P)', soket: 'P', yap: fosfat },
  { id: 'parca-su', ad: 'H₂O', soket: 'H2O', yap: su },
  { id: 'parca-karbondioksit', ad: 'CO₂', soket: 'CO2', yap: karbondioksit },
  { id: 'parca-oksijen', ad: 'O₂', soket: 'O2', yap: oksijen },
  { id: 'parca-glikoz', ad: 'Glikoz C₆H₁₂O₆', soket: 'GLİKOZ', yap: glikoz },
  { id: 'parca-isik', ad: 'Işık', soket: 'IŞIK', yap: isik },
];
