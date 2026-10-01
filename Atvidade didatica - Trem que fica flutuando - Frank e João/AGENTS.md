# AGENTS.md

Custom H5P content type `H5P.MagnetismoTransporte` 2.3.0 ("Magnetismo e Transporte"): 9-page Physics activity in plain JS/CSS, no framework, bundler, npm, Node, or git. Env: PowerShell 5.1, Python, Chrome. UI in pt-BR, en-US and es-ES; code comments in English.

## Commands

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1          # http://localhost:8080/dev/preview.html
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1 -Mock    # with test tools (?mock=1)
powershell -ExecutionPolicy Bypass -File .\scripts\build-h5p.ps1        # regenerates bank.js + css/themes/ -> dist/magnetismo-transporte.h5p + .sha256
powershell -ExecutionPolicy Bypass -File .\scripts\validate-h5p.ps1     # run after every build
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-banco.ps1      # only regenerate sealed bank
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-temas.ps1      # only regenerate css/themes/ from designs/
```

Order matters: `build` always regenerates the bank first; `validate` checks metadata, declared JS/CSS, video URLs, and plaintext-answer leaks. Never open `dev/preview.html` via `file://` — YouTube blocks some embeds without a Referer.

No test suite. Verify with a scratch HTML harness in headless Chrome (`--dump-dom` for logic, `--screenshot` for visuals; 375px iframe for mobile). Workflow is in `.claude/skills/h5p-frontend/SKILL.md`.

## Architecture (non-obvious)

- `h5p-src/H5P.MagnetismoTransporte/library.json` is the single load order for all JS/CSS — build and `dev/preview.html` read it. Add new files only there; order matters.
- No modules/bundler: each JS file is an IIFE hanging off `H5P.MagnetismoTransporte`. `js/app.js` loads last and replaces it with the class (controller in closure; only `PAGES`/`TOTAL_MAX` re-exposed).
- One page per file in `js/pages/` following the contract in `docs/arquitetura.md` (`id` 1..N no gaps, `render(app, section)`, `actions` via delegated `data-action`). Duplicate action names fail the load.
- Rendering is `innerHTML` + delegated listeners. Exception: magnet lab mutates its SVG in place during drag (keeps pointer capture); only the guide re-renders. Hidden sections are emptied so video stops.
- State: key `<storageKey>:v<SCHEMA_VERSION>:cid-<contentId>` (SCHEMA_VERSION 5), signed `{d, s}` record — hand-edited records are discarded. Preview (`developer-preview`) uses `sessionStorage`: new tab = fresh random draw (new student); same-tab reload keeps it. Lumi/LMS use `localStorage`. New state field must go in **both** `createDefaultState()` and `hydrate()` in `js/core/storage.js` or it is dropped on reload. Bumping `SCHEMA_VERSION` wipes saved progress.
- Languages: `L(pt, en, es)` in `js/core/i18n.js` — **every** inline string passes all three, no 2-argument calls left. Sealed bank text arrives as `question`/`questionEn`/`questionEs` (`I18n.field`) and `pt<0x1e>en<0x1e>es` inside the seal (`I18n.payload`), so `gerar-banco.ps1` must emit `...Es` fields and join three parts. Missing translations fall back to Portuguese, never to each other.
- Page 8 is the open-ended essay (5 pts) and page 9 is the results panel. Its grading is deterministic and offline: `js/core/essay.js` evaluates the text against the rubric sealed in `js/data/bank.js` (`Rubrica.referencias`, `Rubrica.conceitos`, `Rubrica.relacoes`, `Rubrica.contradicoes`); the source of truth is `authoring/rubrica-dissertativa.json`, **outside** the package, same as the question bank. The rubric, reference answers and per-concept feedback are sealed, so `sanitizeEvaluation()` in `js/core/storage.js` deliberately strips them out of what is saved — the page re-opens them from the live rubric on every render. Never store a seal or a reference answer in `state.tasks.essay.evaluated`.
- Essay state: `text` (single line, 2000 chars), `submitted`, `attempts`, `evaluated` (`score`, `confidence`, `needsReview`, `concepts[]`, `relations[]`, `contradictions[]`). A score is never recomputed on load; it is replayed from `graded.essay`, so `allowed` in `js/core/storage.js` **must** list `'essay'` or the score silently disappears on reload.
- The magnet lab is variable-size: `Physics.positions(count)` places 2–10 magnets equidistantly on an ellipse, default 2. Positions are **derived**, never stored; only `count` + `angles` live in state. Adding a magnet can break an achieved alignment, so `missions.aligned` is recomputed.

