# Contexto do projeto

"Magnetismo e Transporte" é uma atividade didática de Física feita para um artigo de Iniciação Científica (pasta "Artigo IC", autores Frank e João). A primeira versão se chamava "Missão MagLev — O Trem que Flutua". O objetivo é levar estudantes do ensino médio do ímã comum ao trem que levita, com interação no lugar de texto denso.

## Decisões pedagógicas (pedidas pela equipe)

- **Linguagem acessível, alinhada ao PNLD.** Desde a v2.1, o conteúdo segue os temas de Magnetismo e Eletromagnetismo dos livros de Física do PNLD (FNDE), sem o enfoque acadêmico da v1: domínios, campo, equilíbrio de forças, Earnshaw, eletroímã, indução, EMS/EDS, motor linear e supercondutores. Os livros digitais exigem login gov.br, então a revisão indica temas do sumário, não capítulos específicos.
- **Navegação sequencial.** O aluno não escolhe páginas. Ele pode voltar a qualquer página e avançar só até a última liberada.
- **Vídeo da página 6 não obrigatório, sem avisar.** Estar na página 6 libera a 7, e nenhum texto pode dizer que o vídeo pode ser pulado.
- **Laboratório com 2 a 10 ímãs** (padrão 4, um em cada canto; acrescentar e retirar), que o aluno gira com o mouse, o toque ou o teclado. O roteiro é observar → alinhar → explicar, com um desafio extra opcional: zerar o campo no centro.
- **Questões sorteadas por aluno**, para cada estudante receber um conjunto diferente.
- **Aba "Revisão estendida"** com explicações, exemplos do dia a dia, indicação do livro e simulações. Por padrão, abre ao terminar a página 7; o professor pode deixá-la aberta desde o início no editor.
- **Nota da primeira tentativa.** Praticar de novo é permitido, mas não altera a nota.
- **Sem cola fácil.** As respostas não podem estar legíveis no código, no HTML nem no progresso salvo (pedido da equipe na v2.2). Detalhes e limites em [seguranca.md](seguranca.md).
- **Acessível para todos os públicos** (pedido na v2.2): Libras pelo VLibras, do Governo Federal; legenda em português nos vídeos; e audiodescrição em texto, que pode ser lida em voz alta. Ver [acessibilidade.md](acessibilidade.md).
- **Temas visuais opcionais** (pedido na v2.2.1): botão Aparência com Noturno, Caderno e Sinalização, mantendo o design atual como **Padrão** e opção inicial (pedido explícito da equipe: "é muito bom também").
- **Pular só depois de tentar** (pedido na v2.2.1): no vocabulário e no laboratório, o botão Pular só libera depois de 3 tentativas erradas na questão. O quiz e o V ou F não têm pulo, porque cada questão aceita uma resposta só (escolha da equipe). As páginas com vídeo do YouTube ficam de fora da regra: o jogo da memória (página 5) mantém o "Pular par" sempre disponível.
- **Código componentizado.** Uma página por arquivo, sem arquivo monolítico (pedido da equipe na v2.2).

## Fatos verificados usados no conteúdo

| Fato | Valor usado | Fonte conferida |
| --- | --- | --- |
| Folga do Transrapid (EMS, Xangai) | 10 mm na Wikipedia, 15 mm no vídeo da página 6; o conteúdo usa "1 a 1,5 cm" | Wikipedia, "Transrapid"; vídeo `wPxQm8mdUi8` |
| SCMaglev (EDS, Japão) | levita a partir de ~150 km/h (Wikipedia) ou ~100 km/h (vídeo da página 6); o conteúdo usa "100 a 150 km/h"; cerca de 10 cm; recorde de 603 km/h (2015); supercondutores de nióbio-titânio com hélio líquido | Wikipedia, "SCMaglev"; vídeo `wPxQm8mdUi8` |
| MagLev-Cobra | desenvolvido no LASUP, da COPPE/UFRJ | site oficial do MagLev-Cobra |
| Vídeo MagLev-Cobra | permite incorporação (`playableInEmbed: true`); 2 min 8 s; 70 km/h, ímãs permanentes + supercondutores, módulos conectados | página e legenda automática do YouTube |
| Vídeo da página 1 (Manual do Mundo) | é sobre o Levitron (pião de ímã, efeito giroscópio, modelo eletrônico com 4 eletroímãs e sensores); 14 min | legenda automática do YouTube |
| Vídeo da página 6 (Gerando Respostas, UFABC) | "MAGLEVS - Trens de Levitação Magnética"; permite incorporação; 6 min 16 s; levitação, guiamento e propulsão; EMS (Xangai, 431 km/h reduzidos a 300 km/h, aeroporto de Pudong ao metrô) e EDS (Japão, rodas em baixa velocidade, mais de 600 km/h); Maglev comercial só na China e no Japão; linhas do Reino Unido e da Coreia do Sul desativadas; Chuo Shinkansen (Tóquio–Nagoia, 286 km, 40 min, 505 km/h, 90% em túneis); vantagens e desvantagens | página e legenda automática do YouTube, baixadas em 25/09/2026 |

