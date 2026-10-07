// Fotosentez PANOSU: baskıya hazır STL üretici.
// Çalıştır: node tools/fotosentez-pano-uret.mjs
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Mesh, toBinarySTL, checkWatertight, volume } from '../assets/mesh.js';
import { PANO_PARCALARI, SOKETLER, P } from '../assets/fotosentez-pano.js';

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
for (const p of PANO_PARCALARI) toplam += yaz(p.id, p.yap().center());

/* ---- 2) Montaj: hepsi takılı hâlde tek dosya. Sadece görüntülemek için. ---- */
const soket = ad => SOKETLER.find(s => s[2] === ad);
const montaj = new Mesh();
for (const p of PANO_PARCALARI) {
  const s = p.soket ? soket(p.soket) : null;
  const yer = p.konum ?? (s ? [s[0], s[1]] : null);
  const z = p.konum ? P.panoH : P.panoH - P.oyukDerin;
  montaj.add(yer ? p.yap().translate(yer[0], yer[1], z) : p.yap());
}
console.log('');
yaz('00-MONTAJ-sadece-goruntuleme', montaj.center());

/* ---- 4) Toplu gönderim için zip ---- */
// Eski zip silinmeden yenilenirse eski sürümün dosyaları içeride kalır.
try {
  const ust = fileURLToPath(new URL('../modeller/', import.meta.url));
  rmSync(ust + 'fotosentez-pano.zip', { force: true });
  execFileSync('zip', ['-qr9', 'fotosentez-pano.zip', 'fotosentez-pano'], { cwd: ust });
  console.log('\nmodeller/fotosentez-pano.zip yenilendi (toplu gönderim için)');
} catch (e) {
  console.log('\nzip oluşturulamadı:', e.message);
}

console.log(`\n${PANO_PARCALARI.length} dosya + 1 montaj + 4 baskı tablası`
  + ` · kaba filament ≈ ${(toplam * 0.25 * 1.24).toFixed(0)} g`);
