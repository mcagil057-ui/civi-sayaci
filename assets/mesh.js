// Basit üçgen-ağ (mesh) kütüphanesi: parametrik katı modelleme + STL çıktısı.
// Hem tarayıcıda (<script type="module">) hem Node'da (import) çalışır.

export class Mesh {
  constructor(tris = []) { this.tris = tris; }

  tri(a, b, c) { this.tris.push([a, b, c]); return this; }

  // Dörtgen yüzey: a-b-c-d sırası dışarıdan bakıldığında saat yönünün tersi.
  quad(a, b, c, d) { return this.tri(a, b, c).tri(a, c, d); }

  add(other) { for (const t of other.tris) this.tris.push(t); return this; }

  map(fn) { return new Mesh(this.tris.map(t => t.map(fn))); }

  translate(dx, dy, dz) { return this.map(p => [p[0] + dx, p[1] + dy, p[2] + dz]); }

  scale(sx, sy = sx, sz = sx) { return this.map(p => [p[0] * sx, p[1] * sy, p[2] * sz]); }

  rotateZ(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return this.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]);
  }

  rotateX(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return this.map(p => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]);
  }

  // Modeli XY'de ortalayıp tabanını z=0'a oturtur (yazıcı tablası için).
  center() {
    const b = this.bounds();
    if (!b) return this;
    return this.translate(-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]);
  }

  bounds() {
    if (!this.tris.length) return null;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const t of this.tris) for (const p of t) for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
    return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  }
}

/* ---------- 2B yardımcılar ---------- */

export function ellipsePts(rx, ry, seg = 72) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg;
    pts.push([rx * Math.cos(a), ry * Math.sin(a)]);
  }
  return pts;
}

export const circlePts = (r, seg = 48) => ellipsePts(r, r, seg);

// Mercek / yaprak biçimi: iki yayın kesişimi. Kloroplast kesiti için.
export function lensPts(len, width, seg = 80) {
  const a = len / 2, b = width / 2;
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const x = -a + 2 * a * i / seg;
    pts.push([x, b * Math.pow(Math.max(0, 1 - (x / a) ** 2), 0.62)]);
  }
  for (let i = seg - 1; i > 0; i--) {
    const x = -a + 2 * a * i / seg;
    pts.push([x, -b * Math.pow(Math.max(0, 1 - (x / a) ** 2), 0.62)]);
  }
  return pts;
}

export function roundedRectPts(w, h, r = 2, seg = 8) {
  const pts = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90],
                   [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + 90 * i / seg) * Math.PI / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

// Ok biçimi (yön: +X). Madde akışını göstermek için.
export function arrowPts(len, shaftW, headW, headLen) {
  const s = shaftW / 2, hw = headW / 2, x0 = len - headLen;
  return [[0, -s], [x0, -s], [x0, -hw], [len, 0], [x0, hw], [x0, s], [0, s]];
}

// Çokgeni içe/dışa ofsetler (ortalama merkeze göre ölçekleme değil, gerçek ofset).
export function offsetPts(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const n1 = normal2(a, p), n2 = normal2(p, b);
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const cosHalf = Math.max(0.35, (n1[0] * nx + n1[1] * ny));
    out.push([p[0] + nx * d / cosHalf, p[1] + ny * d / cosHalf]);
  }
  return out;
}

function normal2(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l]; // CCW çokgen için dışa doğru
}

