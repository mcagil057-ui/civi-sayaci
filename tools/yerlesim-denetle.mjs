// Panodaki kabartma öğelerin ÜST GÖRÜNÜŞTE çakışıp çakışmadığını ölçer.
// Her öğenin XY ayak izi 0,4 mm'lik gözlere taranır; kesişen göz sayısı raporlanır.
import { panoOgeleri, PANO_PARCALARI, SOKETLER, P } from '../assets/fotosentez-pano.js';

const COZ = 0.4;                                  // mm / göz
const X0 = -P.panoW / 2 - 2, Y0 = -P.panoD / 2 - 2;
const W = Math.ceil((P.panoW + 4) / COZ), H = Math.ceil((P.panoD + 4) / COZ);

function ayakIzi(mesh) {
  const mask = new Uint8Array(W * H);
  for (const t of mesh.tris) {
    const px = t.map(p => [(p[0] - X0) / COZ, (p[1] - Y0) / COZ]);
    const minx = Math.max(0, Math.floor(Math.min(...px.map(p => p[0]))));
    const maxx = Math.min(W - 1, Math.ceil(Math.max(...px.map(p => p[0]))));
    const miny = Math.max(0, Math.floor(Math.min(...px.map(p => p[1]))));
    const maxy = Math.min(H - 1, Math.ceil(Math.max(...px.map(p => p[1]))));
    const [a, b, c] = px;
    const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(d) < 1e-9) continue;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const pxx = x + 0.5, pyy = y + 0.5;
      const w0 = ((b[0] - pxx) * (c[1] - pyy) - (c[0] - pxx) * (b[1] - pyy)) / d;
      const w1 = ((c[0] - pxx) * (a[1] - pyy) - (a[0] - pxx) * (c[1] - pyy)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= -1e-9 && w1 >= -1e-9 && w2 >= -1e-9) mask[y * W + x] = 1;
    }
  }
  return mask;
}

const oge = [];
for (const o of panoOgeleri()) {
  if (o.tur === 'taban') continue;
  oge.push({ ad: o.ad, tur: o.tur, mask: ayakIzi(o.m) });
}
// takılı parçaların ayak izleri
for (const p of PANO_PARCALARI) {
  if (!p.soket && !p.konum) continue;
  const [x, y] = p.konum ?? SOKETLER.find(q => q[2] === p.soket).slice(0, 2);
  oge.push({ ad: 'parça: ' + p.ad, tur: 'parça', mask: ayakIzi(p.yap().translate(x, y, 0)) });
}
// soket halkaları ayrı: parçanın altında kalır, kendi çakışması sayılmaz
for (const [x, y, ad] of SOKETLER) {
  // soket çapı kadar daire
}

// Hiçbir muafiyet yok: oklar da zarın (artık ayrı parça) üstüne binemez.
const serbest = () => false;

let sorun = 0;
for (let i = 0; i < oge.length; i++) for (let j = i + 1; j < oge.length; j++) {
  const A = oge[i], B = oge[j];
  if (serbest(A, B)) continue;
  let n = 0;
  for (let k = 0; k < A.mask.length; k++) if (A.mask[k] && B.mask[k]) n++;
  if (n === 0) continue;
  sorun++;
  console.log(`ÇAKIŞMA  ${A.ad}  ×  ${B.ad}   ${(n * COZ * COZ).toFixed(1)} mm²`);
}
console.log(sorun ? `\n${sorun} çakışma var.` : '\nÇakışma yok ✓');
