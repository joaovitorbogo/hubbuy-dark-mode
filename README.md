# Hubbuy Dark Mode

Extensão do Chrome que aplica modo escuro no [hubbuy.com](https://www.hubbuy.com) —
página inicial, produtos, carrinho e painel de pedidos.

![Antes e depois](store/screenshot-1-antes-depois.png)

## Instalar (sem compactar)

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha a pasta `hubbuy-dark-mode`.
5. Abra o hubbuy.com. O tema já entra ligado.

O ícone da extensão abre um popup com três controles:

| Controle | O que faz |
| --- | --- |
| **Modo escuro** | Liga e desliga na hora, sem recarregar a página. |
| **Seguir o tema do sistema** | Fica claro quando o Windows está no modo claro. |
| **Suavizar imagens** | Reduz o brilho de banners; volta ao normal ao passar o mouse. |

As preferências ficam em `chrome.storage.sync`, então acompanham o seu perfil do Chrome.

## Como o tema é construído

O hubbuy é uma SPA em Nuxt + Element Plus, e **não tem tema escuro próprio**: não
existe nenhuma regra `html.dark` no CSS dele. Também não dá para resolver só
trocando variáveis CSS — só nos bundles do site há 346 fundos e 294 textos com
cor fixa (`#fff`, `#666`, `#131926`…), fora dos componentes.

Então o tema é gerado a partir do **CSS real do site**. O script
`scripts/gen.mjs` lê os 439 bundles, reaproveita os seletores originais e
remapeia apenas os valores de cor, decidindo o tratamento pela propriedade:

- **fundo** — a ordem de elevação é preservada, não invertida. No tema claro o
  card branco fica sobre a página cinza; no escuro o card continua sendo a
  camada mais clara. Inverter a luminosidade deixaria o card mais escuro que a
  página e mataria a hierarquia.
- **texto** — texto escuro clareia; texto que já era claro fica como está.
- **borda** — vira um tom sutil, sempre um pouco mais claro que a superfície.
- **sombra** — sombras claras não existem no escuro, então viram pretas.
- **acentos** — o laranja da marca (`#ff5a1f`), verdes e vermelhos semânticos
  sobrevivem. Acentos muito claros escurecem mais, senão o texto perde contraste.

O resultado sai em `content/theme.generated.css`, com todo seletor prefixado por
`html.hbb-dark`. É isso que permite o liga/desliga instantâneo: o CSS fica sempre
injetado e o content script só mexe numa classe do `<html>`.

Ajustes finos que o algoritmo não tem como acertar sozinho ficam em
`content/theme-core.css`, que carrega depois e vence os empates.

### Regenerar o tema

Os nomes dos bundles do Nuxt têm hash e mudam a cada deploy do hubbuy. Quando o
site atualizar:

```bash
npm install
npm run theme     # baixa o CSS atual e regera content/theme.generated.css
```

`npm run icons` regera os PNGs do ícone.

## Estrutura

```
manifest.json                 MV3
content/theme.generated.css   camada gerada (não editar à mão)
content/theme-core.css        ajustes finos, base, scrollbars, Element Plus
content/apply.js              liga/desliga a classe hbb-dark no <html>
popup/                        interface do popup
icons/                        16 / 32 / 48 / 128
scripts/fetch-css.mjs         baixa os bundles do site
scripts/gen.mjs               gera o tema a partir deles
scripts/make-icons.mjs        gera os ícones
store/                        imagens prontas para a Chrome Web Store
```

## Detalhes que valem saber

**O Nuxt reescreve `html.className`.** Durante a hidratação e em algumas
transições de rota ele apaga o atributo inteiro, o que derrubaria o tema no meio
da navegação. O `apply.js` mantém um `MutationObserver` que reaplica a classe.
Sem isso o tema simplesmente não gruda nesta SPA.

**URLs relativas.** Os bundles ficam em `/_nuxt/`, então `url(./bg-home.png)`
resolve para `/_nuxt/bg-home.png` no CSS original. Injetado pela extensão, o
mesmo caminho resolveria contra a URL da página e quebraria a imagem — o gerador
converte essas URLs para root-relative.

**Imagens não são recoloridas.** Banners e ilustrações são arte do site; mexer
neles daria resultado pior que deixá-los. A opção "Suavizar imagens" existe
justamente para quem achar os banners claros demais. A única exceção é o logo:
ele é um `<img>` com PNG embutido e a metade "BUY" é quase preta, então leva um
filtro para voltar a ser legível (o logo do rodapé, que já é branco, fica fora).

## Verificação

O tema foi conferido nas páginas reais com Chrome headless, medindo as cores
computadas de cada elemento visível. Na página inicial e na de login não sobra
nenhuma superfície clara nem texto escuro sobre fundo escuro.

As páginas de **produto** e de **pedidos** exigem login e não puderam ser
renderizadas na verificação automática. Elas são cobertas pelo CSS gerado a
partir dos próprios chunks dessas rotas (`order`, `dashboard`, `OrderList`,
`OrderItem`, `OrderStats`, `ProductInfoCard`, `ProductListCard`,
`ProductTableTd`, `GoodsBuySku`, `CartCard` e outros), mas não passaram por
conferência visual.

## Licença

MIT.

Projeto independente, sem vínculo com o hubbuy.
