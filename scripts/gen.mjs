// Gera o stylesheet de dark mode a partir do CSS real do hubbuy.com.
// Estratégia: reaproveita os seletores originais e remapeia apenas os valores
// de cor, por propriedade (fundo / texto / borda / sombra).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '.cache', 'allcss');
const OUT = path.join(ROOT, 'content', 'theme.generated.css');

if (!fs.existsSync(SRC)) {
  console.error('CSS de origem nao encontrado. Rode antes: node scripts/fetch-css.mjs');
  process.exit(1);
}

/* ---------- conversao de cor ---------- */

const NAMED = {
  white: [255, 255, 255, 1], black: [0, 0, 0, 1], red: [255, 0, 0, 1],
  gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], silver: [192, 192, 192, 1],
  whitesmoke: [245, 245, 245, 1], gainsboro: [220, 220, 220, 1],
  lightgray: [211, 211, 211, 1], lightgrey: [211, 211, 211, 1],
  dimgray: [105, 105, 105, 1], darkgray: [169, 169, 169, 1],
};

function parseColor(s) {
  s = s.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s].slice();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    const ex = (c) => parseInt(c + c, 16);
    if (h.length === 3) return [ex(h[0]), ex(h[1]), ex(h[2]), 1];
    if (h.length === 4) return [ex(h[0]), ex(h[1]), ex(h[2]), ex(h[3]) / 255];
    if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    if (h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255];
    return null;
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const num = (v, max) => v.endsWith('%') ? (parseFloat(v) / 100) * max : parseFloat(v);
    const r = num(p[0], 255), g = num(p[1], 255), b = num(p[2], 255);
    const a = p[3] === undefined ? 1 : num(p[3], 1);
    if ([r, g, b, a].some(Number.isNaN)) return null;
    return [r, g, b, a];
  }
  m = /^hsla?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const h = parseFloat(p[0]), sa = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100;
    const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]));
    const [r, g, b] = hsl2rgb(h, sa, l);
    return [r, g, b, a];
  }
  return null;
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const fmt = ([r, g, b, a]) => {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  if (a >= 0.999) return '#' + [r, g, b].map(v => c(v).toString(16).padStart(2, '0')).join('');
  return `rgba(${c(r)},${c(g)},${c(b)},${Math.round(a * 1000) / 1000})`;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Cores de marca / semanticas que devem sobreviver ao tema escuro.
const isAccent = (s, l) => s > 0.45 && l > 0.22 && l < 0.78;

/**
 * Remapeia uma cor conforme o papel dela na pagina.
 * role: 'bg' | 'text' | 'border' | 'shadow'
 */
function mapColor(str, role) {
  const c = parseColor(str);
  if (!c) return null;
  const [r, g, b, a] = c;
  if (a === 0) return null;                       // totalmente transparente: nao mexe
  const [h, s, l] = rgb2hsl(r, g, b);

  if (role === 'shadow') {
    // Sombras claras nao existem no escuro: viram pretas, um pouco mais densas.
    return fmt([0, 0, 0, clamp(a * 1.35, 0.08, 0.75)]);
  }

  if (role === 'bg') {
    if (isAccent(s, l)) {
      // Botao/badge de marca: mantem o tom. Acentos claros (amarelo, ciano)
      // escurecem mais, senao o texto -- que vira claro -- perde contraste.
      const nl = l > 0.6 ? clamp(l * 0.60, 0.22, 0.42) : l * 0.9;
      return fmt([...hsl2rgb(h, s * 0.94, nl), a]);
    }
    // A ordem de elevacao precisa ser PRESERVADA, nao invertida: no tema claro
    // o card branco fica sobre a pagina cinza; no escuro o card continua sendo
    // a camada mais clara. Inverter a luminosidade deixaria o card mais escuro
    // que a pagina e mataria a hierarquia visual.
    let nl;
    if (l >= 0.86) {
      nl = 0.055 + ((l - 0.86) / 0.14) * 0.065;   // faixa das superficies: 0.055 -> 0.12
    } else if (l >= 0.35) {
      nl = 0.13 + ((0.86 - l) / 0.51) * 0.10;     // cinzas medios -> camada elevada
    } else {
      nl = l;                                      // ja era escuro (footer, toast): mantem
    }
    // Matizes pastel (ex.: #fff3ea) preservam a identidade com saturacao baixa.
    const ns = l > 0.85 ? clamp(s * 0.30, 0, 0.22) : clamp(s * 0.45, 0, 0.30);
    return fmt([...hsl2rgb(h, ns, clamp(nl, 0.04, 0.32)), a]);
  }

  if (role === 'border') {
    if (isAccent(s, l)) return fmt([...hsl2rgb(h, s * 0.9, clamp(l, 0.32, 0.62)), a]);
    const nl = clamp(0.17 + (1 - l) * 0.14, 0.17, 0.34);
    return fmt([...hsl2rgb(h, clamp(s * 0.35, 0, 0.2), nl), a]);
  }

  // role === 'text'
  if (isAccent(s, l)) {
    // Laranja da marca em fundo escuro precisa de mais luz para manter contraste.
    return fmt([...hsl2rgb(h, clamp(s * 0.95, 0, 1), clamp(l, 0.55, 0.78)), a]);
  }
  if (l > 0.62) return fmt([r, g, b, a]);          // ja era texto claro: mantem
  const nl = clamp(1 - l * 0.78, 0.62, 0.93);      // texto escuro -> claro
  return fmt([...hsl2rgb(h, clamp(s * 0.55, 0, 0.25), nl), a]);
}

/* ---------- reescrita de valores ---------- */

const COLOR_RE = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|\b(?:white|black|whitesmoke|gainsboro|lightgray|lightgrey|silver|dimgray|darkgray|gray|grey)\b)/g;

