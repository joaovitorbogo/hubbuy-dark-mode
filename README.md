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

| Controle | Padrão | O que faz |
| --- | --- | --- |
| **Modo escuro** | ligado | Liga e desliga na hora, sem recarregar a página. |
| **Seguir o tema do sistema** | desligado | Fica claro quando o Windows está no modo claro. |
| **Suavizar imagens** | ligado | Reduz o brilho de banners; volta ao normal ao passar o mouse. |
| **Ocultar banner do topo** | desligado | Remove a faixa promocional acima do menu. Funciona mesmo com o tema desligado. |

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
- **arte de fundo** — fundo desenhado em PNG/WebP não é cor, então nenhum
  remapeamento alcança. `scripts/measure-bg-images.mjs` decodifica cada imagem
  num canvas e mede a luminância; as claras que servem de superfície para texto
  recebem um véu escuro por cima, preservando a ilustração. Sem isso o
  `.guide-process-wrapper` (fundo de luminância 0,96) continuaria um bloco
  branco com texto invisível.

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
npm run theme     # baixa o CSS atual, mede as imagens e regera o tema
npm run check     # verificações estáticas (manifesto, CSS, regras-chave)
```

`npm run icons` regera os PNGs do ícone e `npm run store` refaz as imagens da
Chrome Web Store a partir do site ao vivo.

## Estrutura

```
manifest.json                 MV3
content/theme.generated.css   camada gerada (não editar à mão)
content/theme-core.css        ajustes finos, base, scrollbars, Element Plus
content/apply.js              liga/desliga a classe hbb-dark no <html>
popup/                        interface do popup
icons/                        16 / 32 / 48 / 128
scripts/fetch-css.mjs         baixa os bundles do site
scripts/measure-bg-images.mjs mede a luminância das imagens de fundo
scripts/gen.mjs               gera o tema a partir deles
scripts/check.mjs             verificações estáticas
scripts/make-icons.mjs        gera os ícones
scripts/store-assets.mjs      gera as imagens da loja
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
neles daria resultado pior que deixá-los. "Suavizar imagens" (ligado por padrão)
reduz o brilho, e "Ocultar banner do topo" resolve a faixa promocional, que é um
WebP inteiro e por isso imune a qualquer tratamento de cor.

A única exceção é o logo: é um `<img>` com PNG embutido e a metade "BUY" é quase
preta, então leva um filtro para voltar a ser legível. O logo do rodapé
(`logo_white.svg`) e o do centro do QR code ficam de fora — inverter esses
pioraria. Note que `filter` não acumula entre regras: por isso a suavização de
imagens exclui os logos explicitamente, senão desfaria essa correção.

## Verificação

`npm run check` roda as verificações estáticas: todo arquivo do manifesto
existe, os dois CSS parseiam, todo seletor está escopado em `html.hbb-*`, os
comentários estão balanceados e as regras-chave continuam presentes. Esta última
checagem existe por um motivo concreto — um comentário malformado já engoliu a
regra do logo sem gerar erro nenhum.

Além disso, o tema foi conferido nas páginas reais com Chrome headless, medindo
as cores computadas de cada elemento visível. Na página inicial e na de login
não sobra nenhuma superfície clara nem texto escuro sobre fundo escuro.

As páginas de **produto** e de **pedidos** exigem login e não puderam ser
renderizadas. Elas são cobertas pelo CSS gerado a partir dos próprios chunks
dessas rotas (`order`, `dashboard`, `OrderList`, `OrderItem`, `OrderStats`,
`ProductInfoCard`, `ProductListCard`, `ProductTableTd`, `GoodsBuySku`,
`CartCard` e outros), mas não passaram por conferência visual completa.

O componente `.guide-process-wrapper`, que fica atrás de login, foi verificado
montando o markup real junto com o chunk de CSS que o define — a alternativa a
não verificar nada.

## Licença

MIT.

Projeto independente, sem vínculo com o hubbuy.
