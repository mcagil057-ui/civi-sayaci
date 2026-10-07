// TESLİM EDİLEN DOSYALARI denetler: STL'leri diskten okur, üreticiye güvenmez.
// Çalıştır: node tools/dosya-denetim.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { Mesh, checkWatertight, volume } from '../assets/mesh.js';
import { PANO_PARCALARI } from '../assets/fotosentez-pano.js';

const DIZIN = new URL('../modeller/fotosentez-pano/', import.meta.url);
const TABLA = 300;

function stlOku(yol) {
  const buf = readFileSync(yol);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint32(80, true);
  const tris = [];
  let o = 84;
  for (let i = 0; i < n; i++) {
    o += 12;                                  // normal atlanır, yeniden hesaplanır
    const t = [];
    for (let k = 0; k < 3; k++) {
      t.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]);
      o += 12;
    }
    o += 2;
    tris.push(t);
  }
  return new Mesh(tris);
}

const dosyalar = readdirSync(DIZIN).filter(f => f.endsWith('.stl')).sort();
let hata = 0, toplamHacim = 0;

// eksik / fazla dosya denetimi
const olmasiGereken = new Set([...PANO_PARCALARI.map(p => p.id + '.stl'), '00-MONTAJ-sadece-goruntuleme.stl']);
const varOlan = new Set(dosyalar);
for (const f of olmasiGereken) if (!varOlan.has(f)) { console.log(`✗ EKSİK dosya: ${f}`); hata++; }
for (const f of varOlan) if (!olmasiGereken.has(f)) { console.log(`✗ FAZLA dosya (eski sürümden kalmış): ${f}`); hata++; }

console.log('Dosya                                 ölçü (mm)        hacim   üçgen   durum');
console.log('─'.repeat(84));
for (const f of dosyalar) {
  const m = stlOku(new URL(f, DIZIN));
  const b = m.bounds(), q = checkWatertight(m), v = volume(m) / 1000;
  const sigar = b.size[0] <= TABLA && b.size[1] <= TABLA;
  const montaj = f.startsWith('00-');
  if (!montaj) toplamHacim += v;
  const sorun = [];
  if (!q.ok) sorun.push(`${q.badEdges} açık kenar`);
  if (!sigar && !montaj) sorun.push('tablaya sığmıyor');
  if (m.tris.length < 4) sorun.push('boş dosya');
  if (sorun.length) hata++;
  const olcu = b.size.map(x => x.toFixed(1)).join('×');
  console.log(`${f.replace('.stl', '').padEnd(36)} ${olcu.padStart(16)} ${v.toFixed(1).padStart(7)} ${String(m.tris.length).padStart(7)}   ${sorun.length ? '✗ ' + sorun.join(', ') : '✓'}`);
}
console.log('─'.repeat(84));
console.log(`${dosyalar.length} dosya · basılacak toplam hacim ${toplamHacim.toFixed(1)} cm³ ≈ ${(toplamHacim * 0.25 * 1.24).toFixed(0)} g`);
console.log(hata ? `${hata} DOSYADA SORUN VAR` : 'Bütün dosyalar kapalı yüzey ve 300×300 tablaya sığıyor.');
process.exit(hata ? 1 : 0);
