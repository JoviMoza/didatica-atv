# Magnetismo e Transporte — v2.3.0

Objeto de aprendizagem H5P (biblioteca própria `H5P.MagnetismoTransporte 2.3.0`) sobre magnetismo, eletroímãs, trens Maglev e o MagLev-Cobra. São **8 páginas** em sequência, quatro atividades avaliativas (15 pontos), persistência em `localStorage`, eventos xAPI e painel de resultados.

## Novidades da v2.3.0

- **Espanhol (es-ES) como terceira língua:** interface, banco de questões e textos de apoio traduzidos. São três idiomas: português (padrão), inglês e espanhol.
- **Botão de língua único:** um só botão no topo, com um globo e a palavra **Língua**, e ao lado a bandeira do idioma em uso (Brasil, Estados Unidos ou Espanha). Clicar abre a lista das três opções, cada uma com a sua bandeira e o nome no próprio idioma.
- **Sinalização de scroll:** no topo aparece um aviso "Role para baixo para fazer a tarefa", com uma seta pulsando, enquanto ainda houver tarefa abaixo da dobra. Ele some sozinho assim que o aluno rola, e nunca aparece quando a página inteira cabe na tela.
- **Página 5, "Como jogar":** antes das cartas, o aluno lê como o jogo funciona (duas cartas por vez, par certo permanece virado, par errado volta) e como a pontuação é calculada (acertos ÷ tentativas). A explicação some quando o jogo termina.
- **Página 3, número de ímãs ajustável:** o laboratório começa com **2 ímãs** e o aluno pode acrescentar até **10** e retirar de volta até 2, em pontos equidistantes do círculo, numerados como Ímã 1, Ímã 2… O contador e o limite ficam sempre à vista. O ímã novo nasce na mesma direção do vizinho, para não desfazer um alinhamento já feito. As duas questões do laboratório foram reescritas para valerem com qualquer quantidade.
- **Página 8, questão dissertativa (5 pts):** o aluno escreve uma resposta aberta e ela é corrigida **no próprio navegador**, sem servidor e sem internet, por critérios obrigatórios, termos esperados, relações e contradições. A rubrica, as referências e os comentários ficam lacrados no pacote (não aparecem em texto puro no código nem no que é salvo no navegador); o resultado é uma nota de 0 a 5 com o que foi acertado, o que faltou e o que conflita. A correção é transparente e nunca definitiva: a resposta continua sendo do aluno, e a página de resultados mostra cada critério para ele conferir. O total da atividade passou de 15 para **20 pontos**.

## Novidades da v2.2.1

- **Página 6 com vídeo próprio:** a página deixou de repetir o vídeo da página 1 e usa "MAGLEVS - Trens de Levitação Magnética" (Gerando Respostas, UFABC), com audiodescrição e texto de apoio escritos a partir da legenda. A página ganhou o guiamento e um quadro de vantagens e desafios do Maglev.
- **Banco maior:** 72 questões de escolha única e 62 de V ou F, com o novo conceito "Maglev no mundo" na revisão estendida.
- **Botão Aparência:** no topo, o aluno escolhe o visual: **Padrão** (o original, que continua sendo o inicial), Noturno, Caderno ou Sinalização. A escolha fica salva. Os temas vêm de `designs/` (ver `designs/README.md`).
- **Pular par na memória:** sempre disponível (página com vídeo). O par pulado é revelado, conta como uma tentativa sem acerto e marca o conceito para revisão.
- **Pular só depois de tentar:** no vocabulário e no laboratório, o Pular libera depois de 3 tentativas erradas na questão, com um contador ao lado. O quiz e o V ou F não têm mais Pular.
- **Versão em inglês:** botão PT-BR / EN-US no topo (a v2.3 somou o espanhol e trocou o par de botões pelo botão único "Língua").

## Novidades da v2

- **Novo nome:** "Missão MagLev" passou a se chamar **Magnetismo e Transporte**. "Missão MagLev · o trem que flutua" virou o subtítulo.
- **Laboratório de ímãs (página 3):** quatro ímãs, um em cada canto (a v2.3 perm 2 a 10, mas o padrão continuam sendo 4 nos cantos), que o aluno **gira** de três formas: arrastando em círculo (mouse ou toque), com os botões ↺ ↻ ou pelo teclado (setas giram 15°, PageUp/PageDown giram 90°). As linhas de campo, as bússolas opcionais e a seta do campo resultante no centro são recalculadas em tempo real por superposição. Roteiro em três etapas: observar → alinhar → explicar. Há também um desafio extra opcional: zerar o campo no centro.
- **Navegação sequencial:** o aluno não escolhe mais a página livremente. O indicador de progresso só informa. Os botões **Anterior** e **Próxima** permitem voltar a qualquer página e avançar apenas até a última página liberada. Páginas com atividade liberam a próxima quando são concluídas. O botão "Voltar para onde parei" aparece quando o aluno volta para revisar.
- **Novo design:** tokens semânticos no estilo shadcn/ui (`--background`, `--primary`, `--muted`, `--ring`…), com fundo claro, azul profundo, ciano elétrico e branco. É CSS puro, sem build nem dependências.
- **Correções:** no jogo da memória, as duas cartas de um par às vezes eram ambas imagens; agora cada par tem sempre uma imagem e uma descrição. A pontuação e a data da primeira conclusão não são mais sobrescritas quando o aluno pratica de novo.

