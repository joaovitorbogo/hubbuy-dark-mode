# Material para a Chrome Web Store

## Imagens (prontas nesta pasta)

| Arquivo | Tamanho | Onde entra |
| --- | --- | --- |
| `../icons/icon128.png` | 128×128 | Ícone da loja (obrigatório) |
| `screenshot-1-antes-depois.png` | 1280×800 | Captura 1 (obrigatório: ao menos uma) |
| `screenshot-2-inicio.png` | 1280×800 | Captura 2 |
| `screenshot-3-formularios.png` | 1280×800 | Captura 3 |
| `screenshot-4-controles.png` | 1280×800 | Captura 4 |
| `promo-small-440x280.png` | 440×280 | Bloco promocional pequeno (opcional) |
| `promo-marquee-1400x560.png` | 1400×560 | Bloco promocional marquee (opcional) |

Máximo de 5 capturas. Use `screenshot-1` como primeira — é a que aparece maior.

## Nome

```
Hubbuy Dark Mode
```

## Descrição breve (até 132 caracteres)

```
Modo escuro para o hubbuy.com: página inicial, produtos, carrinho e pedidos. Liga e desliga em um clique.
```

## Descrição completa

```
Modo escuro para o hubbuy.com.

O hubbuy não tem tema escuro próprio. Esta extensão aplica um, escurecendo o
site inteiro — página inicial, busca, páginas de produto, carrinho, checkout e
o painel de pedidos — sem mexer no laranja da marca.

O que ela faz

• Escurece fundos, cards, tabelas, menus, formulários e caixas de diálogo.
• Mantém as cores que carregam significado: o laranja do hubbuy, o verde de
  confirmação e o vermelho de alerta continuam reconhecíveis.
• Preserva a hierarquia visual: o que era um card sobre a página continua
  parecendo um card sobre a página.
• Liga e desliga em um clique, sem recarregar a página.
• Pode seguir o tema do Windows: claro de dia, escuro de noite.
• Suaviza banners muito claros (já vem ligado). Passe o mouse e a imagem volta
  ao normal.
• Esconde a faixa promocional do topo, se você quiser — e isso funciona mesmo
  com o tema escuro desligado.

Como funciona

O tema não é um filtro de inversão em cima da tela. Ele é gerado a partir do CSS
real do hubbuy: cada regra de cor do site é lida e remapeada de acordo com o
papel dela na página — fundo, texto, borda ou sombra. É por isso que o resultado
não tem aquele aspecto lavado de inversão automática.

Privacidade

A extensão não coleta, não envia e não armazena nenhum dado seu. Roda apenas em
hubbuy.com e hubbuy.app, e a única permissão que usa é a de salvar as três
preferências do popup no seu perfil do Chrome.

Projeto independente, sem vínculo com o hubbuy. Código aberto sob licença MIT.
```

## Categoria

Ferramentas de desenvolvedor → não. Use **Funcionalidade e interface do usuário**.

## Justificativa das permissões

Campo obrigatório no painel da loja. Sugestões:

- **storage** — "Guarda as quatro preferências do popup (modo escuro, seguir o
  tema do sistema, suavizar imagens, ocultar o banner do topo) no perfil do
  usuário."
- **activeTab** — "Usada só quando o popup é aberto, para avisar que a aba atual
  não é do hubbuy.com. Nenhum conteúdo da página é lido."
- **Acesso ao host (hubbuy.com / hubbuy.app)** — "Necessário para injetar a
  folha de estilo do tema escuro nas páginas do hubbuy."

## Uso de código remoto

Responda **não**. Todo o CSS e JS estão empacotados na extensão.
