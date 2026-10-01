# Questão dissertativa — relatório de viabilidade

Analisa a pasta `Melhorias futuras/MagnetismoTransporte_documentacao_completa/` (21
arquivos) contra o código real do pacote H5P e do portal, e registra o que
bloqueia a implementação.

Data da análise: 01/10/2026 · código em `2.3.0` (`SCHEMA_VERSION` 5).

## Resumo

A ideia é viável, e o avaliador determinístico cabe no modelo atual sem
dependência nova. Mas a documentação é um *brief de design*, não um plano
executável: ela choca com quatro invariantes do código real e omite cinco
acoplamentos que só aparecem como bug em tempo de execução.

| | Item | Gravidade |
|---|---|---|
| 1 | Ordem das páginas contraditória | bloqueia |
| 2 | Nota descartada em silêncio | bloqueia |
| 3 | Rubrica em texto puro passa no validador | bloqueia |
| 4 | Não há runner de teste | bloqueia |
| 5 | Acoplamentos não documentados | custo extra |
| 6 | Fórmula da V1 indefinida e com teto 4,5/5 | defeito do plano |

## 1. A ordem das páginas é autocontraditória

`CONTEXTO_MINIMO.md:3`, `00-contexto.md:13` e `07-h5p-lumi.md:46` colocam a
dissertativa na `page: 9`. Ao mesmo tempo `07-h5p-lumi.md:73` exige que
`08-results.js` mostre o resultado dela.

No código real, `08-results.js` **é** a página 8 e é a última por construção
(`app.js:558` esconde o botão Próxima em `page === PAGE_COUNT`; `app.js:611`
libera a revisão em `unlockedPage >= PAGE_COUNT`). E `app.js:29-32` lança
exceção no carregamento se os ids não forem `1..N` sem buraco:

```js
const PAGES = (ns.pages || []).slice().sort((a, b) => a.id - b.id);
if (!PAGES.length || PAGES.some((page, index) => page.id !== index + 1)) {
  throw new Error('Magnetismo e Transporte: páginas ausentes ou fora de ordem (esperado 1..N em js/pages/).');
}
```

**Decisão tomada:** a dissertativa entra como página **8** e a de resultados
passa a **9** (`08-results.js` → `09-results.js`, id e `library.json`
atualizados). Assim o resultado continua sendo a última página e a dissertativa
é avaliada antes dela. Nenhum documento da pasta envisiona essa renomeação.

## 2. A nota é descartada em silêncio (o bloqueador mais sério)

Dois filtros independentes, e o pior deles vem **antes** do 400:

1. `storage.js:263` reconstrói `graded` por lista branca:
   ```js
   const allowed = new Set(['dragWords', 'singleChoice', 'memory', 'trueFalse']);
   ```
   Um `graded.essay` fora da lista é apagado a cada `hydrate()` — a nota some no
   reload sem aviso.
2. `app.py:358` filtra no cliente **antes** de enviar:
   ```js
   var ATIVS = ['dragWords','singleChoice','memory','trueFalse'];
   var itens = ATIVS.filter(function (a) { return graded[a] && ... });
   ```
   Um id novo nunca entra no corpo do POST, então o `400 "Atividade
   desconhecida."` de `app.py:462` **nunca dispara**. O aluno vê "Enviado: 4 de
   4" e a nota não é gravada — sem erro em lugar nenhum.

