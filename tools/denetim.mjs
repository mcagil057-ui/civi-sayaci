// TAM DENETİM: oyuk uyumu, ölçüler, çizim doğruluğu, baskıya uygunluk.
// Çalıştır: node tools/denetim.mjs
import { checkWatertight, volume, Mesh } from '../assets/mesh.js';
import {
  P, SOKETLER, PARCA_TANIM, PANO_PARCALARI, YERLER, OK_TANIM, okMerkezi,
  oyukKonturuDisa, hucreler, OV, ZAR_KAL, ZAR_PIM,
} from '../assets/fotosentez-pano.js';
import { yazi, yaziGenisligi } from '../assets/yazi.js';

let hata = 0, uyari = 0;
const ok = (k, d) => console.log(`  ✓ ${k.padEnd(46)} ${d}`);
const kotu = (k, d) => { hata++; console.log(`  ✗ ${k.padEnd(46)} ${d}`); };
const dikkat = (k, d) => { uyari++; console.log(`  ! ${k.padEnd(46)} ${d}`); };
const baslik = t => console.log(`\n${t}\n${'─'.repeat(t.length)}`);

const tasi = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
const kutu = pts => ({
  x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])),
  y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])),
});
// noktanın çokgene en kısa mesafesi
function mesafe(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey;
    let u = L2 ? ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2 : 0;
    u = Math.max(0, Math.min(1, u));
    d = Math.min(d, Math.hypot(p[0] - (a[0] + ex * u), p[1] - (a[1] + ey * u)));
  }
  return d;
}

/* 1 — oyuk / parça uyumu */
baslik('1. Her parça oyuğuna oturuyor mu (hedef: her kenarda 0,40 mm pay)');
for (const [x, y, ad] of SOKETLER) {
  const parca = PARCA_TANIM[ad].kontur();
  const oyuk = oyukKonturuDisa(ad);
  let mn = Infinity, mx = 0;
  for (const p of parca) { const d = mesafe(p, oyuk); mn = Math.min(mn, d); mx = Math.max(mx, d); }
  const s = `pay ${mn.toFixed(2)}–${mx.toFixed(2)} mm`;
  if (mn < 0.2) kotu(ad, s + '  → ÇOK SIKI, parça girmez');
  else if (mn > 1.0) dikkat(ad, s + '  → gevşek durabilir');
  else ok(ad, s);
}

/* 2 — oyuk gözün içinde mi */
baslik('2. Her oyuk kendi gözünün içinde mi (kenara değerse yüzey bozulur)');
for (const h of hucreler()) {
  if (!h.oyuk) continue;
  const k = kutu(h.oyuk.kontur);
  const bos = Math.min(k.x0 - h.x0, h.x1 - k.x1, k.y0 - h.y0, h.y1 - k.y1);
  if (bos < 0.3) kotu(h.ad, `göz kenarına ${bos.toFixed(2)} mm`);
  else ok(h.ad, `göz kenarına ${bos.toFixed(1)} mm`);
}

/* 3 — parçalar birbirine değiyor mu */
baslik('3. Parçalar birbirine değiyor mu');
const hepsi = SOKETLER.map(([x, y, ad]) => ({ ad, k: kutu(tasi(PARCA_TANIM[ad].kontur(), x, y)) }));
let cakisma = 0;
for (let i = 0; i < hepsi.length; i++) for (let j = i + 1; j < hepsi.length; j++) {
  const a = hepsi[i].k, b = hepsi[j].k;
  if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
    kotu(`${hepsi[i].ad} × ${hepsi[j].ad}`, 'kutuları kesişiyor'); cakisma++;
  }
}
if (!cakisma) ok('24 parça', 'hiçbiri birbirine değmiyor');

/* 4 — zarın içinde / dışında olması gerekenler */
baslik('4. Zarın içinde olması gerekenler içeride, dışındakiler dışarıda mı');
const icELips = (x, y) => ((x - OV.cx) / (OV.rx - ZAR_KAL)) ** 2 + ((y - OV.cy) / (OV.ry - ZAR_KAL)) ** 2;
const disElips = (x, y) => ((x - OV.cx) / OV.rx) ** 2 + ((y - OV.cy) / OV.ry) ** 2;
const ICERIDE = ['GRANUM', 'KALVİN', 'ATP', 'ADP', 'P', 'NADPH', 'NADP+',
  'ok-granum-atp', 'ok-atp-kalvin', 'ok-kalvin-nadp', 'ok-adp-granum'];
const DISARIDA = ['IŞIK', 'H2O', 'CO2', 'O2', 'GLİKOZ',
  'ok-h2o', 'ok-co2', 'ok-o2', 'ok-glikoz', 'ok-isik-1', 'ok-isik-2', 'ok-isik-3'];
