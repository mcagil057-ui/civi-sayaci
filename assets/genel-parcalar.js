// Genel amaçlı parametrik parçalar. Her tanım: alanlar + yap(p) -> Mesh
import {
  Mesh, roundedRectPts, circlePts, ellipsePts, arrowPts,
  extrude, extrudeRing, cylinder, tube, pill, hemisphere, cone, revolve
} from './mesh.js';

const n = (ad, etiket, varsayilan, min, max, adim = 0.2) => ({ ad, etiket, varsayilan, min, max, adim });

export const GENEL = [
  {
    id: 'kutu', ad: 'Kutu / tepsi',
    alanlar: [n('w', 'Genişlik', 60, 5, 250), n('d', 'Derinlik', 40, 5, 250), n('h', 'Yükseklik', 25, 1, 200),
              n('t', 'Duvar kalınlığı', 2, 0.8, 10, 0.1), n('r', 'Köşe yarıçapı', 3, 0, 40, 0.5),
              n('dolu', 'Dolu mu? (0 hayır / 1 evet)', 0, 0, 1, 1)],
    yap: p => {
      const dis = roundedRectPts(p.w, p.d, Math.min(p.r, p.w / 2 - 0.1, p.d / 2 - 0.1), 10);
      if (p.dolu >= 0.5) return extrude(dis, 0, p.h);
      const ic = roundedRectPts(p.w - 2 * p.t, p.d - 2 * p.t, Math.max(0.1, p.r - p.t), 10);
      // taban, duvarın içine 0,4t kadar gömülür: çakışan kenar kalmaz, katı tek parça olur
      const taban = roundedRectPts(p.w - 1.2 * p.t, p.d - 1.2 * p.t, Math.max(0.1, p.r - 0.6 * p.t), 10);
      return new Mesh().add(extrude(taban, 0, p.t)).add(extrudeRing(dis, ic, 0, p.h));
    },
  },
  {
    id: 'silindir', ad: 'Silindir',
    alanlar: [n('r', 'Yarıçap', 15, 1, 120), n('h', 'Yükseklik', 20, 0.4, 250), n('seg', 'Kenar sayısı', 64, 6, 200, 1)],
    yap: p => cylinder(p.r, p.h, Math.round(p.seg)),
  },
  {
    id: 'boru', ad: 'Boru / halka',
    alanlar: [n('ro', 'Dış yarıçap', 20, 1, 120), n('ri', 'İç yarıçap', 15, 0.5, 119), n('h', 'Yükseklik', 20, 0.4, 250)],
    yap: p => tube(Math.max(p.ro, p.ri + 0.4), p.ri, p.h, 72),
  },
  {
    id: 'plaka', ad: 'Plaka / etiket',
    alanlar: [n('w', 'Genişlik', 60, 5, 250), n('d', 'Derinlik', 25, 5, 250), n('h', 'Kalınlık', 2, 0.4, 30),
              n('r', 'Köşe yarıçapı', 3, 0, 40, 0.5)],
    yap: p => extrude(roundedRectPts(p.w, p.d, Math.min(p.r, p.w / 2 - 0.1, p.d / 2 - 0.1), 10), 0, p.h),
  },
  {
    id: 'disk-yigini', ad: 'Disk yığını (granum tipi)',
    alanlar: [n('r', 'Disk yarıçapı', 9, 1, 60), n('kal', 'Disk kalınlığı', 2.6, 0.4, 20), n('adet', 'Disk sayısı', 5, 1, 30, 1),
              n('bogaz', 'Ara boğaz yüksekliği', 1.4, 0, 20), n('bogazR', 'Boğaz yarıçapı', 3.2, 0.5, 60)],
    yap: p => {
      const m = new Mesh();
      let z = 0;
      const adet = Math.round(p.adet);
      for (let i = 0; i < adet; i++) {
        m.add(pill(p.r, p.kal, Math.min(0.9, p.kal / 3)).translate(0, 0, z));
        z += p.kal;
        if (i < adet - 1 && p.bogaz > 0.01) { m.add(cylinder(Math.min(p.bogazR, p.r - 0.2), p.bogaz + 0.2, 32).translate(0, 0, z - 0.1)); z += p.bogaz; }
      }
      return m;
    },
  },
  {
    id: 'ok', ad: 'Ok',
    alanlar: [n('len', 'Uzunluk', 40, 5, 250), n('w', 'Gövde genişliği', 7, 1, 60), n('hw', 'Uç genişliği', 14, 2, 80),
              n('hl', 'Uç uzunluğu', 11, 1, 100), n('h', 'Kalınlık', 3, 0.4, 40)],
    yap: p => extrude(arrowPts(p.len, p.w, Math.max(p.hw, p.w + 0.5), Math.min(p.hl, p.len - 0.5)), 0, p.h),
  },
  {
    id: 'kubbe', ad: 'Yarım küre / damla',
    alanlar: [n('r', 'Yarıçap', 12, 1, 100), n('gerX', 'X esnetme', 1, 0.2, 4, 0.05), n('gerZ', 'Yükseklik oranı', 1, 0.2, 4, 0.05)],
    yap: p => hemisphere(p.r, 64, 20).scale(p.gerX, 1, p.gerZ),
  },
  {
    id: 'koni', ad: 'Koni / kesik koni',
    alanlar: [n('r1', 'Alt yarıçap', 20, 0.5, 120), n('r2', 'Üst yarıçap', 4, 0, 120), n('h', 'Yükseklik', 30, 1, 250)],
    yap: p => cone(p.r1, p.r2, p.h, 64),
  },
  {
    id: 'vazo', ad: 'Bardak / vazo (döndürme)',
    alanlar: [n('rAlt', 'Alt yarıçap', 18, 2, 100), n('rOrta', 'Orta yarıçap', 26, 2, 120), n('rUst', 'Üst yarıçap', 20, 2, 120),
              n('h', 'Yükseklik', 70, 5, 250), n('t', 'Et kalınlığı', 2, 0.8, 20, 0.1)],
    yap: p => {
      const dis = [], ic = [];
      const N = 24;
      const r = u => {
        // alt-orta-üst arasında ikinci dereceden yumuşak geçiş
        const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        return a * p.rAlt + b * p.rOrta + c * p.rUst;
      };
      for (let i = 0; i <= N; i++) dis.push([r(i / N), p.t + (p.h - p.t) * i / N]);
      for (let i = N; i >= 0; i--) ic.push([Math.max(0.3, r(i / N) - p.t), p.t + (p.h - p.t) * i / N]);
      const profil = [[0, 0], [p.rAlt, 0], ...dis, ...ic, [0, p.t]];
      return revolve(profil, 80);
    },
  },
];
