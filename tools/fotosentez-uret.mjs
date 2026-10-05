// Fotosentez ders modeli: baskıya hazır STL üretici.
// Çalıştır:  node tools/fotosentez-uret.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { toBinarySTL, checkWatertight, volume } from '../assets/mesh.js';
import { PARCALAR } from '../assets/fotosentez.js';

const OUT = new URL('../modeller/fotosentez/', import.meta.url);
mkdirSync(OUT, { recursive: true });

let toplamHacim = 0;
for (const p of PARCALAR) {
  const m = p.yap().center();
  const b = m.bounds(), q = checkWatertight(m), v = volume(m) / 1000; // cm³
  toplamHacim += v;
  writeFileSync(new URL(p.id + '.stl', OUT), toBinarySTL(m, p.id));
  const ol = b.size.map(x => x.toFixed(1)).join(' x ');
  console.log(`${p.id.padEnd(28)} ${ol.padStart(22)} mm ${v.toFixed(1).padStart(7)} cm³  ${q.ok ? 'kapalı yüzey ✓' : '⚠ açık kenar: ' + q.badEdges}`);
}
console.log(`\n${PARCALAR.length} parça — kaba filament ihtiyacı ≈ ${(toplamHacim * 0.3 * 1.24).toFixed(0)} g (%30 dolgu, PLA)`);
