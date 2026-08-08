// Gera as imagens da Chrome Web Store em ./store.
//
// Tres etapas: captura o hubbuy real nos dois estados, fotografa o popup, e
// compoe as pecas em HTML fotografado no tamanho exato que a loja exige.
//
// A peca central e um "split": a mesma pagina cortada ao meio, clara de um
// lado e escura do outro, com uma costura laranja no corte. As duas metades
// usam o MESMO deslocamento de imagem -- so o recorte muda. E o que faz
// parecer uma pagina unica partida, e nao duas capturas lado a lado.
//
// Uso: node scripts/store-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pp from 'puppeteer-core';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, '.cache', 'store-src');
const TMP = path.join(ROOT, '.cache', 'tiles-html');
const OUT = path.join(ROOT, 'store');
const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

for (const d of [SHOTS, TMP, OUT]) fs.mkdirSync(d, { recursive: true });

const THEME =
  fs.readFileSync(path.join(ROOT, 'content', 'theme.generated.css'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'content', 'theme-core.css'), 'utf8');

const browser = await pp.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});

/* ---------- 1. capturas do site ---------- */

async function shootSite(url, classes, name) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await p.setUserAgent(UA);
  if (classes.length) {
    await p.evaluateOnNewDocument((css, cls) => {
      const boot = (h) => {
        const apply = () => cls.forEach(c => h.classList.add(c));
        apply();
        // O Nuxt reescreve html.className na hidratacao; sem isto o tema cai.
        new MutationObserver(() => h.classList.contains(cls[0]) || apply())
          .observe(h, { attributes: true, attributeFilter: ['class'] });
        const s = document.createElement('style');
        s.textContent = css;
        h.appendChild(s);
      };
      if (document.documentElement) boot(document.documentElement);
      else {
        const w = new MutationObserver(() => {
          if (!document.documentElement) return;
          w.disconnect();
          boot(document.documentElement);
        });
        w.observe(document, { childList: true });
      }
    }, THEME, classes);
  }
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 7000));
  // Painel de tarefas e widget de chat cobrem a interface; saem das fotos.
  await p.evaluate(() => {
    for (const sel of ['.newbie-task-card', '.task-float', '.tools-content',
                       '[class*="echat" i]', '#echat-lib-wrap']) {
      document.querySelectorAll(sel).forEach(e => e.remove());
    }
  });
  await new Promise(r => setTimeout(r, 900));
  await p.screenshot({ path: path.join(SHOTS, name) });
  console.log('  ' + name);
  await p.close();
}

console.log('capturas do site:');
await shootSite('https://www.hubbuy.com/', [], 'home-light.png');
await shootSite('https://www.hubbuy.com/', ['hbb-dark', 'hbb-dim'], 'home-dark.png');
await shootSite('https://www.hubbuy.com/login', ['hbb-dark', 'hbb-dim'], 'login-dark.png');

/* ---------- 2. popup ---------- */

{
  const p = await browser.newPage();
  await p.setViewport({ width: 324, height: 600, deviceScaleFactor: 3 });
  await p.goto('file:///' + path.join(ROOT, 'popup', 'popup.html').replace(/\\/g, '/'),
    { waitUntil: 'networkidle0' });
  // O popup real le chrome.storage, que nao existe em file://; fixamos o estado.
  await p.evaluate(() => {
    for (const id of ['enabled', 'dimMedia', 'hideBanner']) document.getElementById(id).checked = true;
    document.getElementById('status').textContent = 'Ligado';
    document.getElementById('status').dataset.on = 'true';
    document.querySelector('.group').dataset.disabled = 'false';
  });
  // Os switches tem transicao de 0.16s: sem esperar, o screenshot pega a cor
  // intermediaria e o laranja da marca sai marrom.
  await new Promise(r => setTimeout(r, 900));
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewport({ width: 324, height: h, deviceScaleFactor: 3 });
  await new Promise(r => setTimeout(r, 500));
  const c = await p.evaluate(() =>
    getComputedStyle(document.querySelector('#enabled + .switch-ui')).backgroundColor);
  if (c !== 'rgb(255, 90, 31)') console.warn(`  aviso: switch em ${c}, esperado o laranja da marca`);
  await p.screenshot({ path: path.join(SHOTS, 'popup.png') });
  console.log('  popup.png');
  await p.close();
}

/* ---------- 3. composicao das pecas ---------- */

const rel = (f) => path.relative(TMP, path.join(SHOTS, f)).replace(/\\/g, '/');
const ICON = path.relative(TMP, path.join(ROOT, 'icons', 'icon128.png')).replace(/\\/g, '/');

