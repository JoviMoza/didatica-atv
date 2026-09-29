# Designs alternativos

Três temas visuais para o Magnetismo e Transporte. Cada tema é um único `tema.css` que muda os tokens (`--background`, `--primary`…) e as poucas cores fixas dos componentes. Nenhum JavaScript nem HTML muda, e as regras de acessibilidade continuam valendo: foco visível, acerto e erro com ícone e texto, alvos de 40 px e `prefers-reduced-motion`. Nada é carregado de fora: as fontes são as do sistema.

| Tema | Ideia | Quando usar |
| --- | --- | --- |
| [`1-noturno`](1-noturno/tema.css) | Modo escuro: azul-marinho, ciano elétrico e violeta, com brilho suave nos títulos | Sala escura, projetor, quem prefere tela escura |
| [`2-caderno`](2-caderno/tema.css) | Caderno de laboratório: papel quadriculado, tinta azul, margem vermelha, marca-texto amarelo e títulos com serifa | Visual mais "escolar" e acolhedor |
| [`3-sinalizacao`](3-sinalizacao/tema.css) | Placa de estação: preto, branco e amarelo de segurança, cantos retos e o progresso como mapa de linha de metrô | Maior contraste; bom para baixa visão e projetor fraco |

Cada pasta tem capturas de tela: `preview-inicio.png`, `preview-laboratorio.png`, `preview-resultados.png` (1280 px) e `preview-celular.png` (375 px).

## Ver um tema na prévia

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1 -Mock
```

Depois, acrescente `&design=<pasta>` ao endereço, por exemplo `http://localhost:8080/dev/preview.html?mock=1&design=2-caderno`. Sem `design`, a prévia mostra o design atual (v2).

## Botão "Aparência" (os temas no pacote)

Os três temas já entram no `.h5p`. O aluno escolhe o visual no botão **Aparência**, no topo, ao lado de Libras: **Padrão** (o design original, que continua sendo o inicial), Noturno, Caderno ou Sinalização. A escolha fica salva com o progresso e sobrevive a "Apagar progresso". O professor pode esconder o botão no editor: **Comportamento → Mostrar o botão Aparência** (`behaviour.themes`).

Como funciona:

1. `scripts/gerar-temas.ps1`, chamado pelo `build-h5p.ps1`, lê cada `designs/<n>-<id>/tema.css` e gera `css/themes/<id>.css`, com as regras restritas a `[data-mt-theme="<id>"]` dentro do `:where()`. A especificidade não muda, então as regras abaixo continuam valendo.
2. `js/ui/themes.js` lista os temas (nome, descrição e cores da amostra) e põe `data-mt-theme` na raiz `.h5p-mt` e no contêiner `.h5p-mt-host`.
3. Os arquivos gerados estão no fim de `preloadedCss` em `library.json`.

Para criar um tema novo: crie `designs/4-<id>/tema.css` no mesmo formato, acrescente o tema em `THEMES` (`js/ui/themes.js`) e `{ "path": "css/themes/<id>.css" }` no fim de `preloadedCss`, e rode o build. Não edite `css/themes/` à mão.

## Como os temas foram escritos

- O bloco `.h5p-mt { … }` redefine os tokens. Como o arquivo carrega por último, ele vence o `css/base.css`.
- As demais regras usam `:where(.h5p-mt) .mt-…`. O `:where()` não soma especificidade, então cada regra tem o mesmo peso da original e só vence por vir depois. Assim, estados mais específicos (`.mt-token.is-selected`, `.mt-choice:has(input:checked)`, `.mt-choice.is-correct`) continuam funcionando.
- As cores físicas do laboratório foram mantidas: polo N vermelho, polo S azul e seta do campo amarela.
- Ao criar um componente novo com cor fixa, confira se os três temas precisam de uma regra para ele.
