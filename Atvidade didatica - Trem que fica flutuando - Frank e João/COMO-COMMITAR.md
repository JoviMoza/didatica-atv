# Como publicar este projeto no GitHub (passo a passo)

Guia para você fazer o primeiro commit e o envio (push) sozinho, depois. **Nada foi commitado ainda**: a pasta ainda não é um repositório git.

Há dois caminhos: **A)** pedir ao OpenCode e **B)** digitar os comandos à mão. Os dois fazem a mesma coisa; leia antes o item 1, que vale para ambos.

---

## 0. O que já existe na sua máquina (conferido em 25/09/2026)

| Ferramenta | Situação |
| --- | --- |
| Git | Instalado (2.54). Vem com o Git Credential Manager, que faz o login no GitHub pelo navegador |
| GitHub CLI (`gh`) | **Não instalado**. É opcional; sem ele, o repositório é criado pelo site |
| OpenCode | Configurado em `~/.config/opencode`, mas o comando `opencode` não foi encontrado no terminal usado. Confira com `opencode --version`; se não achar, reinstale ou abra pelo atalho |

Opcional, para criar o repositório pelo terminal:

```powershell
winget install --id GitHub.cli
gh auth login
```

---

## 1. Antes de tudo: o gabarito

`authoring/banco-de-questoes.json` e `authoring/banco-de-questoes.en.json` têm **todas as respostas em texto puro**. O pacote `.h5p` não as leva (ver `docs/seguranca.md`), mas um repositório **público** as deixaria à vista dos alunos.

Escolha uma opção:

- **Recomendado:** crie o repositório como **Privado** e envie tudo.
- **Se precisar ser público:** acrescente `authoring/` ao `.gitignore` (linha comentada no item 2) e guarde uma cópia desses arquivos em outro lugar seguro. Sem eles, ninguém consegue editar as questões nem refazer o build.

---

## 2. Arquivos de configuração do git (criar antes do primeiro commit)

Crie na raiz do projeto (a pasta que tem `README.md`) estes dois arquivos.

**`.gitignore`**

```gitignore
# Sistema
Thumbs.db
desktop.ini
.DS_Store

# Editores
.vscode/
.idea/

# Arquivos temporários
*.tmp
*.log

# Descomente se o repositório for PÚBLICO (ver item 1):
# authoring/
```

Observações:
- `dist/` **fica no repositório** de propósito: é onde está o `.h5p` pronto para o Lumi (cerca de 1 MB). Se preferir não versionar o pacote, acrescente `dist/*.h5p` e anexe o arquivo a uma *Release* no GitHub.
- `js/data/bank.js` e `css/themes/*.css` são gerados pelo build, mas **devem ir para o repositório**: a prévia (`dev/preview.html`) precisa deles.
- `.claude/` (skills do projeto), `CLAUDE.md` e `AGENTS.md` também vão: são as instruções usadas pelo Claude Code e pelo OpenCode.

**`.gitattributes`** (o projeto usa UTF-8 com fim de linha LF; isto evita que o Windows troque para CRLF)

```gitattributes
* text=auto eol=lf
*.h5p    binary
*.sha256 text eol=lf
*.png    binary
*.jpg    binary
*.svg    text eol=lf
```

---

## 3. Conferir o projeto antes de commitar

No PowerShell, dentro da pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-h5p.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\validate-h5p.ps1
```

As duas precisam terminar sem erro (a última linha do validador diz "Gabarito: lacrado…"). Se outra pessoa ou outro agente estiver editando os arquivos ao mesmo tempo, espere terminar antes de continuar.

---

## 4. Caminho A: com o OpenCode

O OpenCode lê o `AGENTS.md` da raiz automaticamente, então já conhece o projeto e suas regras. **Nenhuma skill é necessária para um commit.** As skills em `.claude/skills/` (`h5p-frontend`, `frontend-design`) servem para mexer na interface, não para git.

1. Abra o PowerShell na pasta do projeto:
   ```powershell
   cd "C:\Users\PC-Panda\Desktop\didatica atv\Atvidade didatica - Trem que fica flutuando - Frank e João"
   opencode
   ```
2. Mande os pedidos abaixo **um de cada vez**, conferindo o resultado antes do próximo. Peça sempre que ele mostre o comando antes de rodar.

   **Pedido 1: preparar**
   > Esta pasta ainda não é um repositório git. Mostre os comandos antes de rodar e espere minha confirmação. Rode `git init -b main`, crie o `.gitignore` e o `.gitattributes` exatamente como está no item 2 do `COMO-COMMITAR.md`, e depois mostre o `git status`. Não faça commit ainda.

   **Pedido 2: revisar o que vai entrar**
   > Liste os arquivos que o `git add -A` incluiria (`git add -A --dry-run`). Aponte qualquer coisa estranha: arquivos grandes, temporários, senhas ou tokens. Confirme que `js/data/bank.js` não tem respostas em texto puro (o `scripts/validate-h5p.ps1` verifica isso).

   **Pedido 3: primeiro commit**
   > Faça `git add -A` e o commit com a mensagem do item 6 do `COMO-COMMITAR.md`. Depois mostre `git log --stat -1`.

   **Pedido 4: enviar**, depois de criar o repositório vazio no GitHub (item 5, passos 1 a 3)
   > Adicione o remoto `origin` com a URL `<cole aqui a URL do repositório>` e rode `git push -u origin main`. Se pedir login, só avise: eu faço no navegador.

3. Se o OpenCode sugerir `--force`, `reset --hard` ou apagar arquivos, **recuse**. Nada disso é necessário num primeiro envio.

---

## 5. Caminho B: comandos à mão (PowerShell)

```powershell
# 1. Ir para a pasta do projeto
cd "C:\Users\PC-Panda\Desktop\didatica atv\Atvidade didatica - Trem que fica flutuando - Frank e João"

