// Fotosentez ders modelinin parça tanımları.
// Hem tarayıcı arayüzü (modelleyici.html) hem de tools/fotosentez-uret.mjs bunu kullanır.
import {
  Mesh, lensPts, circlePts, roundedRectPts, arrowPts,
  extrude, extrudeRing, cylinder, pill, hemisphere, revolve
} from './mesh.js';

/* ---- ana ölçüler (mm) ---- */
const L = 140, W = 70;      // kloroplast dış ölçüsü
const FLOOR = 2.4;          // taban kalınlığı
const H = 22;               // toplam yükseklik
const MEM = 1.8;            // zar kalınlığı
const GAP = 1.6;            // zarlar arası boşluk
const GR_R = 9;             // granum yarıçapı

// İç konturlar: mercek biçimini küçülterek üretilir (ofset, sivri uçlarda bozulur).
const SEG = 96;
const kontur = d => lensPts(L - 2 * d, W - 2 * d, SEG);
const outer = kontur(0);
const memIn = kontur(MEM);
const inner2Out = kontur(MEM + GAP);
const inner2In = kontur(MEM + GAP + MEM);

// Granum yerleşimi: [x, y, disk sayısı]
const GRANA = [[-44, 0, 4], [-21, 9, 5], [1, -7, 6], [23, 8, 4], [45, 0, 3]];

/* ---- 1. Kloroplast gövdesi: çift zar + stroma tabanı ---- */
function govde() {
  const m = new Mesh();
  m.add(extrude(kontur(MEM * 0.6), 0, FLOOR));           // stroma tabanı (zarların içine gömülür)
  m.add(extrudeRing(outer, memIn, 0, H));                // dış zar
  m.add(extrudeRing(inner2Out, inner2In, 0, H - 3));     // iç zar
  // granum yuvaları: 1 mm yükseltilmiş konum halkaları
  for (const [x, y] of GRANA) {
    m.add(extrudeRing(circlePts(GR_R + 1.2, 48), circlePts(GR_R + 0.4, 48), 0, FLOOR + 1)
      .translate(x, y, 0));
  }
  return m;
}

/* ---- 2. Granum: üst üste binmiş tilakoit keseleri ---- */
function granum(n) {
  const m = new Mesh();
  const disk = 2.6, bogaz = 1.4, neckR = 3.2;
  let z = 0;
  for (let i = 0; i < n; i++) {
    m.add(pill(GR_R, disk, 0.9).translate(0, 0, z));
    z += disk;
    if (i < n - 1) { m.add(cylinder(neckR, bogaz + 0.2, 32).translate(0, 0, z - 0.1)); z += bogaz; }
  }
  // tabana oturan 0.6 mm'lik pim: yuvaya geçsin
  m.add(cylinder(GR_R + 0.25, 0.6, 48).translate(0, 0, -0.6));
  return m;
}

/* ---- 3. Stroma lamelleri: granumları bağlayan yassı kanallar ---- */
function lameller() {
  const m = new Mesh();
  const boylar = [26, 30, 24, 28];
  let y = 0;
  for (const b of boylar) {
    m.add(extrude(roundedRectPts(b, 7, 3, 6), 0, 2).translate(0, y, 0));
    y += 11;
  }
  return m;
}

/* ---- 4. Nişasta granülü ve plastoglobüller ---- */
function taneler() {
  const m = new Mesh();
  m.add(hemisphere(7, 48, 14).scale(1.5, 1, 1).translate(-20, 0, 0));   // nişasta
  m.add(hemisphere(6, 48, 14).scale(1.3, 1, 1).translate(2, 0, 0));     // nişasta
  for (let i = 0; i < 4; i++) m.add(hemisphere(2.6, 32, 10).translate(18 + i * 7, 0, 0)); // plastoglobül
  return m;
}

/* ---- 5. Madde akış okları: CO2, H2O girer; O2, glikoz çıkar ---- */
function oklar() {
  const m = new Mesh();
  const tanim = [
    { len: 40, w: 7 },   // CO2
    { len: 40, w: 7 },   // H2O
    { len: 34, w: 9 },   // O2
    { len: 34, w: 9 },   // glikoz
  ];
  let y = 0;
  for (const t of tanim) {
    m.add(extrude(arrowPts(t.len, t.w, t.w + 7, 11), 0, 3).translate(-t.len / 2, y, 0));
    y += 20;
  }
  return m;
}

/* ---- 6. Etiket plakaları + ray ayak (üzerine yazıp raya geçir) ---- */
function etiketler() {
  const m = new Mesh();
  for (let i = 0; i < 6; i++) {
    m.add(extrude(roundedRectPts(34, 12, 2, 6), 0, 1.6).translate(0, i * 15, 0));
  }
  return m;
}

function etiketRayi() {
  const m = new Mesh();
  const uzun = 120;
  m.add(extrude(roundedRectPts(uzun, 14, 2, 6), 0, 3));           // taban
  m.add(extrude(roundedRectPts(uzun - 10, 2.2, 1, 4), 0, 9).translate(0, -1.6, 0));
  m.add(extrude(roundedRectPts(uzun - 10, 2.2, 1, 4), 0, 9).translate(0, 2.4, 0));
  return m;                                                        // arada 1.8 mm yuva kalır
}

/* ---- 7. Güneş ışığı hüzmesi (kloroplasta yaslanan dekoratif parça) ---- */
function isik() {
  const m = new Mesh();
  m.add(revolve([[0, 0], [16, 0], [16, 3], [0, 3]], 64));          // güneş diski
  for (let i = 0; i < 8; i++) {
    m.add(extrude(arrowPts(16, 3.5, 7, 5), 0, 3).translate(17, 0, 0).rotateZ(i * 45));
  }
  return m;
}


export const PARCALAR = [
  { id: '1-kloroplast-govdesi', ad: 'Kloroplast gövdesi (çift zar + stroma)',
    not: 'Desteksiz basılır. Dış ve iç zar ile aralarındaki zarlar arası boşluk görünür.', yap: govde },
  { id: '2-granum-6-disk', ad: 'Granum — 6 tilakoit', not: 'Tilakoit keseleri ve bağlantı boğazları.', yap: () => granum(6) },
  { id: '2-granum-5-disk', ad: 'Granum — 5 tilakoit', not: '', yap: () => granum(5) },
  { id: '2-granum-4-disk', ad: 'Granum — 4 tilakoit', not: '', yap: () => granum(4) },
  { id: '2-granum-3-disk', ad: 'Granum — 3 tilakoit', not: '', yap: () => granum(3) },
  { id: '3-stroma-lamelleri', ad: 'Stroma lamelleri (4 adet)', not: 'Granumları birbirine bağlar; yatık yapıştırılır.', yap: lameller },
  { id: '4-nisasta-ve-plastoglobul', ad: 'Nişasta granülleri + plastoglobüller', not: 'Stroma tabanına serbest yapıştırılır.', yap: taneler },
  { id: '5-akis-oklari', ad: 'Akış okları (CO₂, H₂O, O₂, glikoz)', not: 'Uzun ikisi giren, kısa ikisi çıkan maddeler.', yap: oklar },
  { id: '6-etiket-plakalari', ad: 'Etiket plakaları (6 adet)', not: 'Üzerine kalemle yazıp raya geçirilir.', yap: etiketler },
  { id: '6-etiket-rayi', ad: 'Etiket rayı', not: '1,8 mm yuvaya plakalar dik oturur.', yap: etiketRayi },
  { id: '7-gunes-isigi', ad: 'Güneş ışığı sembolü', not: 'Modelin yanına dayanır.', yap: isik },
];
