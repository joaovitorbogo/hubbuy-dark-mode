// Baixa todos os bundles de CSS do hubbuy para ./.cache/allcss.
//
// O tema e derivado do CSS real do site, e o Nuxt renomeia os arquivos a cada
// deploy (o hash faz parte do nome). Por isso a lista de arquivos nao pode ser
// fixa: ela e descoberta a partir do HTML e do chunk de entrada.
//
// Uso: node scripts/fetch-css.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.cache', 'allcss');
const ORIGIN = 'https://www.hubbuy.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

console.log('lendo o HTML da home...');
const html = await get(ORIGIN + '/');

// A home referencia o CSS de entrada e o modulo de entrada.
const names = new Set();
for (const m of html.matchAll(/\/_nuxt\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]{8}\.css)/g)) names.add(m[1]);
// O chunk de entrada nao segue o padrao nome.hash.js -- e so o hash
// (ex.: CeqSr9gX.js). Pegamos direto pela tag <script type="module">.
const entryJs =
  html.match(/<script[^>]+type="module"[^>]+src="\/_nuxt\/([^"]+\.js)"/)?.[1] ??
  html.match(/modulepreload[^>]+href="\/_nuxt\/([^"]+\.js)"/)?.[1];
if (!entryJs) throw new Error('nao achei o chunk de entrada no HTML');

console.log(`chunk de entrada: ${entryJs}`);
const js = await get(`${ORIGIN}/_nuxt/${entryJs}`);
for (const m of js.matchAll(/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]{8}\.css)/g)) names.add(m[1]);

const list = [...names].sort();
console.log(`${list.length} arquivos de CSS a baixar`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let ok = 0, bad = 0;
const CONCURRENCY = 16;
const queue = [...list];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const name = queue.pop();
    try {
      const css = await get(`${ORIGIN}/_nuxt/${name}`);
      // Chunks removidos devolvem o shell da SPA em vez de 404.
      if (/^\s*<!DOCTYPE html/i.test(css)) { bad++; continue; }
      fs.writeFileSync(path.join(OUT, name), css);
      ok++;
    } catch {
      bad++;
    }
  }
}));

console.log(`baixados: ${ok} | ignorados: ${bad}`);
console.log(`destino: ${path.relative(ROOT, OUT)}`);
console.log('agora rode: node scripts/gen.mjs');