for (const [x, y, ad] of SOKETLER) {
  if (ad.startsWith('ZAR-')) continue;
  const pts = tasi(PARCA_TANIM[ad].kontur(), x, y);
  if (ICERIDE.includes(ad)) {
    const en = Math.max(...pts.map(p => icELips(p[0], p[1])));
    en < 1 ? ok(ad, `zarın içinde (doluluk %${(en * 100).toFixed(0)})`)
           : kotu(ad, 'zarın üstüne biniyor');
  } else if (DISARIDA.includes(ad)) {
    const en = Math.min(...pts.map(p => disElips(p[0], p[1])));
    en > 1 ? ok(ad, 'zarın dışında')
           : kotu(ad, 'zara değiyor veya içine giriyor');
  } else dikkat(ad, 'sınıflandırılmamış');
}

/* 5 — çerçeve içinde mi */
baslik('5. Her şey 1 cm\'lik çerçevenin içinde mi');
const sinirX = P.panoW / 2 - P.cerceveW, sinirY = P.panoD / 2 - P.cerceveW;
for (const [x, y, ad] of SOKETLER) {
  const k = kutu(tasi(PARCA_TANIM[ad].kontur(), x, y));
  const d = Math.min(sinirX - k.x1, k.x0 + sinirX, sinirY - k.y1, k.y0 + sinirY);
  d < 1 ? kotu(ad, `çerçeveye ${d.toFixed(1)} mm`) : ok(ad, `çerçeveye ${d.toFixed(0)} mm`);
}

/* 6 — yazılar karolarına sığıyor mu */
baslik('6. Yazılar parçalarının içinde kalıyor mu');
for (const [ad, t] of Object.entries(PARCA_TANIM)) {
  if (!t.metin) continue;
  const g = yaziGenisligi(t.metin, t.boy);
  const yk = kutu(yazi(t.metin, { boy: t.boy, kal: P.yaziKal, h: 1, z0: 0 })
    .tris.flat().map(p => [p[0] - g / 2, p[1] - t.boy / 2]));
  const kose = [[yk.x0, yk.y0], [yk.x1, yk.y0], [yk.x1, yk.y1], [yk.x0, yk.y1]];
  const kontur = t.kontur();
  const icinde = kose.every(p => {
    let kesim = 0;
    for (let i = 0; i < kontur.length; i++) {
      const a = kontur[i], b = kontur[(i + 1) % kontur.length];
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < a[0] + (p[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0])) kesim++;
    }
    return kesim % 2 === 1;
  });
  icinde ? ok(`${ad} → "${t.metin}"`, `${g.toFixed(1)} × ${t.boy} mm`)
         : kotu(`${ad} → "${t.metin}"`, 'yazı parçadan taşıyor');
}

/* 7 — zar halkası ve pimleri */
baslik('7. Kloroplast zarı ve pimleri');
const zarPimOyuk = ZAR_PIM.map((m, i) => {
  const ad = ['ZAR-SOL', 'ZAR-SAG', 'ZAR-UST', 'ZAR-ALT'][i];
  const s = SOKETLER.find(q => q[2] === ad);
  return { ad, pim: m, soket: [s[0], s[1]] };
});
for (const z of zarPimOyuk) {
  const d = Math.hypot(z.pim[0] - z.soket[0], z.pim[1] - z.soket[1]);
  d < 0.01 ? ok(z.ad, 'pim ile oyuk aynı noktada')
           : kotu(z.ad, `pim oyuktan ${d.toFixed(1)} mm kaymış`);
}
ok('pim payı', `pim Ø6,0 — oyuk Ø${(2 * (3.2 + P.bosluk)).toFixed(1)} mm`);

/* 8 — katı doğrulama */
baslik('8. Bütün parçalar kapalı yüzey mi (dilimleyici uyarı verir mi)');
let hacim = 0;
for (const p of PANO_PARCALARI) {
  const m = p.yap();
  const q = checkWatertight(m), b = m.bounds(), v = volume(m) / 1000;
  hacim += v;
  q.ok ? ok(p.id, `${b.size.map(x => x.toFixed(0)).join('×')} mm · ${v.toFixed(1)} cm³`)
       : kotu(p.id, `${q.badEdges} açık kenar`);
}

/* 9 — baskı uygunluğu */
baslik('9. Baskıya uygunluk');
const yaziciX = 300, yaziciY = 300;
for (const p of PANO_PARCALARI) {
  const b = p.yap().bounds();
  (b.size[0] <= yaziciX && b.size[1] <= yaziciY)
    ? ok(p.id, `${b.size[0].toFixed(0)}×${b.size[1].toFixed(0)} mm tablaya sığar`)
    : kotu(p.id, 'tablaya sığmıyor');
}
const enInce = Math.min(...OK_TANIM.map(o => o.kal));
enInce >= 3 ? ok('en ince kesit', `${enInce} mm (3 duvar hattından kalın)`)
            : dikkat('en ince kesit', `${enInce} mm — kırılgan olabilir`);
ok('parça kalınlığı / oyuk derinliği', `${P.tileH} / ${P.oyukDerin} mm → ${(P.tileH - P.oyukDerin).toFixed(1)} mm dışarıda`);
ok('toplam filament', `≈ ${(hacim * 0.25 * 1.24).toFixed(0)} g (%25 dolgu, PLA)`);

console.log(`\n${'═'.repeat(60)}`);
console.log(hata ? `${hata} HATA, ${uyari} uyarı` : `Hata yok. ${uyari} uyarı.`);
process.exit(hata ? 1 : 0);
