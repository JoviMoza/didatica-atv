# Proteção contra cola

Este documento cobre o que a v2.2 faz para o aluno não conseguir pegar respostas nem inflar a nota, e o que um conteúdo H5P **não consegue** impedir.

## O limite de um H5P

A atividade roda inteira no navegador do aluno, sem servidor próprio. Para corrigir uma resposta, o navegador precisa ter o gabarito de alguma forma. Por isso, **nenhuma proteção no navegador é à prova de quem domina JavaScript e DevTools**. O objetivo é outro: impedir a cola fácil, feita com "Exibir código-fonte", Ctrl+F, "Inspecionar elemento", `localStorage` ou uma linha no console. Proteção total exigiria correção num servidor, o que o H5P no Lumi não oferece.

A nota que vale para o professor é a do LMS, que recebe o evento xAPI da **primeira** conclusão de cada atividade.

## Brechas encontradas na v2.1 e o que mudou

| Brecha (v2.1) | Como colar | Correção (v2.2) |
| --- | --- | --- |
| Gabarito legível em `js/content.js` | Abrir o arquivo: a alternativa certa era sempre a primeira; V ou F tinha `answer: true/false`; as explicações começavam com "Verdadeiro."/"Falso." | O gabarito saiu do pacote. Ele fica em `authoring/banco-de-questoes.json`, e o build gera `js/data/bank.js` com as explicações cifradas (abaixo) |
| Resposta no HTML | `value="o0"` era sempre a alternativa correta | Ids opacos por alternativa (`o4ae0cbfe`…), nenhum atributo indica a certa |
| Vocabulário | A ordem de `DRAG_TERMS` era a ordem das lacunas | Cada lacuna é um lacre; os termos vêm em ordem alfabética |
| Laboratório | `correct: 'asymmetric'` no código | Perguntas também lacradas |
| Memória | `data-card-id` no HTML e baralho salvo como números (cartas 2i e 2i+1 formam o par i) | O HTML só tem a posição na mesa; o baralho é salvo como tokens opacos por aluno |
| Nota forjada por `postMessage` | Uma linha no console mandava um statement "completed" 5/5 e a atividade o registrava | A atividade não escuta mais resultados externos |
| `localStorage` editável | Trocar a nota ou `unlockedPage: 8` e recarregar | Registro assinado: editado à mão, é descartado |
| Estado na instância | `H5P.instances[0].state`, `completeGradedActivity(...)` | O controlador fica numa closure; a instância só expõe a API H5P |
| Nota a partir do campo `correct` salvo | Alterar `correct: '1'` na memória | A nota é recalculada abrindo o lacre com a resposta escolhida |
| `?mock=1` na URL | Desbloquear páginas e simular notas | Só vale na prévia local (`contentId = developer-preview`) ou se o professor ativar `showMockButton` no editor |

## Como funciona o lacre

Para cada questão, `scripts/gerar-banco.ps1` cifra a explicação com uma chave derivada da resposta **certa**: `salt | escopo | id da questão | resposta`. No navegador, `AnswerKey.open(seal, [...partes, escolha])`:

- com a escolha certa, a chave confere, o texto decifrado começa com `ok|` e a explicação aparece;
- com a escolha errada, sai lixo, e a função devolve `null`.

Não existe um campo "correta" para procurar. Depois que o aluno responde, `reveal()` testa as alternativas para destacar a certa e mostrar a explicação. Os lacres são completados até um tamanho fixo, para o comprimento não denunciar a resposta (por exemplo, qual termo vai em qual lacuna).

O hash (`cyrb53`) e o gerador (`mulberry32`) têm duas implementações que precisam ser idênticas: `js/core/util.js` e o trecho C# de `scripts/gerar-banco.ps1`.

## Fluxo de edição do banco

1. Edite `authoring/banco-de-questoes.json` (instruções no topo do arquivo).
2. Rode `scripts/build-h5p.ps1`. Ele chama `gerar-banco.ps1` antes de empacotar.
3. `scripts/validate-h5p.ps1` falha se alguma explicação do gabarito aparecer em texto puro em qualquer JS do pacote, ou se `bank.js` tiver campos como `correct`/`answer`.

Nunca edite `js/data/bank.js` à mão. Não mude o `salt` depois que a atividade estiver em uso: isso invalida as respostas salvas pelos alunos.

## O que continua possível

- Quem lê o código com calma, põe pontos de parada ou reimplementa `answer-key.js` pode testar as alternativas e descobrir a certa.
- Qualquer script na página pode disparar um evento xAPI falso direto para o LMS. Isso vale para todo conteúdo H5P.
- "Apagar progresso e recomeçar", outro navegador ou uma janela anônima começam uma tentativa nova. O LMS já terá recebido a primeira nota; cabe ao professor configurar o LMS para considerar a primeira tentativa.
- Colar do colega: cada aluno recebe um conjunto diferente de questões, com alternativas em ordem diferente.