Na v2.2, o texto de apoio da página 6 foi reescrito a partir da legenda do vídeo: a versão anterior falava de um objeto que precisava de uma guia, mas o vídeo mostra o Levitron.

Na v2.2.1, a página 6 deixou de repetir o vídeo da página 1 e passou a usar o vídeo do Gerando Respostas sobre trens Maglev. A audiodescrição e o texto de apoio foram escritos a partir da legenda automática dele. Como o vídeo e a Wikipedia dão números diferentes para a folga do EMS e a velocidade de decolagem do EDS, o conteúdo e as questões usam faixas que cobrem as duas fontes.

## Histórico de versões

| Versão | Data | Mudanças |
| --- | --- | --- |
| 1.0 (`H5P.MissaoMagLev`) | 24/09/2026 | 8 páginas, xAPI, resultados; conteúdo mais acadêmico (supercondutividade) |
| 2.0 (`H5P.MagnetismoTransporte`) | 25/09/2026 | Novo nome, laboratório com 4 ímãs giratórios, navegação sequencial, novo design |
| 2.1 | 25/09/2026 | Conteúdo acessível alinhado ao PNLD, 35 questões sorteadas, página 6 sobre os sistemas Maglev, aba de revisão estendida |
| 2.2 | 25/09/2026 | Código em módulos (JS por página, CSS por componente); gabarito lacrado, progresso assinado, fim das notas externas por `postMessage`; memória pontua acertos ÷ tentativas; vídeos param ao trocar de página; botão Libras (VLibras), legenda em português nos vídeos e audiodescrição com leitura em voz alta |
| 2.3 | 01/10/2026 | Espanhol (es-ES) como terceira língua, com o banco inteiro traduzido; botão de língua único (globo + bandeira); sinalização de scroll; explicação "Como jogar" antes das cartas do jogo da memória; laboratório com 2 a 10 ímãs; nova página 8 dissertativa (5 pts) corrigida offline e resultados na página 9, total 20 pts. |
| 2.2.1 | 25/09/2026 | Novo vídeo na página 6 (Gerando Respostas, UFABC), com audiodescrição e texto de apoio; guiamento e quadro de vantagens e desafios na página 6; conceito "Maglev no mundo" na revisão; +12 questões de escolha única (72) e +12 de V ou F (62); botão Aparência com os temas de `designs/` (Padrão continua o inicial); "Pular par" no jogo da memória; Pular do vocabulário e do laboratório só após 3 tentativas erradas; quiz e V ou F sem pulo |

## Pendências conhecidas

- **Vídeo da página 5 (MagLev-Cobra) não roda** (relato da equipe em 25/09/2026). Conferido: o vídeo `MnR7iTjmSPg` está público e permite incorporação, e o iframe usa `youtube-nocookie.com` com `referrerpolicy="strict-origin-when-cross-origin"`. Falta saber onde ele foi aberto (Lumi Desktop, prévia por `file://`, navegador) e qual mensagem o player mostra. Aberta como arquivo, a prévia não envia Referer e esse canal bloqueia o vídeo (ver README).
- Testar dentro do Lumi (Desktop e Cloud) e confirmar os eventos xAPI no LMS.
- Assistir aos vídeos e revisar as audiodescrições e o texto de apoio da página 6 (escritos a partir das legendas automáticas).
- Testar o VLibras dentro do Lumi e na rede da escola.
- O quadro "Repare" da página 1 ainda usa termos da v1 ("exclusão de campo", "aprisionamento de fluxo").
- Atualizar a documentação compartilhada (Claude Docs) e o README, que ainda descrevem a v2.0.
- O progresso fica só no navegador; perguntas e cartas não são editáveis pelo editor H5P.
