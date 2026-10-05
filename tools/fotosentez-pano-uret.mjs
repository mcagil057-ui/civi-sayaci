// Fotosentez PANOSU: baskıya hazır STL üretici.
// Çalıştır: node tools/fotosentez-pano-uret.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { Mesh, toBinarySTL, checkWatertight, volume } from '../assets/mesh.js';
import { PANO_PARCALARI, OK_PARCALARI, OKLAR, okParcasi, SOKETLER, P } from '../assets/fotosentez-pano.js';

const OUT = new URL('../modeller/fotosentez-pano/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const yaz = (ad, mesh) => {
  const b = mesh.bounds(), q = checkWatertight(mesh), v = volume(mesh) / 1000;
  writeFileSync(new URL(ad + '.stl', OUT), toBinarySTL(mesh, ad));
  console.log(`${ad.padEnd(34)} ${b.size.map(x => x.toFixed(1)).join(' x ').padStart(22)} mm`
    + ` ${v.toFixed(1).padStart(6)} cm³  ${q.ok ? 'kapalı ✓' : '⚠ ' + q.badEdges}`);
  return v;
};

/* ---- 1) Tek tek parçalar (renk değiştirmek isteyen için) ---- */
let toplam = 0;
for (const p of [...PANO_PARCALARI, ...OK_PARCALARI]) toplam += yaz(p.id, p.yap().center());

/* ---- 2) Montaj: hepsi takılı hâlde tek dosya. Sadece görüntülemek için. ---- */
const soket = ad => SOKETLER.find(s => s[2] === ad);
const montaj = new Mesh();
for (const p of PANO_PARCALARI) {
  const s = p.soket ? soket(p.soket) : null;
  montaj.add(s ? p.yap().translate(s[0], s[1], P.panoH + P.soketH) : p.yap());
}
for (const o of OKLAR) montaj.add(okParcasi(o.id).translate(0, 0, P.panoH + P.kabartma));
console.log('');
yaz('00-MONTAJ-sadece-goruntuleme', montaj.center());

/* ---- 3) Baskı tablaları: parçalar yan yana dizili, üst üste gelmez ---- */
// basit raf yerleşimi
function tablaya(parcalar, genislik = 210, bosluk = 6) {
  const m = new Mesh();
  let x = 0, y = 0, rafY = 0;
  for (const p of parcalar) {
    const t = p.center();
    const b = t.bounds();
    if (x > 0 && x + b.size[0] > genislik) { x = 0; y += rafY + bosluk; rafY = 0; }
    m.add(t.translate(x + b.size[0] / 2, y + b.size[1] / 2, 0));
    x += b.size[0] + bosluk;
    rafY = Math.max(rafY, b.size[1]);
  }
  return m.center();
}
console.log('');
yaz('baski-1-pano', PANO_PARCALARI[0].yap().center());
yaz('baski-2-parcalar', tablaya(PANO_PARCALARI.slice(1).map(p => p.yap())));
yaz('baski-3-renkli-oklar', tablaya(OK_PARCALARI.map(p => p.yap())));

console.log(`\n${PANO_PARCALARI.length + OK_PARCALARI.length} tekil parça + 1 montaj + 3 baskı tablası`
  + ` · kaba filament ≈ ${(toplam * 0.25 * 1.24).toFixed(0)} g`);