function area2(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/* ---------- Kulak kırpma (ear clipping) üçgenleştirme ---------- */

export function triangulate(pts) {
  let v = pts.map((p, i) => i);
  if (area2(pts) < 0) v.reverse();
  const out = [];
  let guard = 0;
  while (v.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < v.length; i++) {
      const i0 = v[(i - 1 + v.length) % v.length], i1 = v[i], i2 = v[(i + 1) % v.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross <= 1e-9) continue; // dışbükey değil
      let ok = true;
      for (const j of v) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (inTri(pts[j], a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      out.push([i0, i1, i2]);
      v.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // bozuk çokgen: elde kalanı yelpaze ile kapat
  }
  for (let i = 1; i < v.length - 1; i++) out.push([v[0], v[i], v[i + 1]]);
  return out;
}

function inTri(p, a, b, c) {
  const d = (x, y, z) => (y[0] - x[0]) * (p[1] - x[1]) - (y[1] - x[1]) * (p[0] - x[0]);
  const s1 = d(a, b), s2 = d(b, c), s3 = d(c, a);
  return (s1 >= -1e-9 && s2 >= -1e-9 && s3 >= -1e-9) || (s1 <= 1e-9 && s2 <= 1e-9 && s3 <= 1e-9);
}

/* ---------- 3B gövdeler ---------- */

// Dolu çokgen prizma (z0..z1 arası). pts: saat yönünün tersi.
export function extrude(pts, z0, z1) {
  const m = new Mesh();
  const poly = area2(pts) < 0 ? [...pts].reverse() : pts;
  const n = poly.length;
  for (const [a, b, c] of triangulate(poly)) {
    m.tri([poly[a][0], poly[a][1], z1], [poly[b][0], poly[b][1], z1], [poly[c][0], poly[c][1], z1]);
    m.tri([poly[c][0], poly[c][1], z0], [poly[b][0], poly[b][1], z0], [poly[a][0], poly[a][1], z0]);
  }
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    m.quad([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]);
  }
  return m;
}

// İçi boş halka prizma: dış ve iç kontur aynı nokta sayısında olmalı.
export function extrudeRing(outer, inner, z0, z1) {
  const m = new Mesh();
  const o = area2(outer) < 0 ? [...outer].reverse() : outer;
  const iRaw = area2(inner) < 0 ? [...inner].reverse() : inner;
  const n = o.length;
  for (let k = 0; k < n; k++) {
    const i = k, j = (k + 1) % n;
    // üst ve alt yüzükler
    m.quad([o[i][0], o[i][1], z1], [o[j][0], o[j][1], z1], [iRaw[j][0], iRaw[j][1], z1], [iRaw[i][0], iRaw[i][1], z1]);
    m.quad([iRaw[i][0], iRaw[i][1], z0], [iRaw[j][0], iRaw[j][1], z0], [o[j][0], o[j][1], z0], [o[i][0], o[i][1], z0]);
    // dış duvar
    m.quad([o[i][0], o[i][1], z0], [o[j][0], o[j][1], z0], [o[j][0], o[j][1], z1], [o[i][0], o[i][1], z1]);
    // iç duvar (ters yön)
    m.quad([iRaw[j][0], iRaw[j][1], z0], [iRaw[i][0], iRaw[i][1], z0], [iRaw[i][0], iRaw[i][1], z1], [iRaw[j][0], iRaw[j][1], z1]);
  }
  return m;
}


// Değişken yükseklikli halka ekstrüzyon: tepe kotu her kontur noktasında ayrı.
// Kesit (cutaway) görünümü için ön duvarı alçaltmakta kullanılır.
export function extrudeRingVar(outer, inner, z0, ustFn) {
  const m = new Mesh();
  const o = area2(outer) < 0 ? [...outer].reverse() : outer;
  const iv = area2(inner) < 0 ? [...inner].reverse() : inner;
  const n = o.length;
  const h = o.map((p, k) => ustFn(p[0], p[1], k));
  for (let k = 0; k < n; k++) {
    const i = k, j = (k + 1) % n;
    const oi = [o[i][0], o[i][1]], oj = [o[j][0], o[j][1]];
    const ii = [iv[i][0], iv[i][1]], ij = [iv[j][0], iv[j][1]];
    m.quad([...oi, h[i]], [...oj, h[j]], [...ij, h[j]], [...ii, h[i]]);      // üst yüz
    m.quad([...ii, z0], [...ij, z0], [...oj, z0], [...oi, z0]);              // alt yüz
    m.quad([...oi, z0], [...oj, z0], [...oj, h[j]], [...oi, h[i]]);          // dış duvar
    m.quad([...ij, z0], [...ii, z0], [...ii, h[i]], [...ij, h[j]]);          // iç duvar
  }
  return m;
}

export const box = (w, d, h) => extrude(roundedRectPts(w, d, 0.001, 1), 0, h);
export const cylinder = (r, h, seg = 48) => extrude(circlePts(r, seg), 0, h);
export const tube = (ro, ri, h, seg = 48) => extrudeRing(circlePts(ro, seg), circlePts(ri, seg), 0, h);

// Profil döndürme. profile: [[r,z], ...] alttan üste, r>=0.
export function revolve(profile, seg = 48) {
  const m = new Mesh();
  const at = (i, k) => {
    const a = 2 * Math.PI * k / seg;
    return [profile[i][0] * Math.cos(a), profile[i][0] * Math.sin(a), profile[i][1]];
  };
  for (let k = 0; k < seg; k++) {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = at(i, k), b = at(i, k + 1), c = at(i + 1, k + 1), d = at(i + 1, k);
      if (profile[i][0] < 1e-6) m.tri(a, c, d);
      else if (profile[i + 1][0] < 1e-6) m.tri(a, b, c);
      else m.quad(a, b, c, d);
    }
  }
  // alt ve üst kapaklar
  const cap = (idx, up) => {
    const r = profile[idx][0], z = profile[idx][1];
    if (r < 1e-6) return;
    for (let k = 0; k < seg; k++) {
      const a = at(idx, k), b = at(idx, k + 1), c = [0, 0, z];
      up ? m.tri(a, b, c) : m.tri(b, a, c);
    }
  };
  cap(0, false);
  cap(profile.length - 1, true);
  return m;
}

export function hemisphere(r, seg = 48, rings = 16) {
  const profile = [];
  for (let i = 0; i <= rings; i++) {
    const a = Math.PI / 2 * i / rings;
    profile.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return revolve(profile, seg);
}

export function sphere(r, seg = 48, rings = 24) {
  const profile = [];
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + Math.PI * i / rings;
    profile.push([r * Math.cos(a), r * Math.sin(a) + r]);
  }
  return revolve(profile, seg);
}

// Kenarları yuvarlatılmış disk (tilakoit kesesi gibi).
export function pill(r, h, fillet = null, seg = 48, steps = 6) {
  const f = Math.min(fillet ?? Math.min(r, h) * 0.35, r - 0.2, h / 2 - 0.05);
  if (f <= 0.05) return cylinder(r, h, seg);
  const profile = [[0, 0], [r - f, 0]];
  for (let i = 1; i <= steps; i++) {
    const a = -Math.PI / 2 + Math.PI / 2 * i / steps;
    profile.push([r - f + f * Math.cos(a), f + f * Math.sin(a)]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 * i / steps;
    profile.push([r - f + f * Math.cos(a), h - f + f * Math.sin(a)]);
  }
  profile.push([0, h]);
  return revolve(profile, seg);
}

// Koni / kesik koni (ışık hüzmesi, huni vb.)
export function cone(r1, r2, h, seg = 48) {
  return revolve([[0, 0], [r1, 0], [r2, h], [0, h]], seg);
}

/* ---------- STL ---------- */

function faceNormal(t) {
  const [a, b, c] = t;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

export function toBinarySTL(mesh, header = 'civi-sayaci 3d') {
  const tris = mesh.tris;
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  const head = new Uint8Array(buf, 0, 80);
  for (let i = 0; i < Math.min(79, header.length); i++) head[i] = header.charCodeAt(i) & 0x7f;
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    const n = faceNormal(t);
    for (const x of n) { dv.setFloat32(o, x, true); o += 4; }
    for (const p of t) for (const x of p) { dv.setFloat32(o, x, true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}

/* ---------- kalite kontrolü ---------- */

// Her kenarın tam iki üçgen tarafından paylaşılıp paylaşılmadığını denetler.
// Baskıya hazır (watertight / manifold) olmanın temel şartı budur.
export function checkWatertight(mesh, eps = 1e-4) {
  const key = p => p.map(x => Math.round(x / eps)).join(',');
  const edges = new Map();
  for (const t of mesh.tris) {
    for (let i = 0; i < 3; i++) {
      const a = key(t[i]), b = key(t[(i + 1) % 3]);
      const k = a < b ? a + '|' + b : b + '|' + a;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let bad = 0;
  for (const c of edges.values()) if (c !== 2) bad++;
  return { ok: bad === 0, badEdges: bad, triangles: mesh.tris.length };
}

// İmzalı tetrahedron toplamı ile hacim (mm³). Kapalı yüzeylerde geçerlidir.
export function volume(mesh) {
  let v = 0;
  for (const [a, b, c] of mesh.tris) {
    v += (a[0] * (b[1] * c[2] - c[1] * b[2])
        - a[1] * (b[0] * c[2] - c[0] * b[2])
        + a[2] * (b[0] * c[1] - c[0] * b[1])) / 6;
  }
  return Math.abs(v);
}
