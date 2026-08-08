// Verificacoes estaticas da extensao.
//
// Existe por causa de um bug real: um comentario malformado em theme-core.css
// engoliu a regra seguinte. O CSS continuou "valido" e nada quebrou de forma
// visivel -- o logo so voltou a ficar ilegivel. Erros assim sao silenciosos,
// entao vale checar.
//
// Uso: node scripts/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Split por virgula que respeita aspas e parenteses: seletores como
// [style*="rgb(255, 255, 255)" i] tem virgula dentro e nao podem ser cortados.
function splitSelectors(sel) {
  const out = [];
  let depth = 0, quote = null, buf = '';
  for (const ch of sel) {
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

let failures = 0;
const fail = (msg) => { console.error(`  FALHA  ${msg}`); failures++; };
const pass = (msg) => console.log(`  ok     ${msg}`);

/* 1. Manifesto: todo arquivo referenciado precisa existir. */
console.log('manifest.json');
const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const refs = [
  ...mf.content_scripts.flatMap(c => [...(c.css || []), ...(c.js || [])]),
  mf.action.default_popup,
  ...Object.values(mf.icons),
  ...Object.values(mf.action.default_icon || {}),
];
for (const r of [...new Set(refs)]) {
  fs.existsSync(path.join(ROOT, r)) ? pass(r) : fail(`arquivo ausente: ${r}`);
}

/* 2. CSS: precisa parsear e todo seletor de topo precisa estar escopado. */
for (const rel of mf.content_scripts[0].css) {
  console.log(`\n${rel}`);
  const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let root;
  try {
    root = postcss.parse(css, { from: rel });
    pass('parseia sem erro');
  } catch (e) {
    fail(`erro de sintaxe: ${e.message}`);
    continue;
  }

  // Comentario nao fechado nao gera erro de parse -- vira texto solto que
  // engole a regra seguinte. Contagem simples pega o caso.
  const abre = (css.match(/\/\*/g) || []).length;
  const fecha = (css.match(/\*\//g) || []).length;
  abre === fecha
    ? pass(`comentarios balanceados (${abre})`)
    : fail(`comentarios desbalanceados: ${abre} "/*" para ${fecha} "*/"`);

  let rules = 0, unscoped = 0;
  root.walkRules(r => {
    rules++;
    for (const sel of splitSelectors(r.selector)) {
      if (!/^\s*html\.hbb-/.test(sel)) {
        fail(`seletor fora de escopo: ${sel.trim().slice(0, 70)}`);
        unscoped++;
      }
    }
  });
  if (!unscoped) pass(`${rules} regras, todas escopadas em html.hbb-*`);
}

/* 3. Regras-chave que ja quebraram antes e nao podem sumir de novo. */
console.log('\nregras-chave');
const core = fs.readFileSync(path.join(ROOT, 'content', 'theme-core.css'), 'utf8');
const gen = fs.readFileSync(path.join(ROOT, 'content', 'theme.generated.css'), 'utf8');
const expected = [
  [core, 'img[src*="logo" i]:not([src*="_white" i])', 'correcao do logo (com excecao do logo branco)'],
  [core, 'html.hbb-nobanner .activity-img-wrapper', 'opcao de ocultar o banner do topo'],
  [core, 'hbb-dim img:not([src*="logo" i])', 'suavizacao de imagens sem atropelar o logo'],
  [core, '--el-fill-color-blank', 'fundo dos inputs via variavel (nao no wrapper)'],
  [gen, 'html.hbb-dark{--', 'variaveis remapeadas na raiz'],
  [gen, 'linear-gradient(rgba(14,15,17', 'veu sobre superficies com arte clara'],
];
for (const [hay, needle, label] of expected) {
  hay.includes(needle) ? pass(label) : fail(`${label} — nao encontrei "${needle}"`);
}

/* 4. URLs relativas no CSS gerado quebrariam ao injetar pela extensao. */
console.log('\nurls');
const relUrls = [...gen.matchAll(/url\(\s*['"]?\.\//g)].length;
relUrls === 0
  ? pass('nenhuma url relativa no CSS gerado')
  : fail(`${relUrls} url(./...) no CSS gerado — deveriam ser root-relative`);

console.log(failures ? `\n${failures} falha(s)` : '\ntudo certo');
process.exit(failures ? 1 : 0);
