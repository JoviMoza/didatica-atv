# Relatório de produção — Missão MagLev: O Trem que Flutua

**Data:** 24 de setembro de 2026  
**Entrega principal:** `dist/missao-maglev.h5p`  
**Tipo de conteúdo:** `H5P.MissaoMagLev 1.0.0`  
**SHA-256 do pacote:** `9b347b45fdfcc1e31b4c52664d9987982bc67dc3211bdc86576a41671d24e719`  
**Tamanho:** aproximadamente 0,85 MiB

---

## 1. Objetivo

Construir e exportar um objeto de aprendizagem H5P completo, responsivo e acessível sobre levitação supercondutora, reunindo:

1. abertura com vídeo;
2. recuperação ativa de vocabulário;
3. exploração da interação entre ímãs;
4. quiz de escolha única;
5. jogo da memória ligado ao MagLev-Cobra;
6. vídeo do Efeito Meissner com texto de apoio;
7. cinco questões de Verdadeiro ou Falso;
8. painel consolidado de resultados e revisão conceitual.

A implementação também precisaria persistir o progresso, gerar eventos xAPI, funcionar sem bibliotecas externas, permitir teste local e produzir um `.h5p` reproduzível.

## 2. Entradas utilizadas

### Vídeos

- Página 1/6: `https://www.youtube.com/watch?v=101Vm_k920E&t=2s`
- MagLev-Cobra/UFRJ, Página 5: `https://www.youtube.com/watch?v=MnR7iTjmSPg&t=63s`

A URL específica da Página 6 foi validada no empacotador. O player interno usa `youtube-nocookie.com`, inicia no segundo configurado e só cria o `iframe` após a ação **Carregar vídeo**.

### Conteúdo científico

Foram usados e refinados os seguintes conceitos:

- supercondutividade e resistência elétrica aproximadamente nula;
- Efeito Meissner;
- nitrogênio liquefeito como refrigerante;
- YBCO como supercondutor cerâmico de alta temperatura do Tipo II;
- vorticês e *flux pinning*;
- diamagnetismo perfeito;
- levitação sem contato mecânico;
- estabilização da posição pela estrutura do protótipo;
- caráter brasileiro do desenvolvimento MagLev-Cobra na COPPE/UFRJ.

O texto da Página 6 foi qualificado para explicar que a nuvem branca é névoa formada por condensação de água do ar, e não nitrogênio gasoso visível.

## 3. Decisão de arquitetura

Um único arquivo `.h5p` não pode conter oito atividades H5P independentes como objetos de primeiro nível. O formato possui um `mainLibrary` e um `content/content.json` principal.

Por isso, a solução adotada foi:

- um content type próprio, `H5P.MissaoMagLev`;
- uma biblioteca runnable com JavaScript e CSS;
- oito páginas controladas por uma aplicação interna;
- quatro atividades emitindo e recebendo xAPI no formato ADL;
- um painel final que também escuta atividades externas.

Essa arquitetura preserva o fluxo de oito páginas em um único upload e permite que o painel use `postMessage`/`H5P.externalDispatcher`.

## 4. Estrutura entregue

```text
h5p-src/
├── h5p.json
├── LICENSE
├── content/
│   ├── content.json
│   ├── CREDITS.txt
│   └── images/
│       ├── liquid-nitrogen.png
│       ├── maglev-cobra.jpg
│       ├── magnet.jpg
│       ├── solar-panel.svg
│       ├── sustainability.svg
│       └── ybco.jpg
└── H5P.MissaoMagLev/
    ├── library.json
    ├── semantics.json
    ├── icon.svg
    ├── js/
    │   ├── storage.js
    │   ├── xapi.js
    │   └── maglev.js
    ├── css/maglev.css
    └── language/pt-br.json
```

O pacote final mantém `h5p.json` e `content/` na raiz, como exige o padrão H5P, e inclui a pasta de biblioteca `H5P.MissaoMagLev/`.

## 5. Implementação por página

### Página 1 — Abertura

- título, pergunta disparadora e objetivos;
- vídeo com carregamento por ação;
- ponte para o vocabulário;
- layout em duas colunas que se reorganiza em telas pequenas.

### Página 2 — Drag the Words

- cinco lacunas: supercondutividade, Meissner, nitrogênio líquido, *flux pinning* e diamagnetismo;
- distratores: hélio e atrito;
- 5 pontos;
- drag-and-drop opcional;
- alternativa acessível “selecionar palavra e depois espaço”;
- retorno automático de palavra errada;
- feedback por conceito;
- persistência das posições.

