# Acessibilidade

A equipe pediu que a atividade fosse acessível para todos os públicos: Libras pelo serviço do Governo Federal e uma alternativa aos vídeos (legenda ou audiodescrição em texto). Este documento reúne o que existe, como funciona e o que ainda depende de teste.

## Libras (VLibras)

- Botão **Libras** no topo, ao lado do contador de páginas (no celular, só o ícone, com rótulo para leitor de tela). Ao clicar, o aluno abre o [VLibras](https://www.gov.br/governodigital/pt-br/vlibras), tradutor de português para Libras do Governo Federal, e depois clica em qualquer texto da página para ver o avatar sinalizar.
- **Carregamento sob demanda:** nada é baixado de `vlibras.gov.br` até o aluno clicar. É o único script de fora do pacote (`js/ui/accessibility.js` → `openLibras()`), carregado de `https://vlibras.gov.br/app/vlibras-plugin.js`.
- **Posição da janela:** dentro do H5P, o iframe tem a altura da página inteira, e o VLibras normalmente fica fixo no meio dessa altura, longe do que o aluno está lendo. Por isso:
  - o botão flutuante do próprio VLibras fica escondido (`css/components/accessibility.css`);
  - a janela do avatar abre logo abaixo do botão Libras e passa a acompanhar o texto em que o aluno clica (`placeVlibras()`, que injeta um estilo no *shadow root* do VLibras);
  - se o aluno arrastar a janela, a posição escolhida por ele prevalece.
- **Sem internet ou com o site bloqueado** pela rede da escola, o botão fica tracejado e a atividade avisa: "Não foi possível abrir o VLibras…".
- O professor pode esconder o botão no editor H5P: **Comportamento → Mostrar o botão Libras (VLibras)** (`behaviour.libras`).
- Como as audiodescrições dos vídeos são texto, o VLibras também consegue sinalizá-las. Assim, um aluno surdo tem acesso ao conteúdo dos vídeos em Libras.

## Vídeos

Cada vídeo (páginas 1, 5 e 6) tem:

1. **Legenda em português ligada por padrão** no player do YouTube (`cc_load_policy=1`, `cc_lang_pref=pt`). Os três vídeos só têm legendas **geradas automaticamente** pelo YouTube; a qualidade é a do reconhecimento de voz dele.
2. **Botão "Audiodescrição e resumo do vídeo"**, que abre um painel com um resumo e uma linha do tempo ("1:45 — …") do que acontece no vídeo. O painel:
   - funciona mesmo que o YouTube esteja bloqueado;
   - tem o botão **🔊 Ouvir**, que lê o texto com a voz em pt-BR do próprio navegador (Web Speech API; nada é enviado para fora). A leitura para ao trocar de página;
   - fica aberto quando o aluno carrega o vídeo.

Os textos ficam no editor H5P, em **Vídeos → Audiodescrição do vídeo…** (`media.introVideoDescription`, `media.meissnerVideoDescription` e `media.cobraVideoDescription`). Uma linha em branco separa parágrafos; linhas no formato `1:05 — texto` viram a linha do tempo. Se o campo ficar vazio, o botão não aparece.

### De onde veio o texto

Os resumos foram escritos a partir das **legendas automáticas em português** dos três vídeos, baixadas em 25/09/2026. O que eles descrevem vem do que o narrador fala e mostra; detalhes puramente visuais que a fala não menciona não estão no texto. **A equipe deve assistir aos vídeos e revisar os textos** antes de usar com alunos cegos.

- `101Vm_k920E` (Manual do Mundo, 14 min, página 1): Levitron, um pião de ímã que flutua girando; efeito giroscópio; ajuste de peso e nível (22 min 27 s de tentativas); base multipolar vista com folha de campo; modelo eletrônico com 4 eletroímãs e sensores.
- `MnR7iTjmSPg` (MagLev-Cobra, 2 min 8 s, página 5 a partir de 1:03): primeiro maglev da América Latina, COPPE/UFRJ, 70 km/h, sem rodas, emissão zero, vias elevadas, ímãs permanentes + supercondutores, módulos conectados.

- `wPxQm8mdUi8` (Gerando Respostas, UFABC, 6 min 16 s, página 6 desde a v2.2.1): narração sobre levitação, guiamento e propulsão; EMS em Xangai e EDS no Japão; onde há Maglev em operação; Chuo Shinkansen; vantagens e desvantagens. A audiodescrição cobre só a narração: as imagens de trens que a acompanham não foram descritas quadro a quadro.

Até a v2.2, a página 6 repetia o vídeo do Levitron; o texto de apoio foi reescrito junto com a troca do vídeo.

### Por que não há legenda própria sincronizada

Uma legenda própria sobre o player exigiria transcrever os 14 minutos do vídeo com tempo exato e revisar o texto. A legenda automática tem muitos erros (por exemplo, "leve tom" em vez de "Levitron"). Se a equipe fizer essa revisão, dá para exibir um arquivo `.vtt` sincronizado pela API de mensagens do player do YouTube. Por enquanto, a legenda do YouTube e a audiodescrição em texto cobrem a necessidade.

## O que já existia

- Navegação por teclado em tudo, foco visível, foco levado ao título a cada página e ao retorno de cada resposta.
- Avisos por região `aria-live`; acerto e erro com ícone e texto, nunca só com cor.
- Alternativas a toda interação de arraste: tocar e tocar no vocabulário, botões ↺ ↻ e setas nos ímãs (`role="slider"` com descrição falada da posição) e associação por listas no jogo da memória.
- Layout de 320 px a desktop, `prefers-reduced-motion` e `forced-colors` (alto contraste do Windows).
- **Botão Aparência** (v2.2.1): o aluno escolhe entre o visual Padrão e três temas (ver `designs/README.md`). **Sinalização** é o de maior contraste (texto 16:1), indicado para baixa visão e projetor fraco; **Noturno** é escuro, para sala escura. O menu é um grupo de botões com `aria-pressed`, abre com foco na opção atual, fecha com Esc ou clique fora e anuncia a troca. O tema é aplicado sem recarregar a página, então o foco e o progresso não mudam.
- **Pular par** no jogo da memória (v2.2.1): quem não consegue virar as cartas nem usar as listas pode seguir adiante. O par pulado aparece com borda tracejada (não verde) e o rótulo "Par pulado" para leitor de tela.
- **Pular com contador** (v2.2.1): no vocabulário e no laboratório, o Pular fica desativado até 3 tentativas erradas. Um texto visível ao lado, "Pular libera após 3 tentativas (n/3)", é ligado ao botão por `aria-describedby`, porque botões desativados não recebem foco. Quem não consegue arrastar tem a alternativa de tocar e tocar, que também conta as tentativas. O quiz e o V ou F não têm Pular.

## Pendências

- Testar o VLibras dentro do Lumi (Desktop e Cloud) e na rede da escola. Os testes foram feitos no Chrome, dentro de um iframe alto que simula o H5P; lá o VLibras carrega e a janela abre no lugar certo, mas a sinalização do avatar não foi verificada visualmente.
- Revisar as audiodescrições assistindo aos vídeos.
- O quadro "Repare" da página 1 ainda fala em "exclusão de campo e aprisionamento de fluxo", termos da v1 que não aparecem no vídeo de abertura.

## Idioma (pt-BR / en-US)

- O botão PT-BR / EN-US fica no topo (`role="group"`, cada botão com `aria-pressed` e `lang` próprio). A raiz recebe `lang` do idioma atual, e o foco volta ao botão depois da troca.
- Em inglês, o botão Libras some: o VLibras traduz texto em português.
- Em inglês, a leitura em voz alta usa voz en-US, e o YouTube recebe `hl=en` e `cc_lang_pref=en`. Os vídeos continuam narrados em português; a legenda em inglês depende da tradução automática do YouTube. A audiodescrição em inglês (`js/data/params-en.js`) avisa que o vídeo é em português.
