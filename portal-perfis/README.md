# Portal Professor/Aluno — Magnetismo e Transporte

Portal em **Python (FastAPI) + SQLite**, **sem login**: cada perfil tem um
**link secreto** (token aleatório) e o **QR code é a credencial**. O QR do
aluno abre a atividade; o QR do professor abre o painel.

Serve a atividade H5P existente **sem alterar** a pasta do projeto
(`h5p-src/`, `authoring/`, `scripts/` intactos; o `.h5p` segue abrindo sozinho
no Lumi).

## Iniciar

```powershell
cd "C:\Users\PC-Panda\Desktop\didatica atv\portal-perfis"
powershell -ExecutionPolicy Bypass -File .\iniciar-portal.ps1
```

Na primeira execução o servidor cria os dois links e gera `qr-professor.png`
e `qr-aluno.png`. Os links aparecem no terminal:

- Aluno: `http://<IP>:8000/a/<token>` (QR pode projetar/imprimir)
- Professor: `http://<IP>:8000/p/<token>` (**não repasse**)

Celular entra pelo `/acesso` (só mostra o QR do aluno). O celular precisa
estar no **mesmo Wi-Fi**; libere o Python no firewall quando perguntado.

## Rotas

| Rota | Quem | O quê |
|---|---|---|
| `/acesso` | todos | QR do aluno p/ celular |
| `/a/<token-aluno>` | aluno | Atividade H5P + “Enviar meu progresso” |
| `/h5p/*` | com cookie de acesso | Arquivos da atividade (allowlist: `dev/`, `h5p-src/`, `designs/`; `authoring/` nunca é servido) |
| `/xapi/statements` | aluno (token) | Recebe `{atividade, nota, nome, turma}` autodeclarada |
| `/p/<token-prof>` | professor | Painel da turma, médias, eixos, CSV, QR, regenerar links |
| `/p/<token>/aluno?nome=&turma=` | professor | Notas e eventos de um aluno |
| `/p/<token>/api`, `/p/<token>/csv` | professor | JSON da turma, CSV p/ planilha/artigo |
| `/p/<token>/atividade` | professor | Ver a atividade |
| `/p/<token>/editar`, `/p/<token>/pacote` | professor | Nível 1: instruções Lumi + baixar `.h5p` |
| `/qr-aluno.png`, `/saude` | todos | QR do aluno, saúde |

Token inválido ou ausente → `404` (não revela que a rota existe). Rotas antigas
com login (`/login`, `/atividade`, `/professor`) **não existem mais**.

## Notas: como chegam ao painel

1. O aluno abre o QR, digita **nome e turma**, faz as 8 páginas.
2. No fim clica em **Enviar meu progresso**: a página lê as notas já calculadas
   (`state.graded`) neste navegador e envia cada uma com nome/turma.
3. O portal guarda a **primeira nota (a que vale)** + tentativas e marca a
   origem como `autodeclarado`.

## QR codes

```powershell
python gerar-qrcodes.py   # regen a partir dos links do banco (IP da LAN)
```

Se o QR do professor vazar (foto, encaminhamento), use **Regenerar link** no
painel: o antigo para de funcionar na hora.

## Privacidade (LGPD Art. 14)

Mínimo necessário: nome/apelido, turma, notas, datas. Sem e-mail, CPF, foto,
IP em relatório ou analytics. Aviso resumido no `/acesso`; apagar/anonimizar
ao fim do semestre ou da pesquisa. Se os dados entrarem no artigo, verificar
CEP/TCLE-TALE com a orientação.

## Segurança e limites honestos

- Links de 144 bits, checados no servidor em toda rota (nega por padrão);
  cookie de acesso `HttpOnly` + `SameSite=Lax`; token duplo no envio
  (`X-Token`); static por allowlist; sem CDN/fontes externas.
- **Limites**: quem tem o link tem o acesso (QR não é login); nomes e notas
  são autodeclarados (forjáveis por aluno técnico); sem HTTPS, não exponha
  além da rede local. Para uso institucional com menores, o caminho é LMS
  (Moodle) ou portal com contas individuais + argon2id + HTTPS (ver
  `PLANEJAMENTO-PERFIS.md`).

## Skills

`.claude/skills/` tem o pacote `perfis-essencial` (`magnetismo-perfis`,
`owasp-security`, `api-authentication`, `csrf-protection`,
`children-data-minimization`), instalado do estoque
`Desktop\Skills\Skills-Frontend\` via `instalar-skill.ps1 -Colecao perfis`.
Plano completo: `Desktop\Skills-Frontend-Documentacao\PLANEJAMENTO-PERFIS.md`.