const BASE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{--ink:#0b0c0d;--line:#2d2f33;--brand:#ff5a1f;--text:#e9ebed;--dim:#8b9198;
       background:var(--ink);color:var(--text);
       font-family:"Segoe UI",system-ui,sans-serif;overflow:hidden}
  /* Bahnschrift e a grotesca condensada que ja vem no Windows: tem cara de
     etiqueta de frete, que e o mundo do hubbuy. */
  .display{font-family:Bahnschrift,"Segoe UI",sans-serif;font-stretch:condensed;
           font-weight:600;letter-spacing:.01em;text-transform:uppercase;line-height:.92}
  .mono{font-family:Consolas,"Cascadia Mono",monospace;letter-spacing:.14em;text-transform:uppercase}
  .split{position:relative;overflow:hidden;background:var(--ink)}
  .half{position:absolute;top:0;height:100%;overflow:hidden}
  .half img{position:absolute;display:block;max-width:none}
  .seam{position:absolute;top:0;height:100%;width:3px;background:var(--brand);
        box-shadow:0 0 24px 4px rgba(255,90,31,.45);z-index:3}
  .tag{position:absolute;z-index:4;font-size:10.5px;padding:5px 9px;border-radius:3px}
`;

function split({ seam, w, imgW, left, top }) {
  const st = `width:${imgW}px;height:auto;left:${left}px;top:${top}px`;
  return `
  <div class="half" style="left:0;width:${seam}px"><img src="${rel('home-light.png')}" style="${st}"></div>
  <div class="half" style="left:${seam}px;width:${w - seam}px"><img src="${rel('home-dark.png')}" style="${st};left:${left - seam}px"></div>
  <div class="seam" style="left:${seam}px"></div>`;
}

const CAP = `
  .cap{position:absolute;z-index:4;left:0;right:0;bottom:0;padding:52px 34px 24px;
       background:linear-gradient(transparent,rgba(8,9,10,.94) 48%)}
  .cap b{font-family:Bahnschrift,"Segoe UI",sans-serif;font-stretch:condensed;
         text-transform:uppercase;letter-spacing:.02em;font-size:21px;display:block;margin-bottom:4px}
  .cap span{color:var(--dim);font-size:13.5px}
  img.full{width:1280px;display:block}
`;

const pages = {
  'promo-small-440x280': { w: 440, h: 280, html: `