### Página 3 — Simulação dos ímãs

- estado inicial com três ímãs alinhados e um deitado;
- estado final com os quatro alinhados;
- SVGs com `title`, `desc` e explicação textual;
- duas perguntas exploratórias, sem pontuação;
- distinção explícita entre ímãs comuns e supercondutores;
- explicação de que o resultado vetorial no centro pode diminuir, mas as linhas de campo não se “cancelam” literalmente.

### Página 4 — Single Choice Set

- quatro questões, uma por vez;
- 1 ponto por questão, total de 4;
- feedback após cada submissão;
- gabarito estável por identificadores;
- revisão final das quatro questões;
- prática adicional sem alterar a primeira nota.

### Página 5 — Memory Game e UFRJ

- vídeo `01. Maglev Cobra` carregado a partir de 1:03;
- seis pares, doze cartas;
- 1 ponto pela conclusão dos seis pares;
- sem penalidade por tempo;
- pares que permanecem divergentes até ação explícita de ocultá-los;
- alternativa **Associar sem cartas**, com seis listas e seis `<select>`;
- imagens locais e atribuições;
- nota editorial impede que painel solar e emissão zero sejam apresentados como recursos já instalados no protótipo.

### Página 6 — Efeito Meissner

- vídeo solicitado com início em 2 segundos;
- link externo para o YouTube;
- texto de apoio acessível;
- explicação da névoa branca, transição supercondutora, Efeito Meissner e *flux pinning*.

### Página 7 — Verdadeiro ou Falso

- cinco itens;
- 1 ponto por acerto, total de 5;
- correção e justificativa depois de cada submissão;
- síntese final das cinco questões.

### Página 8 — Resultados e Resumo

- total sobre 15 pontos;
- percentual somente após as quatro atividades;
- barra por atividade;
- situação de conclusão e timestamp;
- mapa de conceitos;
- prioridade de revisão para os conceitos com mais erros;
- botões para revisar cada página;
- botão de teste/mock;
- nota sobre primeira tentativa e ausência de pontos por velocidade no jogo da memória.

## 6. Sistema de pontuação

| Atividade | Máximo |
|---|---:|
| Drag the Words | 5 |
| Single Choice Set | 4 |
| Memory Game | 1 |
| Verdadeiro ou Falso | 5 |
| **Total** | **15** |

A primeira conclusão de cada atividade é preservada. Repetições podem ser usadas para prática, mas não aumentam a pontuação exibida.

## 7. xAPI

A captura está implementada em `H5P.MissaoMagLev/js/xapi.js` e `H5P.MissaoMagLev/js/maglev.js`.

### Emissão interna

Cada conclusão usa:

- `H5P.XAPIEvent`;
- verbo `http://adlnet.gov/expapi/verbs/completed`;
- `result.score.raw`, `min`, `max` e `scaled`;
- `result.completion`, `result.success` e duração;
- `object.definition.name` em `pt-BR`;
- extensões H5P e identificadores de atividade;
- `this.trigger(event)`, encaminhando o evento ao Core e ao `H5P.externalDispatcher`.

### Recepção externa

O painel aceita:

1. `H5P.externalDispatcher.on('xAPI', ...)`;
2. eventos recebidos por `window.addEventListener('message', ...)`.

São reconhecidos formatos como:

- evento H5P nativo (`event.data.statement`);
- `event.data.json.statement`;
- `event.data.data.statement`;
- payload ADL direto.

A extração de pontuação cobre `raw`, `min`, `max` e `scaled`. Títulos e extensões são usados para mapear as quatro atividades.

### Modo de teste

A Página 8 pode simular quatro conclusões:

- Drag the Words: 4/5;
- Single Choice Set: 3/4;
- Memory Game: 1/1;
- Verdadeiro ou Falso: 4/5.

Resultado esperado: **12/15, 80%**.

## 8. Persistência

`H5P.MissaoMagLev/js/storage.js` implementa:

- chave por instância: `h5p.missao-maglev:v1:cid-<contentId>`;
- schema versionado;
- validação de tipos e limites;
- proteção contra chaves de prototype pollution;
- restauração da página atual, respostas, pares, vídeos abertos e resultados;
- `try/catch` para quota, modo privado e bloqueio de storage;
- aviso não bloqueante quando o navegador não consegue salvar.

O estado continua em memória se o armazenamento local estiver indisponível.

