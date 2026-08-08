// Mede a luminancia media das imagens usadas como background no CSS do hubbuy.
//
// Superficies decorativas claras (o fundo do "guia de processo", os cartoes de
// endereco, o topo da carteira) continuam claras no tema escuro, porque sao
// imagem e nao cor -- e o texto, que clareamos, some em cima delas. Para saber
// quais precisam de tratamento sem chutar, decodificamos cada imagem num
// canvas e medimos.
//
// Uso: node scripts/measure-bg-images.mjs   (depois de fetch-css)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pp from 'puppeteer-core';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '.cache', 'allcss');
const OUT = path.join(ROOT, '.cache', 'bg-luminance.json');
const ORIGIN = 'https://www.hubbuy.com/_nuxt/';

const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const names = new Set();
for (const f of fs.readdirSync(SRC)) {
  const css = fs.readFileSync(path.join(SRC, f), 'utf8');
  for (const m of css.matchAll(/url\(\.\/([^)]+?\.(?:png|webp|jpe?g))\)/gi)) names.add(m[1]);
}
const list = [...names].sort();
console.log(`${list.length} imagens a medir`);

const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(ORIGIN.replace('/_nuxt/', '/'), { waitUntil: 'domcontentloaded' });

const result = await p.evaluate(async (origin, files) => {
  const out = {};
  for (const f of files) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = origin + f;
      await img.decode();
      const w = Math.min(img.naturalWidth, 96) || 1;
      const h = Math.min(img.naturalHeight, 96) || 1;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255;
        if (a < 0.35) continue;                      // pixel transparente nao conta
        sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        n++;
      }
      out[f] = n ? +(sum / n).toFixed(4) : null;
    } catch (e) {
      out[f] = null;
    }
  }
  return out;
}, ORIGIN, list);

await b.close();
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));

const vals = Object.entries(result).filter(([, v]) => v !== null).sort((a, b2) => b2[1] - a[1]);
console.log(`medidas: ${vals.length} | falhas: ${list.length - vals.length}`);
console.log('mais claras:');
vals.slice(0, 12).forEach(([k, v]) => console.log(`  ${v.toFixed(3)}  ${k}`));
console.log(`saida: ${path.relative(ROOT, OUT)}`);
