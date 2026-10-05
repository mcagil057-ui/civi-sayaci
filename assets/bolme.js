// Giyotin bölme: bir dikdörtgeni, her gözünde EN ÇOK BİR oyuk kalacak şekilde
// eksenlere paralel kesiklerle böler. Oyuk yerleşimi değiştiğinde ızgarayı
// elle kurmak gerekmez.
//
// oyuklar: [{ ad, kutu: {x0,y0,x1,y1} }]
// döner:   { hucreler: [{x0,y0,x1,y1, ad|null}], xKesim: [], yKesim: [] }

function araliklar(oyuklar, eksen) {
  return oyuklar.map(o => eksen === 'x' ? [o.kutu.x0, o.kutu.x1] : [o.kutu.y0, o.kutu.y1]);
}

// Hiçbir kutuyu kesmeyen aday kesik yerleri
function adaylar(oyuklar, eksen, a0, a1) {
  const ar = araliklar(oyuklar, eksen);
  const noktalar = new Set();
  for (const [s, e] of ar) { noktalar.add(s); noktalar.add(e); }
  const out = [];
  for (const n of noktalar) {
    if (n <= a0 + 1e-6 || n >= a1 - 1e-6) continue;
    if (ar.some(([s, e]) => n > s + 1e-6 && n < e - 1e-6)) continue;   // kutuyu keser
    out.push(n);
  }
  return out;
}

export function giyotin(x0, y0, x1, y1, oyuklar) {
  const hucreler = [];
  const xKesim = new Set([x0, x1]), yKesim = new Set([y0, y1]);

  const bol = (x0, y0, x1, y1, liste) => {
    if (liste.length <= 1) {
      hucreler.push({ x0, y0, x1, y1, ad: liste[0]?.ad ?? null, oyuk: liste[0] ?? null });
      return;
    }
    // en dengeli kesiği seç
    let enIyi = null;
    for (const [eksen, a0, a1] of [['x', x0, x1], ['y', y0, y1]]) {
      for (const n of adaylar(liste, eksen, a0, a1)) {
        const sol = liste.filter(o => (eksen === 'x' ? o.kutu.x1 : o.kutu.y1) <= n + 1e-6);
        const sag = liste.filter(o => (eksen === 'x' ? o.kutu.x0 : o.kutu.y0) >= n - 1e-6);
        if (sol.length + sag.length !== liste.length || !sol.length || !sag.length) continue;
        const denge = Math.abs(sol.length - sag.length);
        if (!enIyi || denge < enIyi.denge) enIyi = { eksen, n, sol, sag, denge };
      }
    }
    if (!enIyi) throw new Error(
      `giyotin bölme bulunamadı: ${liste.map(o => o.ad).join(', ')} — oyukları biraz ayır`);
    if (enIyi.eksen === 'x') {
      xKesim.add(enIyi.n);
      bol(x0, y0, enIyi.n, y1, enIyi.sol);
      bol(enIyi.n, y0, x1, y1, enIyi.sag);
    } else {
      yKesim.add(enIyi.n);
      bol(x0, y0, x1, enIyi.n, enIyi.sol);
      bol(x0, enIyi.n, x1, y1, enIyi.sag);
    }
  };

  for (const o of oyuklar) {
    const k = o.kutu;
    if (k.x0 < x0 - 1e-6 || k.x1 > x1 + 1e-6 || k.y0 < y0 - 1e-6 || k.y1 > y1 + 1e-6)
      throw new Error(`oyuk alanın dışına taşıyor: ${o.ad}`);
  }
  bol(x0, y0, x1, y1, oyuklar);
  return {
    hucreler,
    xKesim: [...xKesim].sort((a, b) => a - b),
    yKesim: [...yKesim].sort((a, b) => a - b),
  };
}
