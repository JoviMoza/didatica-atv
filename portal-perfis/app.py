"""Portal Professor/Aluno — Magnetismo e Transporte (acesso por QR, sem login).

Não há usuário nem senha: cada perfil tem um LINK SECRETO (token aleatório).
O QR do aluno abre a atividade; o QR do professor abre o painel. Quem tiver o
link tem o acesso — guarde o QR do professor e regenere se vazar.

Serve a atividade H5P existente sem alterar `h5p-src/` (o `.h5p` segue abrindo
sozinho no Lumi). Banco local SQLite.

Rode com: powershell -ExecutionPolicy Bypass -File .\\iniciar-portal.ps1
"""

import csv
import hashlib
import hmac
import html
import io
import json
import os
import secrets
import socket
import sqlite3
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import qrcode
from fastapi import FastAPI, Form, Request
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    PlainTextResponse,
    RedirectResponse,
    Response,
)

# ----------------------------------------------------------------------------
# Caminhos e configuração (nada do H5P é alterado; o portal só LÊ esses arquivos)
# ----------------------------------------------------------------------------

PORTAL_DIR = Path(__file__).resolve().parent
PROJETO_DIR = PORTAL_DIR.parent / "Atvidade didatica - Trem que fica flutuando - Frank e João"
DB_PATH = PORTAL_DIR / "portal.db"

PORT = int(os.environ.get("PORTAL_PORT", "8000"))
COOKIE_NOME = "portal_acesso"


def base_url() -> str:
    """URL base alcançável pelo celular (IP da LAN)."""
    if os.environ.get("PORTAL_URL"):
        return os.environ["PORTAL_URL"].rstrip("/")
    lan = "localhost"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan = s.getsockname()[0]
        s.close()
    except OSError:
        pass
    return f"http://{lan}:{PORT}"


# Atividades avaliativas (espelho de js/core/activities.js — só rótulos e máximos,
# nunca gabarito). TOTAL_MAX = 15.
ATIVIDADES = {
    "dragWords": {"rotulo": "Vocabulário", "pagina": 2, "max": 5},
    "singleChoice": {"rotulo": "Quiz (escolha única)", "pagina": 4, "max": 4},
    "memory": {"rotulo": "Memória", "pagina": 5, "max": 1},
    "trueFalse": {"rotulo": "V ou F", "pagina": 7, "max": 5},
}
TOTAL_MAX = sum(a["max"] for a in ATIVIDADES.values())

# Eixos temáticos = campo `concept` do banco (só ids e agrupamento, sem respostas).
EIXOS = {
    "Magnetismo": ["polos", "dominios", "campo"],
    "Equilíbrio e levitação": ["equilibrio", "earnshaw"],
    "Eletromagnetismo": ["eletroima", "inducao", "motor-linear"],
    "Maglev": ["ems", "supercondutor", "maglev-mundo"],
}

# Arquivos do projeto servidos ao navegador com acesso válido (allowlist:
# authoring/ com o gabarito em texto puro NUNCA entra aqui).
STATIC_PREFIXOS = ("dev/", "h5p-src/", "designs/")
MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain; charset=utf-8",
}

