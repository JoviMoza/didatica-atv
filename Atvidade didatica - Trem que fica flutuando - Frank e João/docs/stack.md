# Stack e ferramentas

O projeto usa só JavaScript (ES2017+) e CSS, empacotados como biblioteca H5P. Não há framework, bundler, npm nem dependências externas.

| Camada | Tecnologia | Observações |
| --- | --- | --- |
| Conteúdo interativo | H5P, biblioteca própria `H5P.MagnetismoTransporte` 2.2.1 | `coreApi` 1.24; roda num iframe |
| Autoria e publicação | Lumi Desktop / Lumi Cloud | Bibliotecas próprias precisam ser instaladas ou autorizadas pelo operador |
| Interface | JavaScript puro, templates em string, SVG inline | Nada é carregado de fora, exceto YouTube e VLibras, sempre depois de um clique do aluno |
| Estilo | CSS puro com tokens semânticos (convenção shadcn/ui) | Ver `.claude/skills/h5p-frontend/SKILL.md` |
| Persistência | `localStorage` do navegador | Por dispositivo e navegador |
| Rastreamento | xAPI via `H5P.XAPIEvent` | Evento "completed" com pontuação; só sai, nada é aceito de fora |
| Vídeos | YouTube (`youtube-nocookie.com`), carregados sob demanda | O iframe só é criado quando o aluno clica; legenda pt ligada por padrão |
| Libras | VLibras (`vlibras.gov.br`), Governo Federal | Carregado só no clique do botão Libras; precisa de internet |
| Leitura em voz alta | Web Speech API do navegador (voz pt-BR) | Local; nada é enviado para fora |
| Build | PowerShell 5.1 (`scripts/*.ps1`) | Gera o banco lacrado (`gerar-banco.ps1`, com trecho em C#) e os temas do botão Aparência (`gerar-temas.ps1`, a partir de `designs/`), e monta o ZIP `.h5p` e o SHA-256 |

## Ambiente de desenvolvimento

- Windows 11, PowerShell 5.1, Git Bash, Python e Chrome/Edge. **Não há Node.js** nem git no projeto.
- Prévia: `scripts/preview.ps1` sobe um servidor HTTP local (HttpListener) na porta 8080. Com `-Mock`, abre com ferramentas de teste. `dev/preview.html` lê a lista de arquivos de `library.json` e não funciona como `file://`. A prévia grava em `sessionStorage`: abrir em aba/janela nova simula um aluno novo (sorteio novo); "Apagar progresso" também sorteia de novo na mesma aba.
- Verificação: Chrome headless, com `--dump-dom` para a lógica e `--screenshot` para o visual (detalhes na skill `h5p-frontend`).

## Regras de empacotamento (Lumi / H5P)

- Só extensões permitidas pelo H5P entram no pacote; o build falha com qualquer outra. `LICENSE`, sem extensão, é pulado.
- Os caminhos dentro do ZIP usam `/`. JavaScript não pode ficar em `content/`.
- Dentro do `.h5p`, a pasta da biblioteca leva o sufixo de versão (`H5P.MagnetismoTransporte-2.2/`). A árvore-fonte continua sem versão (`h5p-src/H5P.MagnetismoTransporte/`); o `build-h5p.ps1` renomeia ao empacotar. Sem isso o Lumi rejeita com `package-validation-failed:library-file-missing` em todos os JS/CSS.
- `h5p.json` → `preloadedDependencies` precisa ter a mesma versão (major.minor) de `library.json`.
- O Lumi valida `h5p.json` e `library.json` contra os schemas do H5P-Nodejs-library (`h5p-schema.json`, `library-schema.json`). Pegadinhas já encontradas: `licenseExtras` é **texto** (não objeto), e cada item de `changes` usa data no formato `dd-mm-aa hh:mm:ss` (ano com 2 dígitos). Violar o schema gera `package-validation-failed:invalid-h5p-json-file-2`. O `validate-h5p.ps1` confere essas regras.
- Mudança de versão menor (2.0 → 2.1) é uma atualização da biblioteca. Mudar o `machineName` cria uma biblioteca nova.

## Recursos externos usados no conteúdo

- Simulações PhET em português (Ímã e Bússola, Ímãs e Eletroímãs, Lei de Faraday, Laboratório Eletromagnético de Faraday, Forças e Movimento).
- VLibras: `https://vlibras.gov.br/app/vlibras-plugin.js` (widget v7, que cria o próprio botão e a janela num *shadow root*).
- Site do MagLev-Cobra (http://www.maglevcobra.coppe.ufrj.br/, que só responde por http).
- Portal do Livro Digital do FNDE (https://pnld.fnde.gov.br), com login gov.br.
