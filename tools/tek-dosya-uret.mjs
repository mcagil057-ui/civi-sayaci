// modelleyici.html + assets/*.js -> tek dosyalık, çift tıkla açılan sürüm.
// Çalıştır: node tools/tek-dosya-uret.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const oku = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// import satırlarını at, export sözcüğünü kaldır: modüller tek kapsamda birleşsin
const duzlestir = kod => kod
  .replace(/^import[\s\S]*?from\s*'[^']*';\s*$/gm, '')
  .replace(/^export\s+(const|function|class|let)\b/gm, '$1')
  .replace(/^export\s*\{[^}]*\};\s*$/gm, '');

const moduller = ['assets/mesh.js', 'assets/fotosentez.js', 'assets/genel-parcalar.js', 'assets/onizleme.js']
  .map(p => `/* ===== ${p} ===== */\n` + duzlestir(oku(p)))
  .join('\n');

const html = oku('modelleyici.html');
const bas = html.indexOf('<script type="module">');
const son = html.indexOf('</script>', bas);
const sayfaKodu = duzlestir(html.slice(bas + '<script type="module">'.length, son));

const cikti = html.slice(0, bas)
  + '<script>\n' + moduller + '\n/* ===== sayfa ===== */\n' + sayfaKodu + '\n'
  + html.slice(son);

writeFileSync(new URL('../modelleyici-tek-dosya.html', import.meta.url),
  cikti.replace('<title>3D Modelleyici', '<title>3D Modelleyici (tek dosya)'));
console.log('modelleyici-tek-dosya.html yazıldı:', (cikti.length / 1024).toFixed(0), 'KB');