## 9. Acessibilidade e responsividade

Implementado:

- `lang="pt-BR"`;
- headings e landmarks semânticos;
- `fieldset`, `legend`, radio buttons, labels e buttons nativos;
- link “Ir para o conteúdo principal”;
- foco visível;
- `aria-current="step"`;
- regiões `aria-live`;
- feedback não dependente apenas de cor;
- alternativa ao drag-and-drop;
- alternativa ao Memory Game;
- textos alternativos descritivos;
- diagramas SVG com descrição longa;
- layout para celular;
- alvos de toque de pelo menos 44 px;
- `prefers-reduced-motion`;
- `forced-colors`;
- layout de impressão.

## 10. Imagens e licenças

Foram incluídas quatro imagens fotográficas com licença identificada e duas ilustrações SVG autorais:

- `MaglevCobra.jpg` — CC BY 3.0 BR;
- `YBCO-modified.jpg` — CC BY-SA 3.0;
- `Magnet 4.jpg` — CC BY-SA 3.0;
- `Cooling superconductor by liquid nitrogen.png` — CC BY 4.0;
- painel solar e sustentabilidade — SVGs autorais, MIT.

Os detalhes estão em `h5p-src/content/CREDITS.txt` e também são exibidos na Página 5.

## 11. Processo de construção

Foi criado um empacotador em PowerShell:

```powershell
.\scripts\build-h5p.ps1
```

Ele:

1. confere arquivos obrigatórios;
2. analisa todos os JSON;
3. cria o ZIP manualmente para garantir barras `/`;
4. exclui artefatos de desenvolvimento;
5. move a extensão temporária para `.h5p`;
6. calcula SHA-256;
7. grava o checksum em `dist/missao-maglev.h5p.sha256`.

Um segundo script valida o resultado:

```powershell
.\scripts\validate-h5p.ps1
```

A primeira tentativa de build revelou que `ZipFile.CreateFromDirectory` do .NET Framework gravou barras invertidas no Windows. O empacotador foi corrigido para criar cada entrada com `ZipFileExtensions.CreateEntryFromFile` e caminho portátil. O pacote final passou na validação.

## 12. Testes realizados

- abertura e navegação entre as oito páginas;
- método acessível do Drag the Words;
- conclusão do Drag the Words e emissão de 5/5;
- quatro questões do Single Choice Set e emissão de 4/4;
- Verdadeiro ou Falso e emissão de 5/5;
- Memory Game por listas e emissão de 1/1;
- alteração entre os dois diagrams da Página 3;
- vídeo da Página 6 com `start=2`;
- vídeo UFRJ com `start=63`;
- carregamento dos players somente após ação;
- restauração de resultados depois de recarregar;
- recepção de xAPI externo por `MessageEvent`;
- mock com quatro eventos e resultado 12/15;
- console do navegador sem erros nas interações testadas;
- validação estrutural do `.h5p`;
- conferência das duas URLs no empacotador.

## 13. Resultado da validação

```text
VALIDADO: dist/missao-maglev.h5p
Tamanho: 0.85 MiB
Machine name: H5P.MissaoMagLev 1.0.0
URLs da Página 6 e do vídeo UFRJ: OK
Metadados, referências JS/CSS e conteúdo: OK
```

O arquivo `dist/missao-maglev.h5p.sha256` contém o hash correspondente.

## 14. Observação sobre o Lumi Cloud

O pacote é um content type H5P personalizado. A política atual do Lumi Cloud impede que usuários comuns instalem bibliotecas novas. Assim:

- se a conta estiver autorizada e a biblioteca `H5P.MissaoMagLev 1.0` estiver instalada/revisada pelo operador, o `.h5p` pode ser enviado pelo botão de upload;
- sem essa instalação, o Lumi pode rejeitar o pacote por biblioteca ausente;
- para validação local, o Lumi Desktop permite instalar a biblioteca fornecida.

Esta limitação é da política da plataforma, não da estrutura do arquivo H5P.

## 15. Arquivos de apoio

- `README.md`: instruções resumidas;
- `dev/preview.html`: prévia local;
- `scripts/build-h5p.ps1`: geração do pacote;
- `scripts/validate-h5p.ps1`: validação;
- `dist/missao-maglev.h5p`: entrega H5P;
- `dist/missao-maglev.h5p.sha256`: checksum;
- `dist/RELATORIO_MISSAO_MAGLEV.md`: este relatório.
