# AGENTS.md

Three work areas in one git repo (branch `main`), no CI, no lint/typecheck, no test suite anywhere. Env: PowerShell 5.1, Python 3.14 (global, no venv), Chrome. Paths contain spaces and accents — always quote them and run each area's scripts from inside its own folder.

- `Atvidade didatica - Trem que fica flutuando - Frank e João/` — H5P content type `H5P.MagnetismoTransporte` 2.3.0 (plain JS/CSS, no framework/bundler/npm). Rules: `AGENTS.md` inside it.
- `portal-perfis/` — FastAPI + SQLite classroom portal (secret QR links, no login). Rules: `README.md` inside it.
- `docs-apresentacao/` — **gitignored**, local-only. Node (`pptxgenjs`, `docx`) + Python QA. Generates the delivery deck/report from `slides/compile.js` + `slides/relatorio.js`; QA with `slides/qa.py`, `slides/qa_docx.py`, `slides/dump.py`. Never commit it; never let it become a dependency of the two packages above.
- `Melhorias futuras/` — **gitignored**, local-only research/spec notes (not implemented). Never commit it and never treat it as a spec: the code is the source of truth.

## Commands

```powershell
# H5P (from its folder)
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1        # http://localhost:8080/dev/preview.html (localhost only!)
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1 -Mock  # with test tools (?mock=1)
powershell -ExecutionPolicy Bypass -File .\scripts\build-h5p.ps1      # bank.js + themes -> dist/*.h5p + .sha256
powershell -ExecutionPolicy Bypass -File .\scripts\validate-h5p.ps1   # run after every build
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-banco.ps1    # only regenerate sealed bank
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-temas.ps1    # only regenerate css/themes/ from designs/

# Portal (from its folder)
python app.py                                          # 0.0.0.0:8000 + PRINTS the secret links
powershell -ExecutionPolicy Bypass -File .\iniciar-portal.ps1   # 0.0.0.0:8000, prints NOTHING useful
python gerar-qrcodes.py                                # regen qr-*.png from the live tokens
```

`iniciar-portal.ps1` claims at line 31 that the links appear "below" — **they do not.** It runs `python -m uvicorn app:app`, so `__name__ == "app"` and the `if __name__ == "__main__"` block (`app.py:767`) never runs. That block is the only printer *and* the only caller of `atualizar_qrs()`, so normal startup never refreshes `qr-*.png` either. Use `python app.py` when you need the links or regenerated QRs.

## Boundaries (violating these breaks something)

- The essay's rubric, reference answers and per-concept feedback are sealed in `bank.js`; nothing plaintext. `sanitizeEvaluation()` strips seals and references out of what is saved, so the page re-opens them from the live rubric. Editing the essay means editing `authoring/rubrica-dissertativa.json` and re-running `build-h5p.ps1` (which regenerates the bank).
- Portal only READS the H5P folder — allowlist `STATIC_PREFIXOS = ("dev/", "h5p-src/", "designs/")` in `app.py:85`, enforced with traversal containment at `app.py:426-440`. `authoring/` (plaintext answer key) is deliberately excluded. It has zero write paths into that folder. Never add one, and never put portal/auth code in `h5p-src/` — the `.h5p` must keep opening standalone in Lumi.
- `app.py:43` hardcodes the accented folder name in `PROJETO_DIR`. Renaming/moving the H5P folder silently breaks `/h5p/*` and `/p/<tok>/pacote`.
- **The portal serves `dev/preview.html`, not the built `.h5p`** (`app.py:355`, `:681`). That is why the allowlist exists and why students score through `sessionStorage` under preview mode.
- `authoring/` holds the plaintext answer key and **is committed**. It must stay out of the built package and out of any public repo — `validate-h5p.ps1` fails the build if it ever lands inside the `.h5p`. `js/data/bank.js` is generated — never hand-edit it.
- `COMO-COMMITAR.md` was **deleted on purpose** (commit `c77c225`, on `main`). Do not bring it back; the build→validate→commit sequence it described is in the Commands section above.
- Portal access is secret per-profile links (`/a/<token>` aluno, `/p/<token>` professor), 192-bit (`secrets.token_urlsafe(24)`, `app.py:164`), stored plaintext in `portal.db`; a bad token → 404 by design. `POST /xapi/statements` is the one route that answers 401 instead.
- **`qr-professor.png` and `qr-aluno.png` are already committed to git** — the live professor credential is in history. Treat it as compromised: `POST /p/<tok>/regerar` (or `python gerar-qrcodes.py`) and add them to `portal-perfis/.gitignore`. Never share `qr-professor.png` with students.
- Deleting `portal-perfis/portal.db` mints brand-new tokens and orphans both PNGs — nothing warns you. Regen the QRs right after.

## Verify

- H5P: `build-h5p.ps1` then `validate-h5p.ps1` (metadata, declared JS/CSS, video URLs, plaintext-answer leaks; last line must say the answer key is sealed). Visuals via headless-Chrome screenshots.
- Portal: boot and hit `/saude`, `/acesso`, and both secret links. **Use two browser profiles** — one cookie name (`portal_acesso`, `app.py:47`) holds both roles, so opening `/p/<tok>` overwrites the aluno cookie and breaks the student flow.
- Never commit: run `git status` and confirm `git add -A --dry-run` picks up no `portal.db`, `*.h5p` churn, or `docs-apresentacao/`.

