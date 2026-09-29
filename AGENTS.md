# AGENTS.md

Two packages, no git/CI/Node (`opencode.json` absent). Env: PowerShell 5.1, Python 3.14, Chrome. Paths contain spaces and accents — always quote them; run each package's scripts from inside its own folder.

- `Atvidade didatica - Trem que fica flutuando - Frank e João/` — H5P content type `H5P.MagnetismoTransporte` 2.2.1 (plain JS/CSS, no framework/bundler). Rules: `AGENTS.md` inside it.
- `portal-perfis/` — FastAPI + SQLite classroom portal (secret QR-code links, no login). Rules: `README.md` inside it.

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
powershell -ExecutionPolicy Bypass -File .\iniciar-portal.ps1         # 0.0.0.0:8000, prints secret links + QRs
python gerar-qrcodes.py                                               # regen qr-*.png from the live tokens
```

## Boundaries (violating these breaks something)

- Portal only READS the H5P folder (`dev/`, `h5p-src/`, `designs/` — allowlist in `portal-perfis/app.py`); never write H5P files from portal work, and never put portal/auth code in `h5p-src/` — the `.h5p` must keep opening standalone in Lumi.
- `authoring/` (plaintext answer key) is never served; answers stay sealed (`js/data/bank.js` is generated, never hand-edited).
- Portal access is secret per-profile links (`/a/<token>` aluno, `/p/<token>` professor); bad token → 404 by design. Never publish `qr-professor.png`; regen links from the panel if one leaks.
- `portal-perfis/portal.db` holds the live tokens — deleting it desyncs `qr-*.png`; regen the QRs afterwards.

## Verify

- H5P: `validate-h5p.ps1` (metadata, declared JS/CSS, video URLs, plaintext-answer leaks); visuals via headless-Chrome screenshots.
- Portal: no committed test suite; boot it and hit `/saude`, `/acesso`, and both secret links.

## Key Architecture Notes (Non-Obvious)

### H5P Package
- `h5p-src/H5P.MagnetismoTransporte/library.json` is the single load order for all JS/CSS — build and `dev/preview.html` read it. Add new files only there; order matters.
- No modules/bundler: each JS file is an IIFE hanging off `H5P.MagnetismoTransporte`. `js/app.js` loads last and replaces it with the class (controller in closure; only `PAGES`/`TOTAL_MAX` re-exposed).
- State key: `<storageKey>:v<SCHEMA_VERSION>:cid-<contentId>` (SCHEMA_VERSION 4), signed `{d, s}` record — hand-edited records discarded. Preview uses `sessionStorage` (new tab = fresh draw); Lumi/LMS use `localStorage`. New state field must go in **both** `createDefaultState()` and `hydrate()` in `js/core/storage.js` or it is dropped on reload. Bumping `SCHEMA_VERSION` wipes saved progress.
- Version bump touches: `library.json`, `h5p.json` (dependency + `changes`), `js/core/xapi.js` (`LIBRARY`), `validate-h5p.ps1`, `dev/preview.js`.

### Portal Package
- No login system — QR code IS the credential (144-bit token). Cookie `HttpOnly` + `SameSite=LaX`; double token on submit (`X-Token` header).
- Scores are `autodeclarado` (self-declared name/class) — never treat as tamper-proof.
- No HTTPS; LAN-only. For institutional use with minors, use LMS (Moodle) with proper auth + HTTPS.

## Critical Invariants

- **Answers never ship in plaintext.** Edit `authoring/banco-de-questoes.json` (outside package), never `js/data/bank.js` (generated). Nothing in DOM, saved state, or public API may reveal answers early; scores recomputed from sealed key. Never change `salt` while in use.
- `cyrb`/`keystream` in `js/core/util.js` must stay byte-identical to the C# port in `scripts/gerar-banco.ps1`.
- External loads: only YouTube (`youtube-nocookie.com`) and VLibras, both after student click. No web fonts, CDNs, remote icons.
- Video URLs in `content/content.json` have hardcoded checks in `validate-h5p.ps1` — update both together. Keep `dev/preview.js` in sync with `content.json`.
- Navigation is sequential: stepper is display-only (never clickable), `refreshUnlocks()` only increases `unlockedPage`. Page 6 unlocks 7 by visit (video not required) but UI must never say video is optional.
- Skip rules: vocab blank and lab question unlock "Pular" after 3 wrong tries (`SKIP_AFTER_TRIES` in `js/core/activities.js`); quiz and true/false have no skip; memory game skip always on. A skip records wrong + concept error, reveals answer only after locking.

## Documentation References (Read on Demand)

- H5P: `docs/contexto.md` (pedagogical), `docs/arquitetura.md` (JS), `docs/seguranca.md` (anti-cheat), `docs/acessibilidade.md` (video/a11y), `docs/stack.md` (tooling/packaging), `docs/organizacao-do-codigo.md` (file map).
- Portal: `portal-perfis/README.md` for routes, QR flow, privacy (LGPD Art. 14), security model.
- Skills: `.claude/skills/h5p-frontend/SKILL.md` for UI/CSS work (tokens, `mt-*` components, screenshot verification). Portal skills in `.claude/skills/` (`magnetismo-perfis`, `owasp-security`, `api-authentication`, `csrf-protection`, `children-data-minimization`).