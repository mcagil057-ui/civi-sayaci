// Fotosentez PANOSU: baskıya hazır STL üretici.
// Çalıştır: node tools/fotosentez-pano-uret.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { toBinarySTL, checkWatertight, volume } from '../assets/mesh.js';
import { PANO_PARCALARI, SOKETLER, P } from '../assets/fotosentez-pano.js';

const OUT = new URL('../modeller/fotosentez-pano/', import.meta.url);
mkdirSync(OUT, { recursive: true });

let toplam = 0;
for (const p of PANO_PARCALARI) {
  const m = p.yap().center();
  const b = m.bounds(), q = checkWatertight(m), v = volume(m) / 1000;
  toplam += v;
  writeFileSync(new URL(p.id + '.stl', OUT), toBinarySTL(m, p.id));
  console.log(`${p.id.padEnd(22)} ${b.size.map(x => x.toFixed(1)).join(' x ').padStart(22)} mm`
    + ` ${v.toFixed(1).padStart(6)} cm³  ${q.ok ? 'kapalı ✓' : '⚠ ' + q.badEdges}`);
}
console.log(`\n${PANO_PARCALARI.length} dosya · ${SOKETLER.length} soket · pim Ø${P.pimR * 2} mm`
  + ` · kaba filament ≈ ${(toplam * 0.25 * 1.24).toFixed(0)} g`);