## Invariants that break easily

- Answers never ship in plaintext. Edit `authoring/banco-de-questoes.json` (outside package), never `js/data/bank.js` (generated). Nothing in DOM, saved state, or public API may reveal answers early; scores are recomputed from the sealed key. Never change `salt` while in use.
- A translation file is a **plaintext answer key** in the same sense the Portuguese one is: `authoring/banco-de-questoes.es.json` must stay outside the package, and `validate-h5p.ps1` only scans `.json` and `.en.json` for leaks — a new `authoring/*.es.json` is not checked automatically. It works only because the seal wraps the three languages together in `bank.js`.
- `cyrb`/`keystream` in `js/core/util.js` must stay byte-identical to the C# port in `scripts/gerar-banco.ps1`.
- External loads: only YouTube (`youtube-nocookie.com`) and VLibras, both after a student click. No web fonts, CDNs, remote icons.
- Video URLs in `content/content.json` have hardcoded checks in `validate-h5p.ps1` — update both together. Keep `dev/preview.js` in sync with `content.json`. Every video needs a truthful `media.*VideoDescription` (only what the video shows/says).
- Packaging: inside the .h5p the library folder is versioned (`H5P.MagnetismoTransporte-2.3/`); the source tree stays unversioned. Only `major.minor` reach the folder name, so a patch bump does not rename it. JS never in `content/`; `h5p-src/LICENSE` stays out of the zip; only H5P-allowed extensions. `h5p.json`: `licenseExtras` is a string, `changes` dates are `dd-mm-aa hh:mm:ss`. Version bump touches `library.json`, `h5p.json` (dependency + `changes`), `js/core/xapi.js` (`LIBRARY`), `dev/preview.js`, `README.md` — **not** `validate-h5p.ps1`, which derives the expected folder from `library.json` (`:77-80`).
- CSS trap: `.mt-howto` means "numbered checklist" in `css/pages/intro.css` AND "details block" in `css/pages/memory.css`. Reusing the name in a third place double-draws the counters; an `<ol>` needs `list-style: none` plus its own `counter-reset`.
- Navigation is sequential by design: stepper is display-only (never clickable), `refreshUnlocks()` only ever increases `unlockedPage`. Page 6 unlocks 7 by visit (video not required) but UI must never say the video is optional.
- Skip: vocab blank and lab question unlock "Pular" only after 3 wrong tries on that item (`SKIP_AFTER_TRIES` in `js/core/activities.js`, `UI.skipButton()`); quiz and true/false have no skip; the memory game (YouTube page) skip is always on and counts as one try without a hit. A skip records wrong + concept error and reveals the answer only after locking. Never reveal correct options on a plain wrong answer (lab retry relies on it).

## Profiles Professor/Aluno (lives in `../portal-perfis/`, not here)

