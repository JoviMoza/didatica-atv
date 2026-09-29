---
name: h5p-frontend
description: Design e implementação de interface do objeto H5P "Magnetismo e Transporte" (JavaScript e CSS puros dentro do iframe H5P). Use ao criar ou alterar páginas, componentes, estilos, layout responsivo, acessibilidade, textos da interface ou o laboratório de ímãs em h5p-src/H5P.MagnetismoTransporte — frontend, UI, CSS, design tokens, componentes mt-*, screenshots de verificação.
---

# Frontend do Magnetismo e Transporte

Esta skill descreve o sistema visual e os padrões de interface que já existem no projeto. Para princípios gerais de design (tipografia, paleta, contenção), consulte também `.claude/skills/frontend-design/SKILL.md`. Quando as duas divergirem, esta prevalece, porque reflete decisões já aprovadas pela equipe.

## Restrições da stack

- A interface roda dentro do **iframe do H5P**, carregado pelo Lumi ou por um LMS. Não há React, Tailwind nem build: são arquivos `.js` e `.css` listados em `library.json`.
- Não carregue nada de fora: nem fontes web, nem CDNs, nem ícones remotos. As únicas exceções são o YouTube e o VLibras (Libras do Governo Federal), e os dois só carregam depois de um clique do aluno. O pacote precisa funcionar offline e passar pelo validador do Lumi. Use a pilha de fontes do sistema (`--font`), SVG inline e emoji apenas decorativo (`aria-hidden`).
- A altura é controlada pelo H5P. Depois de qualquer mudança de layout, chame `app.resize()`. `position: sticky` só funciona no próprio iframe.
- O público são estudantes do ensino médio, em computador da escola ou celular. Todo texto da interface é em pt-BR, com linguagem simples.

## Tokens (em `css/base.css`, no bloco `.h5p-mt`)

Os nomes seguem a convenção semântica do shadcn/ui. Nunca escreva cor solta num componente novo: use o token.

| Token | Uso |
| --- | --- |
| `--background`, `--card`, `--muted` | fundo da página, cartões, áreas neutras |
| `--foreground`, `--muted-foreground` | texto principal e secundário |
| `--border`, `--input` | bordas de cartões e de controles |
| `--primary` (+ `-hover`, `-foreground`, `-soft`) | ação principal, seleção e destaque |
| `--deep`, `--accent` (+ `-soft`) | azul profundo do cabeçalho/hero e ciano elétrico |
| `--success`, `--danger`, `--warning` (+ `-soft`) | feedback de acerto, erro e aviso |
| `--ring` | contorno de foco (âmbar) |
| `--pole-n`, `--pole-s`, `--probe` | cores físicas: polo N vermelho, polo S azul, seta do campo amarela |
| `--radius`, `--radius-sm`, `--shadow-sm`, `--shadow` | forma e elevação |

Pontos de quebra: 860 px (laboratório e grades em uma coluna), 720 px (hero, grades de 2 colunas, rótulos do stepper) e 520 px (rodapé e memória em 2 colunas). Também são respeitados `prefers-reduced-motion` e `forced-colors`.

## Componentes existentes

Reaproveite antes de criar. Todos usam o prefixo `mt-`. O CSS fica em `css/components/` (compartilhados), `css/pages/` (exclusivos de uma página) e `css/views/`; o HTML reutilizável fica em `js/ui/components.js`. Um arquivo novo só precisa entrar em `library.json`, na posição certa da cascata.

- **Estrutura:** `mt-page` com `app.heading()` / `UI.pageHeading()` (kicker + h1 + `mt-lead` + `mt-badge` opcional), `mt-card` (`--tint`), `mt-grid--2`, `mt-callout` (`--soft`), `mt-details`.
- **Ações:** `mt-btn` (`--primary`, `--secondary`, `--ghost`, `--sm`, `--block`), `mt-link` (`--danger`), `mt-icon-btn`, `mt-tab`.
- **Estado e feedback:** `mt-feedback` (`is-success`/`is-error`), `mt-chip` (`--success`), `mt-meter`, `mt-bar`, `mt-ring` (anel de pontuação, variável `--p`), `mt-qprogress`, `mt-step`.
- **Questões:** `mt-choices` > `mt-choice` (`--lettered`, `--tf`; estados `is-correct`/`is-wrong`), `mt-statement`, `mt-review` (lista de revisão do quiz).
- **Específicos:** `mt-token`/`mt-slot` (vocabulário), `mt-mcard` (memória), `mt-lab`/`mt-magnet`/`mt-needle`/`mt-probe` (laboratório), `mt-system` (página 6), `mt-rsec`/`mt-toc` (aba de revisão), `mt-video` (player com carregamento sob demanda), `mt-vdesc` + `mt-timeline` (audiodescrição do vídeo), `mt-a11y-btn` (botões Libras e Aparência no topo), `mt-theme` (menu de temas, `css/components/theme.css`).

Estados usam classes `is-*` (`is-active`, `is-done`, `is-locked`, `is-ready`, `is-priority`). Não use estilo inline, exceto variáveis CSS calculadas, como `--p` e larguras de barras.

## Temas (botão Aparência)

O design de `css/` é o tema **Padrão**. Os outros três (Noturno, Caderno, Sinalização) ficam em `designs/<n>-<id>/tema.css` e são convertidos pelo build em `css/themes/<id>.css`, que só valem com `data-mt-theme="<id>"` na raiz. Ao criar um componente com cor fixa (fora dos tokens), confira os três temas e, se preciso, acrescente a regra em cada `designs/*/tema.css` no formato `:where(.h5p-mt) .mt-...`. Para capturar um tema no harness, clique em `[data-action="toggle-theme-menu"]` e depois em `[data-action="set-theme"][data-theme="<id>"]`.

