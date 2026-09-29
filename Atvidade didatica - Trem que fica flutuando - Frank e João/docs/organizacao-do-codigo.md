# Organização do código

```text
authoring/banco-de-questoes.json  gabarito em texto puro (FORA do pacote)
h5p-src/                          tudo o que vai para o .h5p
  h5p.json                        metadados do conteúdo e dependência da biblioteca
  content/content.json            campos editáveis no editor H5P (textos, vídeos, comportamento)
  content/images/                 imagens do jogo da memória (créditos em CREDITS.txt)
  H5P.MagnetismoTransporte/
    library.json                  versão e ORDEM de carregamento de todo JS e CSS
    semantics.json                formulário do editor H5P
    js/core/                      util, storage, activities, xapi, answer-key, quiz
    js/data/content.js            conteúdo sem segredo (conceitos, revisão, links, cartas)
    js/data/bank.js               GERADO: questões com respostas lacradas
    js/lab/physics.js             física do laboratório
    js/ui/components.js           HTML reutilizável
    js/views/review.js            aba "Revisão estendida"
    js/pages/01-intro.js … 08-results.js   uma página por arquivo
    js/app.js                     controlador + classe H5P (carregado por último)
    css/base.css, css/layout.css  tokens, reset, grade e cards
    css/components/               header, stepper, botões, vídeo, escolhas, resumo…
    css/pages/                    estilos exclusivos de cada página
    css/views/review.css          aba de revisão
dev/                              prévia local (fora do pacote); lê a lista de library.json
scripts/                          build, validação, gerador do banco e servidor de prévia
dist/                             pacotes gerados (dist/v1/ guarda a versão 1)
.claude/skills/                   skills de design para o Claude Code
docs/                             esta documentação
```

## Onde mexer para cada mudança

| Quero… | Arquivo(s) | Cuidados |
| --- | --- | --- |
| Adicionar ou editar uma questão | `authoring/banco-de-questoes.json` (`singleChoice` ou `trueFalse`), depois `build-h5p.ps1` | `id` único em minúsculas com hífen; `concept` existente em `CONCEPTS`; `correct` é o índice da alternativa certa. **Nunca** edite `js/data/bank.js` à mão |
| Mudar quantas questões cada aluno recebe | `js/core/activities.js` (`max` de `singleChoice`/`trueFalse`) | O sorteio e a nota máxima seguem o `max`; confira os textos "Vale N pontos" nas páginas 4 e 7 |
| Trocar o texto do vocabulário | `authoring/banco-de-questoes.json` (`dragWords`) | `sentence` tem um item a mais que `terms`; `terms` vem na ordem das lacunas |
| Mudar as perguntas do laboratório | `authoring/banco-de-questoes.json` (`lab`) | O texto da etapa fica em `js/pages/03-magnet-lab.js` |
| Adicionar um tema na revisão | `js/data/content.js` (`REVIEW_SECTIONS`, `CONCEPTS`, `LINKS`) | Cada conceito aponta para uma seção por `review`; `links` usa chaves de `LINKS` |
| Mudar as cartas da memória | `js/data/content.js` (`MEMORY_PAIRS`) + `content/images/` + `CREDITS.txt` | Sempre 6 pares |
| Mudar o texto ou o layout de uma página | `js/pages/0N-*.js` + `css/pages/*.css` | Use `app.heading()` e os componentes de `ui/components.js` |
| Trocar vídeo, texto de abertura ou texto da página 6 | `content/content.json` + `semantics.json` (padrão) + `dev/preview.js` | `validate-h5p.ps1` confere as URLs da página 6 e do MagLev-Cobra |
| Editar a audiodescrição de um vídeo | `content/content.json` (`media.*VideoDescription`) + padrão em `semantics.json` + `dev/preview.js` | Formato: parágrafos separados por linha em branco; linhas `m:ss — texto` viram linha do tempo. Escreva só o que o vídeo mostra ou diz |
| Esconder o botão Libras | editor H5P: `behaviour.libras` | O VLibras só carrega no clique |
| Criar um campo novo no estado | `js/core/storage.js` (`createDefaultState` **e** `hydrate`) | Avalie se é preciso subir o `SCHEMA_VERSION` |
| Mudar uma regra de liberação de página | `task` / `canLeave` no módulo da página; regra geral em `app.js` (`canLeavePage`) | Nunca bloqueie de novo uma página já liberada |
| Criar uma página nova | novo `js/pages/0N-*.js` no contrato de [arquitetura.md](arquitetura.md) + `library.json` | Os ids precisam ir de 1 a N sem buracos |
| Criar um componente visual | `ui/components.js` + `css/components/*.css` + skill `h5p-frontend` | Use tokens e o prefixo `mt-`; confira em 1280 px e 375 px |
| Adicionar um arquivo JS ou CSS | só `library.json` | A ordem importa; o build e a prévia leem essa lista |
| Mudar um texto da interface | o próprio arquivo, na chamada `L('português', 'English')` | Os dois idiomas ficam lado a lado; `L` vem de `js/core/i18n.js` |
| Traduzir uma questão | `authoring/banco-de-questoes.en.json` (mesmos ids; alternativas na mesma ordem do original), depois `build-h5p.ps1` | Item sem tradução aparece em português no modo English |
| Traduzir os textos do editor (abertura, página 6, audiodescrições) | `js/data/params-en.js` | O editor H5P só edita o português: atualize a tradução junto |
| Editar um tema visual (botão Aparência) | `designs/<n>-<id>/tema.css`, depois `build-h5p.ps1` | `css/themes/<id>.css` é gerado por `gerar-temas.ps1`: não edite à mão. "Padrão" é o CSS normal de `css/` |
| Criar um tema visual | `designs/<n>-<id>/tema.css` + `THEMES` em `js/ui/themes.js` + `css/themes/<id>.css` no fim de `preloadedCss` | Ver `designs/README.md` |
| Mudar o botão Aparência | `js/ui/themes.js` (lista, menu) + `css/components/theme.css` + `setTheme`/`toggleThemeMenu` em `js/app.js` | O professor esconde o botão com `behaviour.themes` |
| Mudar o pulo do jogo da memória | `js/pages/05-memory.js` (`skipPair`, `finishIfSettled`) | Par pulado = uma tentativa sem acerto nos dois modos (cartas e listas). Sempre disponível (página com vídeo) |
| Mudar quantas tentativas liberam o Pular | `SKIP_AFTER_TRIES` em `js/core/activities.js` | Vale para o vocabulário (`skipControl` em `02-vocabulary.js`) e o laboratório (`skipControl` em `03-magnet-lab.js`). O botão e o contador vêm de `UI.skipButton()` (`js/ui/components.js`) |
| Publicar uma nova versão | `library.json` (versão), `h5p.json` (dependência + `changes`), `js/core/xapi.js` (`LIBRARY`), `validate-h5p.ps1`, `dev/preview.js` | Depois, rode o build e a validação |

## Convenções

- Interface em pt-BR; comentários de código em inglês.
- Classes CSS com prefixo `mt-` e estados `is-*`; ids de DOM com prefixo `h5p-mt-`.
- Texto dinâmico sempre passa por `escapeHtml()`.
- Nada no HTML pode indicar a resposta certa antes de o aluno responder (ver [seguranca.md](seguranca.md)).
- Arquivos em UTF-8 com quebra de linha LF. Os scripts PowerShell têm BOM, para o PowerShell 5.1 ler os acentos.
