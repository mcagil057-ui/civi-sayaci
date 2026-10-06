// FİZİKSEL DENETİM — modele ışın atarak ölçer, koda güvenmez.
// Her oyuğun gerçek açıklığını tarar ve parçayı içine oturtmayı dener.
// Çalıştır: node tools/fiziksel-denetim.mjs
import { PANO_PARCALARI, SOKETLER, PARCA_TANIM, P } from '../assets/fotosentez-pano.js';

const COZ = 0.4;                       // tarama çözünürlüğü (mm)
const pano = PANO_PARCALARI[0].yap();
const TABAN = P.panoH - P.oyukDerin;   // oyuk tabanı kotu

/* üçgenleri XY kutularıyla birlikte hazırla (tarama hızlansın) */
const ucgen = pano.tris.map(t => ({
  t, x0: Math.min(t[0][0], t[1][0], t[2][0]), x1: Math.max(t[0][0], t[1][0], t[2][0]),
     y0: Math.min(t[0][1], t[1][1], t[2][1]), y1: Math.max(t[0][1], t[1][1], t[2][1]),
}));

function yukseklik(liste, x, y) {
  let en = -Infinity;
  for (const u of liste) {
    if (x < u.x0 || x > u.x1 || y < u.y0 || y > u.y1) continue;
    const [a, b, c] = u.t;
    const d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = c[0] - a[0], d2y = c[1] - a[1];
    const det = d1x * d2y - d1y * d2x;
    if (Math.abs(det) < 1e-12) continue;
    const px = x - a[0], py = y - a[1];
    const uu = (px * d2y - py * d2x) / det, vv = (py * d1x - px * d1y) / det;
    if (uu < -1e-9 || vv < -1e-9 || uu + vv > 1 + 1e-9) continue;
    const z = a[2] + uu * (b[2] - a[2]) + vv * (c[2] - a[2]);
    if (z > en) en = z;
  }
  return en;
}

let hata = 0;
const satir = [];
console.log('Oyuk                 ölçülen açıklık      parça            pay      sonuç');
console.log('─'.repeat(78));

for (const [sx, sy, ad] of SOKETLER) {
  const parca = PARCA_TANIM[ad].kontur().map(p => [p[0] + sx, p[1] + sy]);
  const px0 = Math.min(...parca.map(p => p[0])), px1 = Math.max(...parca.map(p => p[0]));
  const py0 = Math.min(...parca.map(p => p[1])), py1 = Math.max(...parca.map(p => p[1]));

  // bu bölgeye düşen üçgenler
  const [gx0, gy0, gx1, gy1] = [px0 - 4, py0 - 4, px1 + 4, py1 + 4];
  const yerel = ucgen.filter(u => u.x1 >= gx0 && u.x0 <= gx1 && u.y1 >= gy0 && u.y0 <= gy1);

  // ızgarayı tara: hangi noktalar oyuk tabanında?
  let derinSayi = 0, ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity;
  for (let y = gy0; y <= gy1; y += COZ) for (let x = gx0; x <= gx1; x += COZ) {
    const z = yukseklik(yerel, x, y);
    if (Math.abs(z - TABAN) < 0.05) {
      derinSayi++;
      ax0 = Math.min(ax0, x); ax1 = Math.max(ax1, x);
      ay0 = Math.min(ay0, y); ay1 = Math.max(ay1, y);
    }
  }
  if (!derinSayi) {
    console.log(`${ad.padEnd(20)} OYUK YOK`); hata++; continue;
  }

  // parçayı indir: her kontur noktası oyuk tabanına denk gelmeli
  let carpan = 0, enAzPay = Infinity;
  for (const p of parca) {
    const z = yukseklik(yerel, p[0], p[1]);
    if (Math.abs(z - TABAN) > 0.05) carpan++;
    // en yakın duvara mesafe: dışa doğru tara
    let d = 0;
    for (let adim = COZ; adim <= 3; adim += COZ) {
      const yon = Math.atan2(p[1] - sy, p[0] - sx);
      const zz = yukseklik(yerel, p[0] + Math.cos(yon) * adim, p[1] + Math.sin(yon) * adim);
      if (Math.abs(zz - TABAN) > 0.05) { d = adim; break; }
      d = adim;
    }
    enAzPay = Math.min(enAzPay, d);
  }

  const acik = `${(ax1 - ax0).toFixed(1)}×${(ay1 - ay0).toFixed(1)}`;
  const parcaBoy = `${(px1 - px0).toFixed(1)}×${(py1 - py0).toFixed(1)}`;
  const sonuc = carpan ? `✗ ${carpan} nokta çarpıyor` : '✓ giriyor';
  if (carpan) hata++;
  console.log(`${ad.padEnd(20)} ${acik.padStart(14)} mm ${parcaBoy.padStart(14)} mm ${enAzPay.toFixed(1).padStart(5)} mm  ${sonuc}`);
  satir.push({ ad, acik, parcaBoy, pay: enAzPay, derinlik: P.panoH - TABAN });
}

console.log('─'.repeat(78));
console.log(hata ? `${hata} OYUKTA SORUN VAR` : `27 oyuğun hepsi ölçüldü: parçalar içine giriyor.`);
process.exit(hata ? 1 : 0);