# 2. Seu nome e e-mail nos commits (use o e-mail da sua conta do GitHub)
git config --global user.name  "Seu Nome"
git config --global user.email "seu-email@exemplo.com"

# 3. Criar o repositório local (branch principal: main)
git init -b main

# 4. Criar .gitignore e .gitattributes (conteúdo no item 2) e conferir
git status

# 5. Ver o que vai entrar, sem adicionar ainda
git add -A --dry-run

# 6. Adicionar e commitar (mensagem no item 6)
git add -A
git commit -F mensagem-commit.txt      # ou: git commit -m "..."
git log --stat -1
```

**Criar o repositório no GitHub**

- **Pelo site:**
  1. Acesse github.com/new.
  2. Dê um nome, por exemplo `magnetismo-e-transporte`, e marque **Private** (ver item 1).
  3. **Não** marque "Add a README", ".gitignore" nem "license": o projeto já tem esses arquivos, e o GitHub criaria um conflito.
  4. Copie a URL (`https://github.com/<usuario>/magnetismo-e-transporte.git`).
- **Ou pelo terminal**, com o `gh` instalado:
  ```powershell
  gh repo create magnetismo-e-transporte --private --source . --remote origin
  ```

**Enviar**

```powershell
git remote add origin https://github.com/<usuario>/magnetismo-e-transporte.git   # pule se usou gh repo create
git push -u origin main
```

No primeiro push, o Git Credential Manager abre o navegador para você entrar no GitHub. Depois disso, não pede mais.

---

## 6. Mensagem sugerida para o primeiro commit

Salve em `mensagem-commit.txt` (apague depois do commit) ou cole no pedido ao OpenCode:

```text
Magnetismo e Transporte v2.2.1: primeira versão no repositório

Objeto de aprendizagem H5P (H5P.MagnetismoTransporte 2.2.1) sobre ímãs,
eletroímãs e trens Maglev, para o ensino médio.

Nesta versão:
- Página 6 com vídeo próprio ("MAGLEVS - Trens de Levitação Magnética",
  Gerando Respostas/UFABC), audiodescrição, texto de apoio, guiamento e
  quadro de vantagens e desafios do Maglev
- Banco com 72 questões de escolha única e 62 de V ou F; novo conceito
  "Maglev no mundo" na revisão estendida
- Botão Aparência: temas Padrão (inicial), Noturno, Caderno e Sinalização,
  gerados a partir de designs/ por scripts/gerar-temas.ps1
- Página 5: "Pular par" no jogo da memória (conta como erro e revela o par)
- Vocabulário e laboratório: Pular só após 3 tentativas erradas;
  quiz e V ou F sem Pular
- Interface em português e inglês
```

---

## 7. Commits seguintes (o dia a dia)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-h5p.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\validate-h5p.ps1
git status                      # o que mudou
git diff                        # ver as mudanças
git add -A
git commit -m "Resumo curto do que mudou"
git push
```

Com o OpenCode, basta pedir: "Rode o build e o validador; se passarem, mostre o `git status` e o `git diff --stat`, proponha uma mensagem de commit e espere minha confirmação antes de commitar e dar push."

Dicas:
- Um commit por assunto (ex.: "Corrige vídeo da página 5", "Adiciona 10 questões sobre indução"). Fica mais fácil desfazer só aquilo depois.
- Ao lançar versão nova, siga a lista do `CLAUDE.md` (subir a versão em `library.json`, `h5p.json`, `xapi.js`, `validate-h5p.ps1` e `dev/preview.js`) antes de commitar. Se quiser, marque a versão com `git tag v2.2.1` e `git push --tags`.

---

## 8. Problemas comuns

| Mensagem | O que fazer |
| --- | --- |
| `warning: LF will be replaced by CRLF` | O `.gitattributes` do item 2 resolve. Crie-o antes do primeiro `git add` |
| `fatal: not a git repository` | Você não está na pasta do projeto, ou faltou o `git init -b main` |
| `src refspec main does not match any` | Ainda não há commit. Faça o `git commit` antes do `git push` |
| `rejected … fetch first` no push | O repositório no GitHub foi criado com README ou licença. Crie de novo **vazio**, ou rode `git pull origin main --allow-unrelated-histories`, resolva e envie |
| `Support for password authentication was removed` | Use o login pelo navegador do Git Credential Manager (ou `gh auth login`). Não use a senha da conta |
| `opencode` não é reconhecido | Reinstale o OpenCode, abra um terminal novo, ou use o caminho B |