# ----------------------------------------------------------------------------
# Banco (SQLite, stdlib)
# ----------------------------------------------------------------------------


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    con = db()
    # Modelo sem login: links secretos por perfil + resultados por nome autodeclarado.
    con.execute("DROP TABLE IF EXISTS usuarios")
    con.execute("DROP TABLE IF EXISTS login_tentativas")
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY,
            perfil TEXT UNIQUE NOT NULL CHECK (perfil IN ('professor','aluno')),
            token TEXT NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resultados (
            id INTEGER PRIMARY KEY,
            nome TEXT NOT NULL,
            turma TEXT NOT NULL DEFAULT '',
            atividade TEXT NOT NULL,
            primeira_nota REAL NOT NULL,
            ultima_nota REAL NOT NULL,
            tentativas INTEGER NOT NULL DEFAULT 1,
            origem TEXT NOT NULL DEFAULT 'autodeclarado',
            atualizado_em TEXT NOT NULL,
            UNIQUE (nome, turma, atividade)
        );
        CREATE TABLE IF NOT EXISTS eventos (
            id INTEGER PRIMARY KEY,
            nome TEXT NOT NULL DEFAULT '',
            turma TEXT NOT NULL DEFAULT '',
            tipo TEXT NOT NULL,
            dados TEXT NOT NULL DEFAULT '{}',
            criado_em TEXT NOT NULL
        );
        """
    )
    con.commit()
    con.close()
    garantir_links()


def garantir_links() -> dict:
    """Cria os links secretos se ainda não existirem; devolve {perfil: token}."""
    agora = datetime.now(timezone.utc).isoformat()
    con = db()
    for perfil in ("professor", "aluno"):
        row = con.execute(
            "SELECT token FROM links WHERE perfil=? AND ativo=1", (perfil,)
        ).fetchone()
        if row is None:
            con.execute(
                "INSERT OR REPLACE INTO links (perfil, token, ativo, criado_em)"
                " VALUES (?,?,1,?)",
                (perfil, secrets.token_urlsafe(24), agora),
            )
    con.commit()
    rows = con.execute("SELECT perfil, token FROM links WHERE ativo=1").fetchall()
    con.close()
    return {r["perfil"]: r["token"] for r in rows}


def token_perfil(token: str | None) -> str | None:
    """Devolve 'professor'/'aluno' se o token for válido e ativo, senão None."""
    if not token:
        return None
    con = db()
    row = con.execute(
        "SELECT perfil FROM links WHERE token=? AND ativo=1", (token,)
    ).fetchone()
    con.close()
    return row["perfil"] if row else None


def regenerar(perfil: str) -> str:
    agora = datetime.now(timezone.utc).isoformat()
    novo = secrets.token_urlsafe(24)
    con = db()
    con.execute(
        "UPDATE links SET token=?, ativo=1, criado_em=? WHERE perfil=?",
        (novo, agora, perfil),
    )
    con.commit()
    con.close()
    return novo


# ----------------------------------------------------------------------------
# QR codes (arquivos para imprimir/mostrar em sala)
# ----------------------------------------------------------------------------


def _qr_png(url: str) -> bytes:
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def atualizar_qrs() -> dict:
    links = garantir_links()
    base = base_url()
    urls = {
        "professor": f"{base}/p/{links['professor']}",
        "aluno": f"{base}/a/{links['aluno']}",
    }
    (PORTAL_DIR / "qr-professor.png").write_bytes(_qr_png(urls["professor"]))
    (PORTAL_DIR / "qr-aluno.png").write_bytes(_qr_png(urls["aluno"]))
    return urls


# ----------------------------------------------------------------------------
# App
# ----------------------------------------------------------------------------

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
init_db()

# ----------------------------------------------------------------------------
# HTML (CSS puro, sem CDN/fontes externas; dinâmico sempre escapado)
# ----------------------------------------------------------------------------

CSS = """
:root{--bg:#f5f7fb;--card:#fff;--ink:#17233b;--mut:#5b6b85;--pri:#1d4ed8;
--ok:#15803d;--err:#b91c1c;--line:#dbe3ef}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font:1rem/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.topo{background:#0f2a5c;color:#fff;padding:.7rem 1rem;display:flex;gap:1rem;
align-items:center;flex-wrap:wrap}.topo a{color:#cfe0ff}.topo .papel{background:#fff;
color:#0f2a5c;border-radius:99px;padding:.05rem .7rem;font-size:.85rem;font-weight:700}
main{max-width:60rem;margin:1.2rem auto;padding:0 1rem}.card{background:var(--card);
border:1px solid var(--line);border-radius:.8rem;padding:1.1rem 1.2rem;margin-bottom:1rem}
.mut{color:var(--mut)}.err{background:#fdecec;border:1px solid #f3b4b4;color:var(--err);
border-radius:.6rem;padding:.6rem .8rem;margin-bottom:1rem}.ok{background:#e9f7ee;
border:1px solid #a9d8b8;color:var(--ok);border-radius:.6rem;padding:.6rem .8rem;
margin-bottom:1rem}label{display:block;margin:.6rem 0 .2rem;font-weight:600}
input,select{width:100%;padding:.55rem .6rem;border:1px solid var(--line);
border-radius:.5rem;font-size:1rem}button,.btn{background:var(--pri);color:#fff;border:0;
border-radius:.5rem;padding:.6rem 1rem;font-size:1rem;cursor:pointer;text-decoration:none;
display:inline-block}button.sec,.btn.sec{background:#e6ecf7;color:#0f2a5c}
table{width:100%;border-collapse:collapse;font-size:.95rem}th,td{border-bottom:1px solid
var(--line);padding:.45rem .4rem;text-align:left}th{background:#eef3fb}
iframe.ativ{width:100%;height:80vh;border:1px solid var(--line);border-radius:.8rem;
background:#fff}.qrgrid{display:flex;gap:1.5rem;flex-wrap:wrap}.qrgrid figure{margin:0;
text-align:center;max-width:19rem}.qrgrid code{word-break:break-all;font-size:.85rem}
.aviso{font-size:.9rem}.idlinha{display:flex;gap:.6rem;flex-wrap:wrap}.idlinha>div{flex:1;
min-width:12rem}code.url{word-break:break-all}
"""


def esc(v) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def pagina(titulo: str, corpo: str, papel: str | None = None) -> str:
    etiqueta = f'<span class="papel">{esc(papel)}</span>' if papel else ""
    return (
        "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{esc(titulo)} — Magnetismo e Transporte</title>"
        f"<style>{CSS}</style></head><body>"
        f"<header class='topo'><strong>Magnetismo e Transporte</strong>{etiqueta}</header>"
        f"<main>{corpo}</main></body></html>"
    )


def _cookie(request: Request) -> str | None:
    return request.cookies.get(COOKIE_NOME)


def _resposta_com_cookie(html_texto: str, token: str) -> HTMLResponse:
    r = HTMLResponse(html_texto)
    r.set_cookie(COOKIE_NOME, token, httponly=True, samesite="lax", max_age=12 * 3600)
    return r


def exige_professor(tok: str) -> bool:
    return token_perfil(tok) == "professor"


# ----------------------------------------------------------------------------
# Rotas públicas
# ----------------------------------------------------------------------------


@app.get("/saude")
def saude():
    return {"ok": True}


@app.get("/")
def raiz():
    return RedirectResponse("/acesso", status_code=303)


@app.get("/acesso", response_class=HTMLResponse)
def acesso():
    links = garantir_links()
    base = base_url()
    corpo = f"""
    <div class='card'><h1>Atividade: Magnetismo e Transporte</h1>
    <p class='mut'>O celular precisa estar no <strong>mesmo Wi-Fi</strong> deste
    computador. Escaneie o QR do aluno:</p>
    <div class='qrgrid'>
    <figure><img src='/qr-aluno.png' width='220' height='220'
    alt='QR code do acesso do aluno'><figcaption><strong>Aluno</strong></figcaption></figure>
    </div>
    <p class='mut aviso'>Professor: o seu QR está no terminal do servidor e no arquivo
    <code>qr-professor.png</code> (não publique essa imagem aos alunos).</p>
    <p class='mut aviso'>Uso em sala (LGPD Art. 14): só nome/turma e notas. Sem
    e-mail, foto ou rastreamento.</p></div>"""
    _ = (links, base)  # links/QR do professor nunca aparecem nesta página pública
    return pagina("Acesso", corpo)


@app.get("/qr-aluno.png")
def qr_aluno():
    links = garantir_links()
    return Response(
        _qr_png(f"{base_url()}/a/{links['aluno']}"), media_type="image/png"
    )


# ----------------------------------------------------------------------------
# Aluno: atividade (link secreto; sem login; sem links de professor no HTML)
# ----------------------------------------------------------------------------


@app.get("/a/{tok}", response_class=HTMLResponse)
def atividade(request: Request, tok: str):
    if token_perfil(tok) != "aluno":
        return Response("Não encontrado.", status_code=404)
    corpo = """
    <div class='card'><h1>Atividade: Magnetismo e Transporte</h1>
    <p class='mut'>1) Escreva seu nome e turma. 2) Faça as 8 páginas em sequência.
    3) No fim, clique em <strong>Enviar meu progresso</strong> para o professor ver
    suas notas. O envio lê <em>neste navegador</em> as notas já calculadas pela
    atividade — nada é corrigido fora dela.</p>
    <div class='idlinha'><div><label for='nome'>Nome (ou apelido/número)</label>
    <input id='nome' autocomplete='off' maxlength='60'></div>
    <div><label for='turma'>Turma</label>
    <input id='turma' autocomplete='off' maxlength='20'></div></div>
    <p><button id='enviar' type='button'>Enviar meu progresso ao professor</button>
    <span id='envmsg' class='mut' role='status'></span></p></div>
    <iframe class='ativ' title='Atividade Magnetismo e Transporte'
    src='/h5p/dev/preview.html'></iframe>
    <script>(function() {
      var CHAVE_PREFIXO = 'h5p.magnetismo-transporte';
      var ATIVS = ['dragWords','singleChoice','memory','trueFalse'];
      var TOKEN = {token_json};
      try {
        document.getElementById('nome').value = localStorage.getItem('portal_nome') || '';
        document.getElementById('turma').value = localStorage.getItem('portal_turma') || '';
      } catch(e) {}
      function lerNotas() {
        var fontes = [];
        try { fontes.push(window.sessionStorage); } catch(e) {}
        try { fontes.push(window.localStorage); } catch(e) {}
        for (var f = 0; f < fontes.length; f++) {
          var st = fontes[f];
          for (var i = 0; i < st.length; i++) {
            var k = st.key(i);
            if (k && k.indexOf(CHAVE_PREFIXO) === 0) {
              try {
                var rec = JSON.parse(st.getItem(k));
                var estado = JSON.parse(rec.d);
                if (estado && estado.graded) return estado.graded;
              } catch(e) {}
            }
          }
        }
        return null;
      }
      document.getElementById('enviar').addEventListener('click', function() {
        var msg = document.getElementById('envmsg');
        var nome = document.getElementById('nome').value.trim();
        var turma = document.getElementById('turma').value.trim();
        if (!nome) { msg.textContent = 'Escreva seu nome antes de enviar.'; return; }
        try {
          localStorage.setItem('portal_nome', nome);
          localStorage.setItem('portal_turma', turma);
        } catch(e) {}
        var graded = lerNotas();
        if (!graded) { msg.textContent = 'Nenhum progresso neste navegador ainda.'; return; }
        var itens = ATIVS.filter(function(a) {
          return graded[a] && isFinite(Number(graded[a].pontuacaoObtida));
        });
        if (!itens.length) { msg.textContent = 'Nenhuma atividade concluída ainda.'; return; }
        msg.textContent = 'Enviando ' + itens.length + ' nota(s)...';
        var cadeia = Promise.resolve(0);
        itens.forEach(function(a) {
          cadeia = cadeia.then(function(n) {
            return fetch('/xapi/statements', {
              method: 'POST',
              headers: {'Content-Type': 'application/json', 'X-Token': TOKEN},
              body: JSON.stringify({atividade: a,
                nota: Number(graded[a].pontuacaoObtida), nome: nome, turma: turma})
            }).then(function(r) { return n + (r.ok ? 1 : 0); });
          });
        });
        cadeia.then(function(n) {
          msg.textContent = 'Enviado: ' + n + ' de ' + itens.length + ' nota(s).';
        }).catch(function() { msg.textContent = 'Falha de rede. Tente de novo.'; });
      });
    })();</script>""".replace("{token_json}", json.dumps(tok))
    # Visão do aluno: SÓ a atividade. Nenhum link de professor nem painel aqui.
    return _resposta_com_cookie(pagina("Atividade", corpo, "aluno"), tok)


# ----------------------------------------------------------------------------
# Arquivos do H5P (só com cookie de acesso válido; allowlist restrita)
# ----------------------------------------------------------------------------


@app.get("/h5p/{caminho:path}")
def h5p_statico(request: Request, caminho: str):
    if token_perfil(_cookie(request)) is None:
        return Response("Não encontrado.", status_code=404)
    if ".." in caminho or caminho.startswith("/") or not caminho.startswith(STATIC_PREFIXOS):
        return Response("Não encontrado.", status_code=404)
    if caminho.endswith((".db", ".ps1", ".env")):
        return Response("Não encontrado.", status_code=404)
    alvo = PROJETO_DIR.joinpath(*caminho.split("/")).resolve()
    try:
        alvo.relative_to(PROJETO_DIR.resolve())
    except ValueError:
        return Response("Não encontrado.", status_code=404)
    if not alvo.is_file():
        return Response("Não encontrado.", status_code=404)
    tipo = MIME.get(alvo.suffix.lower(), "application/octet-stream")
    return FileResponse(alvo, media_type=tipo, headers={"Cache-Control": "no-store"})


# ----------------------------------------------------------------------------
# Coleta: nota autodeclarada pelo navegador do aluno (com token + nome)
# ----------------------------------------------------------------------------


@app.post("/xapi/statements")
async def xapi_statements(request: Request):
    if token_perfil(_cookie(request)) != "aluno":
        return Response("Sem acesso.", status_code=401)
    try:
        dados = await request.json()
    except (ValueError, TypeError):
        return Response("JSON inválido.", status_code=400)
    if not hmac.compare_digest(
        str(request.headers.get("x-token", "")), str(_cookie(request))
    ):
        return Response("Token inválido.", status_code=400)
    atv = dados.get("atividade")
    if atv not in ATIVIDADES:
        return Response("Atividade desconhecida.", status_code=400)
    nome = str(dados.get("nome", "")).strip()[:60]
    turma = str(dados.get("turma", "")).strip()[:20]
    if not nome:
        return Response("Nome obrigatório.", status_code=400)
    try:
        nota = float(dados.get("nota"))
    except (TypeError, ValueError):
        return Response("Nota inválida.", status_code=400)
    meta = ATIVIDADES[atv]
    nota = max(0.0, min(float(meta["max"]), nota))
    agora = datetime.now(timezone.utc).isoformat()
    con = db()
    anterior = con.execute(
        "SELECT * FROM resultados WHERE nome=? AND turma=? AND atividade=?",
        (nome, turma, atv),
    ).fetchone()
    if anterior is None:
        con.execute(
            "INSERT INTO resultados (nome, turma, atividade, primeira_nota,"
            " ultima_nota, tentativas, origem, atualizado_em)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (nome, turma, atv, nota, nota, 1, "autodeclarado", agora),
        )
    else:
        con.execute(
            "UPDATE resultados SET ultima_nota=?, tentativas=tentativas+1,"
            " atualizado_em=? WHERE nome=? AND turma=? AND atividade=?",
            (nota, agora, nome, turma, atv),
        )
    con.execute(
        "INSERT INTO eventos (nome, turma, tipo, dados, criado_em) VALUES (?,?,?,?,?)",
        (nome, turma, f"completed:{atv}",
         json.dumps({"atividade": atv, "nota": nota, "max": meta["max"],
                     "origem": "autodeclarado"}, ensure_ascii=False), agora),
    )
    con.commit()
    con.close()
    return {"ok": True, "atividade": atv, "nota": nota}


# ----------------------------------------------------------------------------
# Professor (link secreto; nunca expõe gabarito — nem carregamos o banco)
# ----------------------------------------------------------------------------


def _alunos_e_notas(f_turma: str = "", busca: str = ""):
    con = db()
    pessoas = con.execute(
        "SELECT DISTINCT nome, turma FROM resultados ORDER BY turma, nome"
    ).fetchall()
    res = con.execute("SELECT * FROM resultados").fetchall()
    con.close()
    por_chave: dict[tuple, dict] = {}
    for r in res:
        por_chave.setdefault((r["nome"], r["turma"]), {})[r["atividade"]] = dict(r)
    lista = []
    for p in pessoas:
        if f_turma and p["turma"] != f_turma:
            continue
        if busca and busca.lower() not in ((p["nome"] + " " + p["turma"]).lower()):
            continue
        notas = por_chave.get((p["nome"], p["turma"]), {})
        total = sum(notas.get(a, {}).get("primeira_nota", 0) or 0 for a in ATIVIDADES)
        lista.append({"nome": p["nome"], "turma": p["turma"], "notas": notas, "total": total})
    turmas = sorted({p["turma"] for p in pessoas})
    return lista, turmas


def _q(nome: str, turma: str) -> str:
    return (
        "nome=" + urllib.parse.quote(nome, safe="") + "&turma=" + urllib.parse.quote(turma, safe="")
    )


@app.get("/p/{tok}", response_class=HTMLResponse)
def painel(request: Request, tok: str, turma: str = "", busca: str = ""):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    lista, turmas = _alunos_e_notas(turma.strip(), busca.strip())
    linhas = []
    for item in lista:
        cels = ""
        for a, meta in ATIVIDADES.items():
            n = item["notas"].get(a)
            if n:
                extra = (f" <span class='mut'>({n['tentativas']}x)</span>"
                         if n["tentativas"] > 1 else "")
                cels += f"<td>{(n['primeira_nota'] + 0):g}/{meta['max']}{extra}</td>"
            else:
                cels += "<td class='mut'>—</td>"
        feito = sum(1 for a in ATIVIDADES if a in item["notas"])
        linhas.append(
            f"<tr><td><a href='/p/{tok}/aluno?{_q(item['nome'], item['turma'])}'>"
            f"{esc(item['nome'])}</a></td><td>{esc(item['turma'])}</td>{cels}"
            f"<td><strong>{item['total']:g}/{TOTAL_MAX}</strong></td><td>{feito}/4</td></tr>"
        )
    medias = ""
    if lista:
        for a, meta in ATIVIDADES.items():
            vals = [it["notas"][a]["primeira_nota"] for it in lista if a in it["notas"]]
            medias += (f"<li>{esc(meta['rotulo'])}: {(sum(vals)/len(vals)):g}/{meta['max']}"
                       f" de média ({len(vals)}/{len(lista)} enviaram)</li>" if vals
                       else f"<li>{esc(meta['rotulo'])}: sem envios ainda</li>")
    corpo = f"""
    <div class='card'><h1>Painel da turma</h1>
    <p class='mut'>Notas <strong>autodeclaradas</strong> pelo navegador de cada aluno
    (botão “Enviar meu progresso”; nomes digitados pelos próprios alunos). A correção
    continua na atividade; a Fase 4 trará erros por questão/conceito e ranking de dúvidas.</p>
    <p><a class='btn sec' href='/p/{tok}/atividade'>Ver a atividade</a>
    <a class='btn sec' href='/p/{tok}/editar'>Editar conteúdo (Nível 1)</a>
    <a class='btn sec' href='/p/{tok}/csv'>Exportar CSV</a>
    <a class='btn sec' href='/p/{tok}/qr'>QR p/ celular</a></p>
    <form method='post' action='/p/{tok}/regerar' style='display:inline'>
    <input type='hidden' name='perfil' value='professor'>
    <button class='sec' type='submit'>Regenerar link do professor</button></form>
    <form method='post' action='/p/{tok}/regerar' style='display:inline'>
    <input type='hidden' name='perfil' value='aluno'>
    <button class='sec' type='submit'>Regenerar link do aluno</button></form>
    <p class='mut aviso'>Se o QR do professor vazar (foto, encaminhamento), regenere o
    link: o antigo para de funcionar.</p>
    <form method='get' action='/p/{tok}'>
    <label for='t'>Turma</label><select id='t' name='turma'>
    <option value=''>Todas</option>
    {''.join(f"<option value='{esc(t)}'{' selected' if t == turma else ''}>{esc(t or '(sem turma)')}</option>" for t in turmas)}
    </select>
    <label for='b'>Buscar aluno</label>
    <input id='b' name='busca' value='{esc(busca)}'>
    <p><button type='submit'>Filtrar</button></p></form></div>
    <div class='card'><table><thead><tr><th>Aluno</th><th>Turma</th>
    {''.join(f"<th>{esc(m['rotulo'])} ({m['max']})</th>" for m in ATIVIDADES.values())}
    <th>Total ({TOTAL_MAX})</th><th>Concluiu</th></tr></thead>
    <tbody>{''.join(linhas) if linhas else "<tr><td colspan='8' class='mut'>Sem envios ainda. Os alunos aparecem aqui depois de clicar em “Enviar meu progresso”.</td></tr>"}</tbody></table></div>
    <div class='card'><h2>Médias da turma</h2><ul>{medias or '<li class=mut>Sem dados.</li>'}</ul></div>
    <div class='card'><h2>Eixos temáticos (conceitos do banco)</h2><ul>
    {''.join(f"<li><strong>{esc(e)}</strong>: {esc(', '.join(c))}</li>" for e, c in EIXOS.items())}
    </ul><p class='mut aviso'>Agrupamento a confirmar com a equipe. O gabarito nunca
    aparece neste painel — só notas.</p></div>"""
    return _resposta_com_cookie(pagina("Painel da turma", corpo, "professor"), tok)


@app.get("/p/{tok}/aluno", response_class=HTMLResponse)
def aluno_detalhe(request: Request, tok: str, nome: str = "", turma: str = ""):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    nome, turma = nome.strip()[:60], turma.strip()[:20]
    con = db()
    notas = con.execute(
        "SELECT * FROM resultados WHERE nome=? AND turma=?", (nome, turma)
    ).fetchall()
    evs = con.execute(
        "SELECT tipo, criado_em FROM eventos WHERE nome=? AND turma=?"
        " ORDER BY id DESC LIMIT 50", (nome, turma)
    ).fetchall()
    con.close()
    if not notas and not evs:
        return Response("Aluno não encontrado.", status_code=404)
    por_a = {r["atividade"]: dict(r) for r in notas}
    linhas = ""
    for a, meta in ATIVIDADES.items():
        n = por_a.get(a)
        linhas += (f"<tr><td>{esc(meta['rotulo'])} (p. {meta['pagina']})</td>"
                    f"<td>{n['primeira_nota']:g}/{meta['max']}</td>"
                    f"<td>{n['ultima_nota']:g}</td><td>{n['tentativas']}</td>"
                    f"<td class='mut'>{esc(n['atualizado_em'][:16])}</td></tr>" if n
                    else f"<tr><td>{esc(meta['rotulo'])}</td><td colspan='4' class='mut'>sem envio</td></tr>")
    ev_linhas = "".join(
        f"<li><code>{esc(e['tipo'])}</code> <span class='mut'>{esc(e['criado_em'][:16])}</span></li>"
        for e in evs) or "<li class='mut'>Sem eventos.</li>"
    corpo = f"""
    <div class='card'><p><a href='/p/{tok}'>← Voltar ao painel</a></p>
    <h1>{esc(nome)}</h1><p class='mut'>turma {esc(turma or '—')}</p>
    <table><thead><tr><th>Atividade</th><th>1ª nota (vale)</th><th>Última</th>
    <th>Envios</th><th>Atualizado</th></tr></thead><tbody>{linhas}</tbody></table></div>
    <div class='card'><h2>Eventos recentes</h2><ul>{ev_linhas}</ul></div>"""
    return _resposta_com_cookie(pagina(f"Aluno {nome}", corpo, "professor"), tok)


@app.get("/p/{tok}/api")
def api_turma(tok: str, turma: str = ""):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    lista, _ = _alunos_e_notas(turma.strip())
    return {
        "total_max": TOTAL_MAX,
        "alunos": [
            {"nome": it["nome"], "turma": it["turma"], "total_primeira": it["total"],
             "notas": {a: (it["notas"].get(a) or {}).get("primeira_nota") for a in ATIVIDADES}}
            for it in lista
        ],
    }


@app.get("/p/{tok}/csv")
def exportar_csv(tok: str, turma: str = ""):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    lista, _ = _alunos_e_notas(turma.strip())
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["nome", "turma", *[f"{a}_primeira" for a in ATIVIDADES], "total_primeira"])
    for it in lista:
        w.writerow([it["nome"], it["turma"],
                    *[((it["notas"].get(a) or {}).get("primeira_nota", "")) for a in ATIVIDADES],
                    it["total"]])
    return Response(buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=turma.csv"})


@app.get("/p/{tok}/atividade", response_class=HTMLResponse)
def atividade_prof(tok: str):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    corpo = f"""
    <div class='card'><p><a class='btn sec' href='/p/{tok}'>← Voltar ao painel</a></p>
    <h1>Atividade (visão do professor)</h1>
    <p class='mut'>Igual à do aluno. Envios feitos aqui ficam registrados com nome
    “Professor” — prefira fazer a atividade como aluno para testar.</p></div>
    <iframe class='ativ' title='Atividade Magnetismo e Transporte'
    src='/h5p/dev/preview.html'></iframe>"""
    return _resposta_com_cookie(pagina("Atividade", corpo, "professor"), tok)


@app.get("/p/{tok}/editar", response_class=HTMLResponse)
def editar(tok: str):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    pacote = (PROJETO_DIR / "dist" / "magnetismo-transporte.h5p").exists()
    corpo = f"""
    <div class='card'><p><a href='/p/{tok}'>← Voltar ao painel</a></p>
    <h1>Editar conteúdo (Nível 1)</h1>
    <p class='mut'>Textos, vídeos, audiodescrições e opções ficam no editor H5P
    (Lumi Desktop ou Moodle). O banco de questões (Nível 2, nesta tela no futuro)
    continua em <code>authoring/banco-de-questoes.json</code> + build.</p>
    <p>{f'<a class="btn" href="/p/{tok}/pacote">Baixar .h5p atual</a>' if pacote else '<span class=mut>Pacote .h5p ainda não gerado (rode o build na pasta do projeto).</span>'}</p>
    <p class='mut aviso'>Nenhum link desta página existe na visão do aluno.</p></div>"""
    return _resposta_com_cookie(pagina("Editar conteúdo", corpo, "professor"), tok)


@app.get("/p/{tok}/pacote")
def baixar_pacote(tok: str):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    alvo = PROJETO_DIR / "dist" / "magnetismo-transporte.h5p"
    if not alvo.is_file():
        return Response("Pacote não gerado.", status_code=404)
    return FileResponse(alvo, media_type="application/octet-stream",
                        filename="magnetismo-transporte.h5p")


@app.get("/p/{tok}/qr", response_class=HTMLResponse)
def qr_tela(tok: str):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    links = garantir_links()
    base = base_url()
    corpo = f"""
    <div class='card'><p><a href='/p/{tok}'>← Voltar ao painel</a></p>
    <h1>QR codes para o celular</h1>
    <p class='mut'>Mesmo Wi-Fi do computador. Mostre/imprima só o do aluno.</p>
    <div class='qrgrid'>
    <figure><img src='/qr-aluno.png' width='220' height='220'
    alt='QR code do acesso do aluno'><figcaption><strong>Aluno</strong>
    <br><code class='url'>{esc(base)}/a/…</code></figcaption></figure>
    <figure><img src='data:image/png;base64,{_qr_base64(base + "/p/" + links["professor"])}'
    width='220' height='220' alt='QR code do acesso do professor'>
    <figcaption><strong>Professor (não repasse)</strong></figcaption></figure>
    </div></div>"""
    return _resposta_com_cookie(pagina("QR codes", corpo, "professor"), tok)


def _qr_base64(url: str) -> str:
    import base64
    return base64.b64encode(_qr_png(url)).decode()


@app.post("/p/{tok}/regerar")
def regerar_link(tok: str, perfil: str = Form("")):
    if not exige_professor(tok):
        return Response("Não encontrado.", status_code=404)
    if perfil not in ("professor", "aluno"):
        return Response("Perfil inválido.", status_code=400)
    novo = regenerar(perfil)
    atualizar_qrs()
    print(f"[portal] link {perfil} regenerado", flush=True)
    if perfil == "professor":
        return RedirectResponse(f"/p/{novo}", status_code=303)
    return RedirectResponse(f"/p/{tok}", status_code=303)


# ----------------------------------------------------------------------------
# Erros simples
# ----------------------------------------------------------------------------


@app.exception_handler(404)
def h404(request: Request, exc):
    return HTMLResponse(
        pagina("Não encontrado",
               "<div class='card'><h1>Não encontrado</h1>"
               "<p><a href='/acesso'>Acesso</a></p></div>"),
        status_code=404,
    )


if __name__ == "__main__":
    import uvicorn
    urls = atualizar_qrs()
    print(f"[portal] aluno:     {urls['aluno']}", flush=True)
    print(f"[portal] professor: {urls['professor']}  (não repasse)", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=PORT)