## Padrões de implementação

1. **Markup por template string.** Cada página é um módulo em `js/pages/` cujo `render(app, section)` reescreve `section.innerHTML` (contrato em `docs/arquitetura.md`). Todo texto dinâmico passa por `escapeHtml()`. Textos do `content.json` com parágrafos passam por `plainMarkup()`.
2. **Eventos por delegação.** Botões levam `data-action="..."`, e o tratador fica em `actions` do módulo da página (ou em `GLOBAL_ACTIONS` de `app.js`). Outros eventos (`change`, `keydown`, arraste) vão em `events`. Não adicione listeners por elemento, porque o `innerHTML` os descarta.
3. **Depois de mudar o estado:** `app.saveState()`, `app.render({ focusSelector })` e `app.announce('...')`, nessa ordem. `saveState()` também recalcula as páginas liberadas.
4. **Exceção do laboratório:** durante o arraste, atualize o SVG no lugar (`updateScene` em `03-magnet-lab.js`, com `app.frame()`). Re-renderizar a página quebra a captura do ponteiro.
5. **Especificidade:** os resets usam `.h5p-mt :where(button, input, select)`, para que as classes de componente vençam. Um seletor de elemento com mais peso já apagou o texto do botão primário. Qualquer componente com `display` próprio perde para `[hidden]`, por isso existe `.h5p-mt [hidden] { display: none !important; }`.

## Acessibilidade (piso obrigatório)

- Foco visível em todo controle (`--ring`). Títulos que recebem foco pelo código (`h1`/`h2` com `tabindex="-1"`) ficam sem contorno.
- Ao trocar de página, o foco vai para o `h1`. Depois de uma resposta, o foco vai para o feedback (`tabindex="-1"`, `role="status"`).
- Toda mudança relevante é anunciada com `app.announce()` (região `aria-live`).
- Nenhum atributo, classe ou texto pode indicar a resposta certa antes de o aluno responder (ver `docs/seguranca.md`). Use os ids opacos do banco como `value`.
- Questões usam `fieldset` + `legend` (pode ser `mt-sr-only`) e inputs nativos. Acerto e erro nunca dependem só de cor: há ícone ✓/✕ e texto.
- Toda interação por arraste tem alternativa: tocar e tocar no vocabulário, botões ↺ ↻ e setas do teclado nos ímãs (`role="slider"` com `aria-valuetext`), associação por listas na memória.
- Alvos de toque de pelo menos 40 px de altura.
- Todo vídeo tem audiodescrição em texto (painel com "Ouvir"), e o botão Libras continua visível no topo. O VLibras posiciona a própria janela; não crie outro elemento fixo que cubra a lateral direita. Detalhes em `docs/acessibilidade.md`.

## Voz e texto

- pt-BR simples, frases curtas, voz ativa. Os botões dizem o que acontece: "Verificar resposta", "Virar de volta", "Ver meus resultados".
- O feedback de erro explica o motivo e dá uma pista; ele não só marca "errado".
- Não revele atalhos pedagógicos. A página 6 libera a próxima sem exigir o vídeo, e nenhum texto pode dizer que o vídeo é opcional.
- Nunca torne o stepper clicável: a navegação é sequencial por decisão pedagógica.

## Verificação visual (obrigatória antes de concluir)

Não há Node no ambiente, e a verificação é feita com o Chrome headless:

1. Monte um HTML temporário (no scratchpad) que carregue, na ordem, todos os CSS e JS listados em `library.json` (gere as tags a partir dele). Instancie `new H5P.MagnetismoTransporte(params, 'developer-preview')`, abra o harness com `?mock=1` e chame `attach()`. Para liberar tudo, clique no botão `[data-action="unlock-all"]` da barra de teste. O controlador não é acessível pelo objeto: dirija o teste pelo DOM (cliques, `change`) e leia o estado com `getCurrentState()`. Para responder certo nos testes, leia o gabarito de `authoring/banco-de-questoes.json` e embuta no harness.
2. Capture: `chrome --headless=new --disable-gpu --allow-file-access-from-files --hide-scrollbars --virtual-time-budget=4000 --window-size=1280,2000 --screenshot=out.png file:///.../harness.html`.
3. Para celular, o Chrome headless não aceita janelas com menos de ~500 px de largura. Coloque o harness num `<iframe style="width:375px">` e capture a página externa.
4. Para checar a lógica, use `--dump-dom`, escreva os resultados num `<pre>` e leia a saída.
5. Veja as imagens com a ferramenta de leitura e procure texto apagado, cortes horizontais, botões escondidos e contraste.

A prévia real é aberta com `scripts/preview.ps1` (http://localhost). `dev/preview.html` lê `library.json` e não abre como `file://`; além disso, o YouTube bloqueia alguns vídeos sem Referer.

Ao mexer só em CSS, compare capturas antes/depois em 1280, 700 e 500 px (acima e abaixo de cada ponto de quebra) com a mesma semente de sorteio (`Crypto.prototype.getRandomValues` fixo no harness) e `--force-prefers-reduced-motion`; `PIL.ImageChops.difference(...).getbbox()` deve dar `None`.

## Desvios conhecidos em relação à skill geral

O design atual usa alguns elementos que a skill `frontend-design` lista como padrões genéricos: rótulos em caixa alta acima dos títulos, subtítulo com "·", setas "→" em botões e cartões com o mesmo raio. Eles foram aprovados na v2. Não os remova por conta própria; proponha a mudança se for redesenhar uma área.
