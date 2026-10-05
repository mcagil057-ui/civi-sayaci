// Bağımlılıksız 3B önizleme: 2B canvas üzerine yazılımsal düz gölgelendirme.
// Harici kütüphane yok; çevrimdışı çalışır.
export class Onizleme {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.yaw = -35; this.pitch = 58; this.zoom = 1; this.pan = [0, 0];
    this.mesh = null; this.merkez = [0, 0, 0]; this.olcek = 1;
    this.renk = [255, 176, 32];
    this._baglan();
  }

  _baglan() {
    const c = this.c;
    let son = null, pinch = null;
    const nokta = e => (e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY]);
    const bas = e => { son = nokta(e); if (e.touches?.length === 2) pinch = this._mesafe(e); };
    const hareket = e => {
      if (e.touches?.length === 2 && pinch) {
        const d = this._mesafe(e);
        this.zoom = Math.min(6, Math.max(0.25, this.zoom * d / pinch));
        pinch = d; e.preventDefault(); this.ciz(); return;
      }
      if (!son) return;
      const p = nokta(e);
      this.yaw += (p[0] - son[0]) * 0.5;
      this.pitch = Math.max(-5, Math.min(95, this.pitch + (p[1] - son[1]) * 0.4));
      son = p; e.preventDefault(); this.ciz();
    };
    const birak = () => { son = null; pinch = null; };
    c.addEventListener('mousedown', bas); addEventListener('mousemove', hareket); addEventListener('mouseup', birak);
    c.addEventListener('touchstart', bas, { passive: false });
    c.addEventListener('touchmove', hareket, { passive: false });
    c.addEventListener('touchend', birak);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoom = Math.min(6, Math.max(0.25, this.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      this.ciz();
    }, { passive: false });
  }

  _mesafe(e) {
    const [a, b] = [e.touches[0], e.touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  yukle(mesh) {
    this.mesh = mesh;
    const b = mesh.bounds();
    if (b) {
      this.merkez = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
      this.olcek = 1 / Math.max(1e-3, Math.max(...b.size));
    }
    this.ciz();
  }

  boyutlandir() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, r.width * dpr);
    this.c.height = Math.max(1, r.height * dpr);
    this.ciz();
  }

  ciz() {
    const { ctx, c } = this;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#141829'); grad.addColorStop(1, '#0a0c16');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    if (!this.mesh) return;

    const ya = this.yaw * Math.PI / 180, pa = this.pitch * Math.PI / 180;
    const cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
    const k = Math.min(W, H) * 0.62 * this.zoom;
    const cx = W / 2, cz = H / 2;
    const d = this.merkez;

    const don = p => {
      const x = (p[0] - d[0]) * this.olcek, y = (p[1] - d[1]) * this.olcek, z = (p[2] - d[2]) * this.olcek;
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
      const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
      return [x1, y2, z2];
    };

    const isik = [0.42, -0.5, 0.76];
    const yuzler = [];
    for (const t of this.mesh.tris) {
      const a = don(t[0]), b = don(t[1]), cc = don(t[2]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
      let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      if (nz <= 0) continue;                       // arka yüzleri ele
      const der = (a[1] + b[1] + cc[1]) / 3;       // boyacı algoritması için derinlik
      const sh = Math.max(0.12, nx * isik[0] + ny * isik[1] + nz * isik[2]);
      yuzler.push([der, a, b, cc, sh]);
    }
    yuzler.sort((p, q) => q[0] - p[0]);

    for (const [, a, b, cc, sh] of yuzler) {
      const g = 0.25 + 0.75 * sh;
      ctx.fillStyle = `rgb(${this.renk[0] * g | 0},${this.renk[1] * g | 0},${this.renk[2] * g | 0})`;
      ctx.beginPath();
      ctx.moveTo(cx + a[0] * k, cz - a[2] * k);
      ctx.lineTo(cx + b[0] * k, cz - b[2] * k);
      ctx.lineTo(cx + cc[0] * k, cz - cc[2] * k);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke(); // dikiş boşluklarını kapat
    }
  }
}
