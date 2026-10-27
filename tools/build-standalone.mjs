// Genera cotizador-standalone.html: un solo archivo con CSS, JS, fuentes y jsPDF incrustados.
// Uso: node tools/build-standalone.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = rd('index.html');
let css = rd('css/styles.css').replace(/url\('\.\.\/(fonts\/[^']+)'\)/g, (_, f) =>
  `url('data:font/woff2;base64,${fs.readFileSync(path.join(root, f)).toString('base64')}')`);
html = html.replace(/\s*<link rel="preload"[^>]*>/g, '');
html = html.replace(/<link rel="stylesheet" href="css\/styles.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script src="([^"]+)" defer><\/script>/g, (_, src) =>
  `<script>\n${rd(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.writeFileSync(path.join(root, 'cotizador-standalone.html'), html);
console.log('cotizador-standalone.html', (html.length / 1024).toFixed(0) + ' KB');
