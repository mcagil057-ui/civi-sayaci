// Pano yazıları için çakışmasız konum arar.
// Kullanım: node tools/yer-ara.mjs "STROMA"
import { panoOgeleri, PANO_PARCALARI, SOKETLER, P, YAZILAR } from '../assets/fotosentez-pano.js';
import { yazi, yaziGenisligi } from '../assets/yazi.js';

const hedef = process.argv[2];
const satir = YAZILAR.find(y => y[0] === hedef);
if (!satir) { console.error('bilinmeyen yazı:', hedef); process.exit(1); }
const boy = satir[3];

const COZ = 0.5, X0 = -P.panoW / 2 - 2, Y0 = -P.panoD / 2 - 2;
const W = Math.ceil((P.panoW + 4) / COZ), H = Math.ceil((P.panoD + 4) / COZ);
function iz(mesh) {
  const m = new Uint8Array(W * H);
  for (const t of mesh.tris) {
    const px = t.map(p => [(p[0] - X0) / COZ, (p[1] - Y0) / COZ]);
    const mnx = Math.max(0, Math.floor(Math.min(...px.map(p => p[0])))), mxx = Math.min(W - 1, Math.ceil(Math.max(...px.map(p => p[0]))));
    const mny = Math.max(0, Math.floor(Math.min(...px.map(p => p[1])))), mxy = Math.min(H - 1, Math.ceil(Math.max(...px.map(p => p[1]))));
    const [a, b, c] = px, d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(d) < 1e-9) continue;
    for (let y = mny; y <= mxy; y++) for (let x = mnx; x <= mxx; x++) {
      const pxx = x + 0.5, pyy = y + 0.5;
      const w0 = ((b[0] - pxx) * (c[1] - pyy) - (c[0] - pxx) * (b[1] - pyy)) / d;
      const w1 = ((c[0] - pxx) * (a[1] - pyy) - (a[0] - pxx) * (c[1] - pyy)) / d;
      if (w0 >= -1e-9 && w1 >= -1e-9 && 1 - w0 - w1 >= -1e-9) m[y * W + x] = 1;
    }
  }
  return m;
}

const dolu = new Uint8Array(W * H);
const kat = m => { for (let i = 0; i < m.length; i++) if (m[i]) dolu[i] = 1; };
for (const o of panoOgeleri()) {
  if (o.tur === 'taban' || o.ad === 'yazı: ' + hedef) continue;
  kat(iz(o.m));
}
for (const p of PANO_PARCALARI) {
  if (!p.soket) continue;
  const s = SOKETLER.find(q => q[2] === p.soket);
  kat(iz(p.yap().translate(s[0], s[1], 0)));
}

const g = yaziGenisligi(hedef, boy);
const sablon = yazi(hedef, { boy, kal: P.yaziKal, h: P.yaziH, z0: P.panoH });
const iyi = [];
for (let cx = -P.panoW / 2 + g / 2 + 3; cx <= P.panoW / 2 - g / 2 - 3; cx += 2)
  for (let cy = -P.panoD / 2 + 3; cy <= P.panoD / 2 - boy - 3; cy += 1) {
    const m = iz(sablon.translate(cx - g / 2, cy, 0));
    let c = false;
    for (let i = 0; i < m.length; i++) if (m[i] && dolu[i]) { c = true; break; }
    if (!c) iyi.push([cx, cy]);
  }
// --ic verilirse yazı tamamen iç zarın içinde kalmalı
const sadeceIc = process.argv.includes('--ic');
const OVin = { cx: 8, cy: -4, rx: 94 - 7.6, ry: 56 - 7.6 };
const icte = (cx, cy) => {
  const kose = [[cx - g / 2, cy], [cx + g / 2, cy], [cx - g / 2, cy + boy], [cx + g / 2, cy + boy]];
  return kose.every(([x, y]) =>
    ((x - OVin.cx) / OVin.rx) ** 2 + ((y - OVin.cy) / OVin.ry) ** 2 < 0.97);
};
const sonuc = sadeceIc ? iyi.filter(p => icte(p[0], p[1])) : [...iyi];  // kopya şart: aynı dizi olursa aşağıdaki temizleme sonucu siler
iyi.length = 0; iyi.push(...sonuc);

const hx = satir[1], hy = satir[2];
iyi.sort((a, b) => Math.hypot(a[0] - hx, a[1] - hy) - Math.hypot(b[0] - hx, b[1] - hy));
console.log(`${hedef} (boy ${boy}, genişlik ${g.toFixed(1)} mm) — ${iyi.length} çakışmasız konum`);
console.log('istenen yere en yakın 6:', iyi.slice(0, 6).map(p => `[${p[0]}, ${p[1]}]`).join('  '));