<style>${BASE}
  body{width:440px;height:280px;position:relative}
  .split{position:absolute;inset:0}
  .scrim{position:absolute;inset:auto 0 0 0;height:112px;z-index:5;
         background:linear-gradient(transparent,rgba(8,9,10,.86) 36%,#08090a)}
  .bar{position:absolute;z-index:6;left:18px;right:18px;bottom:16px;display:flex;align-items:center;gap:10px}
  .bar img{width:29px;height:29px}
  h1{font-size:25px} h1 em{font-style:normal;color:var(--brand)}
  .sub{font-size:11px;color:var(--dim);margin-top:3px}
</style>
<div class="split">${split({ seam: 200, w: 440, imgW: 1280, left: -8, top: -60 })}</div>
<div class="scrim"></div>
<div class="bar"><img src="${ICON}" alt="">
  <div><h1 class="display">Hubbuy <em>Dark Mode</em></h1>
  <div class="sub">Início, produtos, carrinho e pedidos</div></div>
</div>` },

  'promo-marquee-1400x560': { w: 1400, h: 560, html: `
<style>${BASE}
  body{width:1400px;height:560px;position:relative}
  .split{position:absolute;inset:0}
  .scrim{position:absolute;inset:0 0 0 830px;z-index:5;
         background:linear-gradient(90deg,rgba(11,12,13,0) 0,rgba(11,12,13,.92) 120px,#0b0c0d 250px)}
  .copy{position:absolute;z-index:6;right:72px;top:50%;transform:translateY(-50%);width:480px;text-align:right}
  .copy img{width:54px;height:54px;margin-bottom:18px}
  h1{font-size:62px} h1 em{font-style:normal;color:var(--brand);display:block}
  .rule{height:1px;background:#33363b;margin:18px 0 0 auto;width:110px}
  .sub{font-size:16.5px;color:#aab0b6;margin-top:16px;line-height:1.55}
  .meta{margin-top:24px;font-size:10px;color:#5d646b}
</style>
<div class="split">${split({ seam: 480, w: 1400, imgW: 1400, left: 0, top: -96 })}</div>
<div class="scrim"></div>
<div class="copy"><img src="${ICON}" alt="">
  <h1 class="display">Hubbuy<em>Dark Mode</em></h1>
  <div class="rule"></div>
  <div class="sub">Tema escuro para o hubbuy.com inteiro —<br>página inicial, produtos, carrinho e pedidos.</div>
  <div class="meta mono">1 clique · sem recarregar a página</div>
</div>` },

  'screenshot-1-antes-depois': { w: 1280, h: 800, html: `
<style>${BASE}
  body{width:1280px;height:800px;position:relative}
  .split{position:absolute;left:0;right:0;top:0;height:718px}
  /* Etiquetas embaixo: no topo caem sobre o logo e o botao de download. */
  .tag{bottom:20px}
  .tag.l{left:20px;background:rgba(255,255,255,.94);color:#2a3240}
  .tag.d{right:20px;background:rgba(20,20,20,.94);color:var(--text);border:1px solid #3a3d43}
  .foot{position:absolute;z-index:6;left:0;right:0;bottom:0;height:82px;background:#0b0c0d;
        border-top:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:13px}
  .foot img{width:27px;height:27px} .foot b{font-size:20px}
  .foot span{font-size:13.5px;color:var(--dim)}
</style>
<div class="split">${split({ seam: 640, w: 1280, imgW: 1280, left: 0, top: 0 })}
  <div class="tag l mono">Original</div>
  <div class="tag d mono">Com a extensão</div>
</div>
<div class="foot"><img src="${ICON}" alt="">
  <b class="display">O mesmo hubbuy, no escuro</b>
  <span>— cores, cards, tabelas e formulários</span>
</div>` },

  'screenshot-2-inicio': { w: 1280, h: 800, html: `
<style>${BASE}${CAP}body{width:1280px;height:800px;position:relative}</style>
<img class="full" src="${rel('home-dark.png')}">
<div class="cap"><b>Página inicial</b>
  <span>Cabeçalho, busca e blocos promocionais adaptados — o laranja da marca continua o mesmo.</span>
</div>` },

  'screenshot-3-formularios': { w: 1280, h: 800, html: `
<style>${BASE}${CAP}body{width:1280px;height:800px;position:relative}</style>
<img class="full" src="${rel('login-dark.png')}">
<div class="cap"><b>Formulários e componentes</b>
  <span>Campos, botões, menus, tabelas e caixas de diálogo do Element Plus recebem tratamento próprio.</span>
</div>` },

  'screenshot-4-controles': { w: 1280, h: 800, html: `
<style>${BASE}
  body{width:1280px;height:800px;position:relative}
  .bgwrap{position:absolute;inset:0;overflow:hidden}
  .bgwrap img{width:1280px;display:block;filter:blur(7px) brightness(.5) saturate(.8)}
  /* Camada solida sobre o desfoque: so brightness nao segura o banner branco
     do topo, e o titulo do hero fica fantasmando atras do texto. */
  .veil{position:absolute;inset:0;z-index:2;background:rgba(10,11,12,.8)}
  .stage{position:absolute;inset:0;z-index:3;display:flex;align-items:center;
         justify-content:center;gap:66px;padding:0 76px}
  .pop{border:1px solid var(--line);border-radius:13px;overflow:hidden;
       box-shadow:0 34px 74px rgba(0,0,0,.66);flex:none}
  .pop img{width:330px;display:block}
  .txt{max-width:460px}
  .txt h2{font-family:Bahnschrift,"Segoe UI",sans-serif;font-stretch:condensed;
          text-transform:uppercase;font-size:42px;line-height:1;letter-spacing:.01em}
  .txt h2 em{font-style:normal;color:var(--brand)}
  .txt ul{list-style:none;margin-top:26px}
  .txt li{font-size:15px;color:#c8cdd2;padding:11px 0 11px 20px;position:relative;
          border-top:1px solid var(--line)}
  .txt li:first-child{border-top:0}
  .txt li::before{content:"";position:absolute;left:0;top:18px;width:7px;height:7px;
                  background:var(--brand);border-radius:1px}
  .txt li i{font-style:normal;color:var(--dim);display:block;font-size:12.5px;margin-top:2px}
</style>
<div class="bgwrap"><img src="${rel('home-dark.png')}"></div>
<div class="veil"></div>
<div class="stage">
  <div class="txt"><h2>Você no <em>controle</em></h2>
    <ul>
      <li>Liga e desliga na hora<i>Sem recarregar a página</i></li>
      <li>Pode seguir o tema do Windows<i>Claro de dia, escuro de noite</i></li>
      <li>Suaviza banners muito claros<i>Volta ao normal ao passar o mouse</i></li>
      <li>Esconde o banner do topo<i>Funciona até com o tema desligado</i></li>
    </ul>
  </div>
  <div class="pop"><img src="${rel('popup.png')}"></div>
</div>` },
};

console.log('pecas da loja:');
for (const [name, { w, h, html }] of Object.entries(pages)) {
  const file = path.join(TMP, name + '.html');
  fs.writeFileSync(file, '<!doctype html><meta charset="utf-8">' + html);
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'load' });
  const broken = await p.evaluate(async () => {
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
    return [...document.images].filter(i => !i.naturalWidth).map(i => i.src.split('/').pop());
  });
  if (broken.length) console.warn(`  aviso: imagens nao carregaram: ${broken.join(', ')}`);
  await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}.png  ${w}x${h}`);
  await p.close();
}

await browser.close();
console.log(`\npronto: ${path.relative(ROOT, OUT)}`);