- Cannot be done inside H5P alone: no server (per-browser storage), JS passwords are readable, xAPI is anonymous score-only. Login/dashboard belongs in an LMS (Moodle) or the separate portal folder `../portal-perfis/`; never inside `h5p-src/`; the `.h5p` must keep working standalone in Lumi.
- External skill stock (outside repo, not committed: `Desktop\Skills\Skills-Frontend\skills-perfis\` + `Desktop\Skills\Skills-Frontend-Documentacao\PLANEJAMENTO-PERFIS.md`), installed with `Desktop\Skills\Skills-Frontend\instalar-skill.ps1 -Colecao perfis -Pacote <perfis-essencial|perfis-backend|perfis-revisao> -Projeto <dir>`. Install `magnetismo-perfis` first — it maps task→skill and documents the threat model (deny-by-default server-side authz on every route, LGPD minimum, `.h5p` standalone).
- Portal access is by secret per-profile links, no login (`../portal-perfis/`, FastAPI+SQLite): the QR code IS the credential (`/a/<token>` aluno, `/p/<token>` professor). Never publish `qr-professor.png` to students; regen links from the panel if one leaks. Students self-identify by typed nome/turma and scores are `autodeclarado` — never treat them as tamper-proof; never show the sealed bank or per-question answers on any route.
- Never overwrite this repo's `.claude/skills/frontend-design` with the stock version of the same name; never use Tailwind/React/CDN/web-font skills here.

## Phone access / QR codes

- `scripts/preview.ps1` listens on `http://localhost` only, so a QR of that URL never opens on a phone. Phone access goes through the portal (`../portal-perfis/`, binds `0.0.0.0`): professor QR → `/p/<token>`, aluno QR → `/a/<token>` (secret links, no login); keep teacher routes out of the student URL. Details in `../portal-perfis/README.md`.

## Conventions

- Read `.claude/skills/h5p-frontend/SKILL.md` before any UI/CSS work. Use `mt-*` classes, `is-*` states, `h5p-mt-` DOM ids, semantic tokens in `css/base.css` (never raw colors), `app.resize()` after layout changes. Dynamic text via `escapeHtml()`. Call `app.heading()` / `UI.pageHeading()`.
- Themes: the header "Aparência" button (`js/ui/themes.js`, `state.theme`, `behaviour.themes`) switches `data-mt-theme` on `.h5p-mt` and `.h5p-mt-host`. "Padrão" (no attribute) is the original design and the default. `css/themes/*.css` is generated from `designs/<n>-<id>/tema.css` by `gerar-temas.ps1`; never edit it by hand. A new component with a fixed colour may need a rule in each `designs/*/tema.css`.
- Files UTF-8 LF; PowerShell scripts have BOM (PS 5.1 accents). Editing accented Portuguese from a shell is a trap: PowerShell 5.1 reads these as ANSI and `-replace` treats the pattern as a regex, so use a Python script with explicit `\uXXXX` escapes to touch `.md` files. Which file to change: `docs/organizacao-do-codigo.md`.
- **The `.h5p` is reproducible, and that is a contract, not a happy accident.** Two things make it true, and both are easy to break silently:
  1. `.gitattributes` at the repo root pins `* text=auto eol=lf`. Without it, `core.autocrlf=true` on Windows checks the sources out with CRLF, those bytes go into the zip, and the hash changes on a different machine than yours.
  2. `build-h5p.ps1` writes a fixed `1980-01-01` timestamp into every zip entry instead of the file's mtime, and sorts entries by path.
  So: after touching any packaged file, `build-h5p.ps1` must produce the **same** SHA-256 if the content did not change. If it does not, something non-deterministic crept in — check for a stray `Set-Content`/editor write with CRLF, or an unsorted `Get-ChildItem`. Verify with two consecutive builds plus a `Get-ChildItem -Recurse | % { $_.LastWriteTime = Get-Date }` in between.
- `git checkout-index --all --force` does **not** undo CRLF: it skips files whose stat entry looks current. Use the per-path form, or normalise the bytes in place. On Windows remember the folder name is accented, so `git ls-files` needs `-c core.quotepath=false` before its output is usable as a literal path.
- No test suite and no CI. The only real regression check is headless Chrome over `preview.ps1`: `Runtime.exceptionThrown` must be empty and each `L()` call must have 3 arguments. Console errors are how the lab bug (`placed is not defined` in `updateScene`) surfaced — always read them.
- Docs on demand (don't auto-load): `docs/contexto.md` before content/behaviour changes; `docs/arquitetura.md` before JS; `docs/seguranca.md` before questions/scores/state; `docs/acessibilidade.md` before video/a11y; `docs/stack.md` for tooling/packaging. `CLAUDE.md` duplicates some of this for Claude Code.