Isso é pior do que o AGENTS.md descrevia ("continua aceitando e reporta
zero"): aqui o item desaparece do pedido.

**Correções aplicadas na implementação:** `essay` adicionado a `allowed`, a
`ATIVIDADES`, à lista `ATIVS` do JS embutido, e os literais `{feito}/4` e
`colspan='8'` de `app.py:557` e `:594` passam a derivar do tamanho real.

## 3. A rubrica em texto puro passa no validador

O próprio `AGENTS.md` da pasta futura admite que a rubrica não pode ser segredo no
cliente offline (`AGENTS.md:38`, `04-seguranca.md:49`). O projeto, porém, lacra
o gabarito por criptografia.

Ponto cego no validador: a checagem de campos de gabarito vale só para o
`bank.js` (`validate-h5p.ps1:145,149`):

```powershell
$bankName = "$libDir/js/data/bank.js"
if ((Read-ZipText $bankName) -match '\b(correct|answer|explanation|feedback|success)\s*:') { ... }
```

Um `js/data/rubrica.js` com `keywords`, `referenceAnswers` e `contradictions`
**não casa** com esse regex (`\banswer` exige fronteira de palavra, e
`referenceAnswers` não tem uma antes de `answer`). O build passaria verde com a
rubrica em claro no pacote. O check de vazamento cruzado (`:152-170`) só pega
texto *verbatim* de `explanation`/`feedback`/`success` já existentes.

**Decisão tomada:** a rubrica entra em `authoring/` (fora do pacote) e é gerada
para dentro do `bank.js` pelo mesmo caminho lacrado já existente
(`gerar-banco.ps1`), acrescentando escopo `essay` ao selo. Assim
`answer-key.js`, `cyrb`/`keystream` e a lógica de `open()` continuam sendo os
únicos lugares que conhecem o gabarito. Nada de rubrica em texto puro no
pacote, e o validador existente passa a varrer o `.es.json` também.

## 4. Não há runner de teste

A V1 exige testes unitários de normalização, matching, conceitos, relações,
contradições e score (`09-testes.md:3-13`), e `17-prompt-implementacao.md:74`
lista "testes" como entregável. Não existe: o pacote H5P não tem
`package.json`, bundler nem runner, e é deliberadamente "no npm". O `package.json`
da raiz só tem `pptxgenjs`, para os artefatos de apresentação.

**Decisão tomada:** o avaliador é testado com um harness de página em branco
servido por http + Chrome headless (mesma convenção já usada para o resto do
projeto), lendo os resultados por CDP. Sem dependência nova, sem `npm`.

## 5. Acoplamentos que nenhum documento menciona

| Onde | O que está fixo | Sintoma se ignorado |
|---|---|---|
| `css/components/stepper.css:4` | `grid-template-columns: repeat(8, …)` | nona página cai fora da grade, em qualquer viewport |
| `app.py:557` | `{feito}/4` | painel do professor fica sempre em "Concluiu 4" |
| `app.py:594` | `colspan='8'` | linha de estado vazio desalinhada |
| `activities.js:12-42` | 6 campos por atividade, dois com i18n | `07-h5p-lumi.md:43-49` propõe só 4; sem `description` o `08-results.js` escreve `undefined`, sem `interactionType` o xAPI fica malformado |
| `app.js:932-941` | `runMock()` com 4 `completeActivity` literais e "12 de N pontos" | total do mock fica errado |
| `content.js:19+` | registro `CONCEPTS` com 11 ids fixos | ids de conceito da rubrica não existem; `08-results.js:85` faz `CONCEPTS[id].review` sem guarda e quebra |
| `util.js:141-143` | `sanitizeAnswerMap` limita `choice` a 120 e `feedback` a 1000 | texto da dissertativa é cortado |

Também: `js/data/bank.js` é gerado, `params-es.js` segue a convenção
`params-<lang>.js`, e a rubrica precisa das três línguas (`L(pt,en,es)` e os
campos `…Es`), como todo o resto.

## 6. A fórmula da V1 nunca foi escrita, e a proposta não fecha em 1,0

`06-avaliacao.md:92-97` propõe:

```
0.40 × conceptScore + 0.30 × semanticScore + 0.20 × relationScore − 0.10 × contradictionPenalty
```

Dois problemas:

- `0.40 + 0.30 + 0.20 = 0.90` — o máximo é **0,90**, ou seja 4,5/5 com
  `max: 5`. `05-rubrica-conceitual.md:106` e `06-avaliacao.md:143` prometem que a
  nota máxima é atingível. E o termo de penalidade pode levar o resultado abaixo
  de zero. O código real já trava em `Math.max(0, …)` (`app.js:872`), o que
  esconderia o defeito em vez de revelá-lo.
- `semanticScore` só existe na **V2** (`06-avaliacao.md:79-83`). A fórmula da V1
  não está escrita em documento nenhum.

**Decisão tomada:** na V1 a composição é só conceito e relação, renormalizada
para 0–1 antes de virar nota, e a penalidade é um multiplicador (não um termo
subtrativo), de modo que o teto é exatamente 1,0 e o piso é 0.

## O que ficou fora, e por quê

- **`POST /api/avaliar-dissertativa` (V2+).** O portal não tem prefixo `/api`
  em rota nenhuma, e cada rota existente é protegida por cookie de link
  secreto (`token_perfil`, `X-Token` em `app.py:456`). Uma rota de avaliação sem
  autorização seria uma decisão que os documentos nunca tomam. Fica para quando
  a V1 estiver medida.
- **Embeddings, NLI, LLM (V2-V5).** O próprio `12-roadmap.md:29` põe isso
  depois de um benchmark humano com 12–100 respostas anotadas
  (`08-benchmark.md:9-22`), idealmente por duas pessoas (`:45`). É trabalho
  humano sem dono nem ferramenta definidos hoje.
- **As skills listadas em `14-skills.md:15-40`:** seis das sete não existem, e
  `.opencode/skills/` só existe dentro da própria pasta de documentação.

## Ordem de implementação adotada

1. `authoring/rubrica-dissertativa.json` (fora do pacote, com as três línguas).
2. `gerar-banco.ps1` gera o bloco `essay` lacrado; `js/core/answer-key.js` e
   `js/core/essay.js` abrem e avaliam.
3. Estado em `createDefaultState()` **e** `hydrate()` (mais `allowed`), com
   `PAGE_COUNT` 8 → 9.
4. Página `08-dissertativa.js`; `08-results.js` renomeado para `09-results.js`.
5. Espelhamento no portal: `ATIVIDADES`, `ATIVS` e os literais de contagem.
6. `stepper.css`, `activities.js` (com `description` e `interactionType`),
   `library.json`, `xapi.js`.
7. Build, `validate-h5p.ps1` e verificação headless.

## O que continua manual

- **Não há automação de teste.** A verificação é um harness headless executado
  à mão; não roda em CI porque o repositório não tem.
- **Os pesos da rubrica são parâmetros de autoria**, não constantes
  (`05-rubrica-conceitual.md:110-112`). Começam com um valor plausível e
  precisam de benchmark humano antes de virarem verdade.
- **A avaliação continua probabilística.** Cobertura conceitual por palavra e
  expressão não prova domínio: um aluno que escrever as palavras certas na frase
  errada pontua alto. Por isso a rubrica trata relações e contradições
  explicitamente, e o feedback diz ao aluno *o que* foi reconhecido.