## Key Architecture Notes (Non-Obvious)

### H5P Package
- `h5p-src/H5P.MagnetismoTransporte/library.json` is the single load order for all JS/CSS — build and `dev/preview.html` read it. Add new files only there; order matters.
- No modules/bundler: each JS file is an IIFE hanging off `H5P.MagnetismoTransporte`. `js/app.js` loads last and replaces it with the class (controller in closure; only `PAGES`/`TOTAL_MAX` re-exposed).
- State key: `<storageKey>:v<SCHEMA_VERSION>:cid-<contentId>` (SCHEMA_VERSION 5; the essay key is additive, so it did not need a bump), signed `{d, s}` record — hand-edited records discarded. Preview uses `sessionStorage` (new tab = fresh draw); Lumi/LMS use `localStorage`. New state field must go in **both** `createDefaultState()` and `hydrate()` in `js/core/storage.js` or it is dropped on reload. Bumping `SCHEMA_VERSION` wipes saved progress.
- Version bump touches: `library.json`, `h5p.json` (dependency + `changes`), `js/core/xapi.js` (`LIBRARY`), `validate-h5p.ps1`, `dev/preview.js`.

### Portal Package
- No login system — QR code IS the credential. The `usuarios`/`login_tentativas` tables are dropped at startup (`app.py:114-115`); the login model was deleted.
- Cookie `HttpOnly` + `SameSite=Lax` (no `Secure`, no signing), 12 h. The `X-Token` check is a cookie-echo (`hmac.compare_digest` against the cookie, `app.py:456`), not a stored nonce — page JS embeds the token from the URL path.
- `/h5p/*` accepts **either** profile's cookie (`app.py:426`), by design: the professor's "Ver a atividade" iframe needs it. Every other route checks its own role.
- Scores are `autodeclarado` (self-declared name/class, hardcoded literal at `app.py:133`) — never treat as tamper-proof. Nothing rate-limited, no CORS, API docs disabled (`app.py:225`). No HTTPS; LAN-only. For institutional use with minors, use LMS (Moodle) with proper auth + HTTPS.

## Cross-Package Contract (breaks silently)

The portal scrapes the student's browser for scores instead of validating them: `app.py:357-382` iterates **all** storage keys prefixed `h5p.magnetismo-transporte`, `JSON.parse`s `rec.d`, and reads `estado.graded[id].pontuacaoObtida`. It never checks `s` and never recomputes anything.

- Change the graded activity ids (`dragWords` / `singleChoice` / `memory` / `trueFalse` / `essay` — the essay is worth 5, `TOTAL_MAX` is 20), their `max` values, or the storage-key prefix in `dev/preview.js:31`, and you must mirror it in `ATIVIDADES` at `app.py:67-73`. Otherwise `/xapi/statements` returns `400 "Atividade desconhecida."` — or, worse, keeps accepting while reporting zero.
- `EIXOS` (`app.py:75`) mirrors the `concept` field of `authoring/banco-de-questoes.json`; keep them aligned.
- Students must submit from the **same tab** they did the activity in (preview mode is `sessionStorage`).

## Critical Invariants

- **Answers never ship in plaintext.** Edit `authoring/banco-de-questoes.json` (outside the package), never `js/data/bank.js` (generated). Nothing in DOM, saved state, or public API may reveal answers early; scores recomputed from sealed key. Never change `salt` while in use.
- `cyrb`/`keystream` in `js/core/util.js` must stay byte-identical to the C# port in `scripts/gerar-banco.ps1`.
- External loads: only YouTube (`youtube-nocookie.com`) and VLibras, both after student click. No web fonts, CDNs, remote icons.
- Video URLs in `content/content.json` have hardcoded checks in `validate-h5p.ps1` — update both together. Keep `dev/preview.js` in sync with `content.json`.
- Navigation is sequential: stepper is display-only (never clickable), `refreshUnlocks()` only increases `unlockedPage`. Page 6 unlocks 7 by visit (video not required) but UI must never say video is optional.
- Skip rules: vocab blank and lab question unlock "Pular" after 3 wrong tries (`SKIP_AFTER_TRIES` in `js/core/activities.js`); quiz and true/false have no skip; memory game skip always on. A skip records wrong + concept error, reveals answer only after locking.

## Stale Docs — Do Not Trust Blindly

- `portal-perfis/.claude/skills/magnetismo-perfis/SKILL.md` still documents the deleted login model (`Professor@123` / `Aluno@123`), `Secure` cookies, argon2 hashing, and a `/professor/*` dashboard. None of that shipped. The code is the source of truth.

## Documentation References (Read on Demand)

- H5P: `docs/contexto.md` (pedagogical), `docs/arquitetura.md` (JS), `docs/seguranca.md` (anti-cheat), `docs/acessibilidade.md` (video/a11y), `docs/stack.md` (tooling/packaging), `docs/organizacao-do-codigo.md` (file map).
- Portal: `portal-perfis/README.md` for routes, QR flow, privacy (LGPD Art. 14), security model.
- Skills live per-package, not at the repo root: `Atvidade didatica.../.claude/skills/h5p-frontend/SKILL.md` for UI/CSS work (tokens, `mt-*` components, screenshot verification); portal skills in `portal-perfis/.claude/skills/`.