| Página | Conteúdo | Libera a próxima quando… | Avaliação |
|---|---|---|---:|
| 1. Início | Texto, vídeo e instruções da missão | abrir a página | — |
| 2. Vocabulário | Drag the Words (5 termos + 2 distratores) | completar as 5 lacunas | 5 pts |
| 3. Laboratório de ímãs | Simulação com 2 a 10 ímãs giratórios (padrão 4, um em cada canto; acrescentar e retirar) | concluir as 3 etapas do roteiro | — |
| 4. Quiz | 4 questões de escolha única (sem pular) | responder às 4 | 4 pts |
| 5. Memória | Vídeo UFRJ + 6 pares (ou associação por listas) | achar ou pular os 6 pares | 1 pt |
| 6. Maglev | Vídeo, texto de apoio, sistemas EMS/EDS/supercondutor, motor linear, vantagens e desafios | abrir a página | — |
| 7. V ou F | 5 afirmações (sem pular) | responder às 5 | 5 pts |
| 8. Dissertativa | Resposta aberta corrigida offline (critérios, termos, relações, contradições) | escrever e conferir a resposta | 5 pts |
| 9. Resultados | Nota total (20 pts), barras e o que revisar | — | — |

## Prévia local

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1          # abre http://localhost:8080/dev/preview.html
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1 -Mock    # com ferramentas de teste
```

Use o script em vez de abrir `dev/preview.html` com duplo clique. Aberta como arquivo (`file://`), a página não envia ao YouTube o endereço de origem, e o YouTube bloqueia alguns vídeos incorporados, como o do MagLev-Cobra. No Lumi e no LMS isso não acontece, porque o conteúdo roda por `http(s)`. O modo de teste (`?mock=1`) mostra os botões "Desbloquear todas as páginas" e "Simular resultados".

## Gerar o `.h5p`

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-h5p.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\validate-h5p.ps1
```

O build gera antes o banco lacrado (`gerar-banco.ps1`) e os temas do botão Aparência (`gerar-temas.ps1`, a partir de `designs/`).

Saídas: `dist/magnetismo-transporte.h5p` e `dist/magnetismo-transporte.h5p.sha256`. Os arquivos da v1 foram guardados em `dist/v1/`.

## Estrutura

```text
authoring/banco-de-questoes.json   questões e gabarito em texto puro (fora do pacote)
authoring/banco-de-questoes.en.json  tradução das questões para o inglês
authoring/banco-de-questoes.es.json  tradução das questões para o espanhol
authoring/rubrica-dissertativa.json  critérios, referências e comentários da dissertativa
designs/                           temas Noturno, Caderno e Sinalização (fonte do botão Aparência)
h5p-src/
├── h5p.json
├── content/ (content.json, CREDITS.txt, images/)
└── H5P.MagnetismoTransporte/
    ├── library.json, semantics.json, icon.svg
    ├── js/core/       estado, xAPI, sorteio e gabarito lacrado
    ├── js/data/       conteúdo didático e bank.js (gerado, respostas lacradas)
    ├── js/pages/      uma página por arquivo (01-intro … 09-results)
    ├── js/ui/         componentes, acessibilidade e temas (themes.js)
    ├── js/app.js      navegação e montagem das páginas
    ├── css/           base + components/ + pages/ + views/ + themes/ (gerado)
    └── language/pt-br.json
```

Para editar questões, altere `authoring/banco-de-questoes.json` e rode o build. As respostas não entram em texto puro no pacote; veja `docs/seguranca.md`. Mais detalhes em `docs/`.

## Lumi: observação importante

Como a biblioteca é nova (`H5P.MagnetismoTransporte`, e não mais `H5P.MissaoMagLev`), ela precisa ser instalada ou autorizada no Lumi, assim como na v1. O progresso salvo da v1 não é reaproveitado, porque a chave de armazenamento mudou.

## Física do laboratório

Cada ímã é modelado como um par de polos (N = +1, S = −1) com decaimento 1/r². As linhas são integradas (RK2) a partir do polo N. O indicador "Campo no centro" usa uma escala qualitativa (Nulo / Fraco / Médio / Forte), porque as unidades do modelo são arbitrárias. As perguntas tratam apenas de simetria e superposição, que o modelo representa corretamente.

## Acessibilidade

Há um botão **Libras** (VLibras, do Governo Federal) no topo. Todo vídeo tem legenda em português ligada no YouTube e um botão **Audiodescrição e resumo do vídeo**, que pode ser lido em voz alta. Detalhes em `docs/acessibilidade.md`.

Cada ímã é um `slider` focável com `aria-valuetext` (por exemplo, "polo N apontando para a direita (90°)"). Há botões de rotação como alternativa ao arrastar, regiões `aria-live`, foco visível e alternativa sem cartas no jogo da memória. O layout é responsivo, e as opções `prefers-reduced-motion` e `forced-colors` são respeitadas.

## Direitos das imagens

Consulte `h5p-src/content/CREDITS.txt`.