// Trechos que nao devem ser tocados dentro de um valor (url, var, calc...).
// Os bundles ficam em /_nuxt/, entao "./img.png" resolve para /_nuxt/img.png.
// Injetado pela extensao, o mesmo CSS resolveria contra a URL da PAGINA e
// quebraria a imagem. Vira root-relative para funcionar em qualquer dominio.
const ASSET_BASE = '/_nuxt/';

function absolutizeUrl(u) {
  return u.replace(/^(url\(\s*)(['"]?)\.\/(.*?)(\2\s*\))$/i,
    (_, open, q, rest, close) => `${open}${q}${ASSET_BASE}${rest}${close}`);
}

function rewriteValue(value, role) {
  let touched = false;
  // Protege url(...) para nao destruir data-URIs com "#" ou "rgb".
  const urls = [];
  const guarded = value.replace(/url\([^)]*\)/gi, (m) => {
    const fixed = absolutizeUrl(m);
    if (fixed !== m) touched = true;
    urls.push(fixed);
    return `__U${urls.length - 1}__`;
  });
  const out = guarded.replace(COLOR_RE, (m) => {
    const mapped = mapColor(m, role);
    if (!mapped) return m;
    // Compara canonicamente: "#fff" e "#ffffff" sao a mesma cor e nao devem
    // contar como alteracao, senao geramos milhares de regras no-op.
    const a = parseColor(m), b = parseColor(mapped);
    if (a && b && a.every((v, i) => Math.abs(v - b[i]) < (i === 3 ? 0.004 : 1))) return m;
    touched = true;
    return mapped;
  });
  if (!touched) return null;
  return out.replace(/__U(\d+)__/g, (_, i) => urls[+i]);
}

/* ---------- classificacao de propriedade ---------- */

function roleFor(prop) {
  const p = prop.toLowerCase();
  if (p === 'box-shadow' || p === 'text-shadow' || p === '-webkit-box-shadow') return 'shadow';
  if (p === 'color' || p === '-webkit-text-fill-color' || p === 'caret-color' || p === 'text-decoration-color') return 'text';
  if (p === 'border' || p.startsWith('border-') || p === 'outline' || p.startsWith('outline-') ||
      p === 'column-rule' || p.startsWith('column-rule-')) {
    if (/(radius|width|style|image-slice|image-width|image-outset|image-repeat|spacing|collapse|offset)$/.test(p)) return null;
    return 'border';
  }
  if (p === 'background' || p === 'background-color' || p === 'background-image') return 'bg';
  if (p === 'fill' || p === 'stroke') return 'text';
  if (p.startsWith('--')) return 'var';
  return null;
}

// Constantes literais de cor: nao tem papel semantico e sao usadas tanto como
// fundo quanto como texto. Remapear --el-color-white deixaria texto escuro
// sobre botao laranja, entao ficam de fora.
// As cores semanticas base do Element Plus (--el-color-info e companhia) sao
// usadas ora como fundo, ora como texto, ora como borda. Remapear pelo nome
// erra: --el-color-info virava fundo escuro e o texto "Pesquisar" sumia.
// Ficam de fora; so as variantes -light-N (tons pastel, sempre fundo) mudam.
const VAR_DENY = /^--(el-color-(white|black|primary|success|warning|danger|error|info)|.*-rgb)$/;

// Papel de uma custom property, deduzido pelo nome (convencao do Element Plus
// e do proprio site). Cai para heuristica de luminosidade quando nao da match.
function roleForVar(name) {
  const n = name.toLowerCase();
  if (VAR_DENY.test(n)) return 'skip';
  if (/(shadow)/.test(n)) return 'shadow';
  if (/(border|divider|line-color|\bbor-)/.test(n)) return 'border';
  if (/(text|font-color|placeholder)/.test(n)) return 'text';
  if (/(bg|background|fill|surface|mask|overlay|card|panel)/.test(n)) return 'bg';
  return null;
}

/* ---------- geracao ---------- */

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.css')).sort();
const chunks = [];
const seen = new Set();
let ruleCount = 0, declCount = 0, skippedFiles = 0;

// Seletores que nunca devem ser tematizados (ilustracoes, logos, mascotes).
const SELECTOR_DENY = /(^|[\s,>+~])(img|video|canvas|iframe)\b|\.logo\b|\.el-carousel__(item|container)\b/i;

// Classe que liga o tema. Todo seletor gerado e prefixado com ela, entao o
// stylesheet pode ficar sempre injetado e o toggle vira um classList.toggle
// no <html> -- sem reload e sem piscar.
const SCOPE = 'html.hbb-dark';

// Split por virgula respeitando parenteses e colchetes de :is(a,b), [x=","] etc.
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

function scopeSelector(sel) {
  return splitSelectors(sel).map(part => {
    // :root vira html.hbb-dark:root; html/body ganham a classe no lugar certo.
    if (/^:root\b/.test(part)) return SCOPE + part.slice(5);
    if (/^html\b/.test(part)) return SCOPE + part.slice(4);
    return `${SCOPE} ${part}`;
  }).join(',');
}

/* ---------- superficies com imagem de fundo clara ----------
 *
 * Fundo desenhado em PNG/WebP nao e cor: o remapeamento nao alcanca. O
 * ".guide-process-wrapper" do hubbuy, por exemplo, usa um step-bg.png de
 * luminancia 0.96 -- continua um bloco branco no tema escuro, e o texto (que
 * clareamos) desaparece em cima dele.
 *
 * Em vez de trocar a arte por uma cor chapada, sobrepomos um veu escuro como
 * primeira camada de background-image. A ilustracao continua la, so que
 * legivel. So entram imagens medidas como claras E seletores que tem regras
 * descendentes no mesmo arquivo -- ou seja, containers que abrigam conteudo,
 * nao elementos que SAO a ilustracao (mascotes, selos de idioma, cupons).
 */
const LUMA_FILE = path.join(ROOT, '.cache', 'bg-luminance.json');
const LUMA = fs.existsSync(LUMA_FILE)
  ? JSON.parse(fs.readFileSync(LUMA_FILE, 'utf8'))
  : {};
if (!Object.keys(LUMA).length) {
  console.warn('aviso: .cache/bg-luminance.json ausente — imagens de fundo claras');
  console.warn('       nao serao tratadas. Rode: node scripts/measure-bg-images.mjs');
}
const LIGHT_IMG_MIN = 0.62;
const scrimmed = [];

const stripScope = (s) => s.replace(/\[data-v-[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();

/** Veu proporcional: quanto mais clara a arte, mais denso. */
function scrimFor(luma) {
  const a = Math.min(0.9, Math.max(0.6, 0.6 + (luma - LIGHT_IMG_MIN) * 0.78));
  return `rgba(14,15,17,${a.toFixed(3)})`;
}

function processRoot(root, file) {
  // Todos os seletores do arquivo, sem os atributos de escopo do Vue, para
  // saber quais sao containers (tem descendentes estilizados).
  const allSelectors = [];
  root.walkRules(r => splitSelectors(r.selector).forEach(s => allSelectors.push(stripScope(s))));
  const isContainer = (sel) => {
    const base = stripScope(sel);
    return allSelectors.some(s => s !== base && s.startsWith(base + ' '));
  };

  const walk = (container, prefix) => {
    container.each(node => {
      if (node.type === 'atrule') {
        const n = node.name.toLowerCase();
        if (n === 'keyframes' || n === '-webkit-keyframes' || n === 'font-face' ||
            n === 'import' || n === 'charset' || n === 'property') return;
        if (n === 'media' || n === 'supports' || n === 'layer' || n === 'container') {
          const inner = [];
          walk(node, (sel, body) => inner.push({ sel, body }));
          if (inner.length) prefix.atrule(`@${node.name} ${node.params}`, inner);
        }
        return;
      }
      if (node.type !== 'rule') return;
      const sel = node.selector.replace(/\s+/g, ' ').trim();
      if (!sel || SELECTOR_DENY.test(sel)) return;
      const decls = [];
      let scrim = null;
      node.each(d => {
        if (d.type !== 'decl') return;

        // Superficie com arte clara de fundo: guarda o veu para emitir depois.
        if ((d.prop === 'background' || d.prop === 'background-image') && /url\(/i.test(d.value)) {
          const urls = [...d.value.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map(m => m[1]);
          const hasGradient = /gradient\(/i.test(d.value);
          if (urls.length === 1 && !hasGradient) {
            const luma = LUMA[urls[0].replace(/^\.\//, '')];
            if (typeof luma === 'number' && luma > LIGHT_IMG_MIN && isContainer(sel)) {
              const abs = urls[0].replace(/^\.\//, ASSET_BASE);
              scrim = `background-image:linear-gradient(${scrimFor(luma)},${scrimFor(luma)}),url(${abs}) !important`;
              scrimmed.push(`${stripScope(sel)}  (${luma.toFixed(2)})  ${urls[0].replace(/^\.\//, '')}`);
            }
          }
        }

        let role = roleFor(d.prop);
        if (role === 'var') {
          role = roleForVar(d.prop);
          if (role === 'skip') return;
          if (!role) {
            // Sem pista no nome, so agimos nos extremos: tons quase brancos so
            // servem de superficie e tons quase pretos so servem de texto. O
            // meio da escala e ambiguo demais -- deixa como esta.
            const c = parseColor(d.value.trim());
            if (!c) return;
            const [, , l] = rgb2hsl(c[0], c[1], c[2]);
            if (l > 0.82) role = 'bg';
            else if (l < 0.25) role = 'text';
            else return;
          }
        }
        if (!role) return;
        const nv = rewriteValue(d.value, role);
        if (nv === null) return;
        decls.push(`${d.prop}:${nv}${d.important ? '' : ''} !important`);
        declCount++;
      });
      // O veu vai por ultimo: background-image depois do shorthand background
      // sobrescreve so a camada de imagem, preservando cor, posicao e size.
      if (scrim) { decls.push(scrim); declCount++; }
      if (!decls.length) return;
      const body = decls.join(';');
      const scoped = scopeSelector(sel);
      const key = scoped + '{' + body;
      if (seen.has(key)) return;
      seen.add(key);
      ruleCount++;
      prefix(scoped, body);
    });
  };

  const lines = [];
  const emit = (sel, body) => lines.push(`${sel}{${body}}`);
  emit.atrule = (head, inner) => {
    lines.push(`${head}{`);
    inner.forEach(({ sel, body }) => lines.push(`${sel}{${body}}`));
    lines.push('}');
  };
  walk(root, emit);
  if (lines.length) chunks.push(`/* ${file} */\n` + lines.join('\n'));
}

for (const file of files) {
  const css = fs.readFileSync(path.join(SRC, file), 'utf8');
  try {
    processRoot(postcss.parse(css, { from: file }), file);
  } catch (e) {
    skippedFiles++;
    console.error(`skip ${file}: ${e.message}`);
  }
}

const header = `/* hubbuy dark mode - camada gerada
 * Derivada automaticamente dos ${files.length} bundles de CSS de www.hubbuy.com.
 * Nao editar a mao: regenerar com scripts/gen.mjs.
 * Ajustes finos ficam em dark-core.css, que carrega depois desta camada.
 */
`;

fs.writeFileSync(OUT, header + chunks.join('\n'));
if (scrimmed.length) {
  console.log(`\nsuperficies com arte clara que receberam veu (${scrimmed.length}):`);
  [...new Set(scrimmed)].sort().forEach(s => console.log('  ' + s));
  console.log('');
}
console.log(`arquivos: ${files.length} (falhas: ${skippedFiles})`);
console.log(`regras: ${ruleCount} | declaracoes: ${declCount}`);
console.log(`saida: ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
