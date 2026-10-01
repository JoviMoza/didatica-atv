# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Magnetismo e Transporte" is a custom H5P content type (`H5P.MagnetismoTransporte` 2.3.0): a 9-page high-school Physics activity about magnets, electromagnets and Maglev trains. It is written in plain JavaScript and CSS, with no framework, bundler or npm, and is packaged as a `.h5p` for Lumi. The UI is in Brazilian Portuguese; code comments are in English. The repo is not under git, and Node.js is not installed; PowerShell 5.1, Python and Chrome are available.

Read on demand (not auto-loaded, to save context):
- `docs/contexto.md`: pedagogical decisions requested by the team, verified facts, version history, open items. **Read before changing content or behaviour.**
- `docs/arquitetura.md`: module map, page-module contract, state and persistence, navigation, rendering model, random quizzes, xAPI, magnet-lab physics.
- `docs/seguranca.md`: anti-cheat design (sealed answer key, signed storage) and its limits. **Read before touching questions, answers, scores or saved state.**
- `docs/organizacao-do-codigo.md`: which file to change for each kind of change.
- `docs/acessibilidade.md`: VLibras, video captions and audio descriptions, and what is still untested.
- `docs/stack.md`: tooling and H5P/Lumi packaging rules.
- For any UI/CSS work, use the `h5p-frontend` skill (`.claude/skills/h5p-frontend/`), which covers tokens, `mt-*` components, accessibility and the screenshot verification workflow.

## Commands

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-h5p.ps1      # regenerates js/data/bank.js and css/themes/, then -> dist/magnetismo-transporte.h5p + .sha256
powershell -ExecutionPolicy Bypass -File .\scripts\validate-h5p.ps1   # metadata, declared JS/CSS, video URLs, no plain-text answers
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-banco.ps1    # only regenerate the sealed question bank
powershell -ExecutionPolicy Bypass -File .\scripts\gerar-temas.ps1    # only regenerate css/themes/ from designs/
powershell -ExecutionPolicy Bypass -File .\scripts\preview.ps1 -Mock  # http://localhost:8080/dev/preview.html with test tools
```

There is no test suite. Verify changes with a scratch HTML harness in headless Chrome (`--dump-dom` for logic, `--screenshot` for visuals; mobile via a 375 px iframe). The steps are in the `h5p-frontend` skill. Never preview via `file://`: YouTube refuses some embeds without a Referer.

## Invariants that are easy to break

- `library.json` is the single list and order of JS/CSS files (the build and `dev/preview.html` read it). Modules hang off the `H5P.MagnetismoTransporte` object; `js/app.js` loads last and replaces it with the class, keeping the controller in a closure. One page per file in `js/pages/`, following the contract in `docs/arquitetura.md`.
- Answers never ship in plain text. Questions live in `authoring/banco-de-questoes.json` (outside the package); `js/data/bank.js` is generated, never edited by hand. Nothing in the DOM, the saved state or the public API may reveal a correct answer before the student answers, and scores are recomputed from the sealed key. `cyrb`/`keystream` in `js/core/util.js` must stay identical to the C# port in `scripts/gerar-banco.ps1`.
- Nothing loads from outside the package except YouTube and VLibras, and both only after a student click. Every video needs a text audio description (`media.<key>VideoDescription`), and it must describe only what the video really shows or says (sources in `docs/acessibilidade.md`).
- A new state field must be added to both `createDefaultState()` and `hydrate()` in `js/core/storage.js`, or it is dropped on reload.
- Navigation is sequential on purpose. Never make the stepper clickable, and never re-lock an unlocked page. Page 6 unlocks page 7 without requiring the video, and the UI must not say the video is optional.
- Skip rules (`SKIP_AFTER_TRIES` = 3 in `js/core/activities.js`, button from `UI.skipButton()`): vocabulary blanks and lab questions can be skipped only after 3 wrong tries on that item (vocab skips the first open blank with 3 tries; lab counts `magnets.tries`); quiz and true/false have **no** skip (one graded answer per question); the memory game (page with a YouTube video) keeps "Pular par" always available. A skip counts as wrong + concept error, reveals the answer only after locking, and (lab) counts the step as done. Never highlight the right option after a plain wrong lab answer — retry depends on it.
- Pages re-render via `innerHTML` with delegated `data-action` handlers. The magnet lab is the exception: it mutates its SVG in place while dragging, to keep pointer capture.
- The UI is trilingual (pt-BR default, en-US and es-ES via the single header "Language" button). New UI text goes through `L('pt', 'en', 'es')` from `js/core/i18n.js` — **always three arguments**: `L('a', 'b')` shows the Portuguese string to the Spanish student, and nothing flags it. Question translations arrive as `question`/`questionEn`/`questionEs` through `I18n.field(item, name)`, so never branch on `isEnglish()` by hand to pick a bank field; that is how `sentenceEs` was ignored. Page 8 is the open-ended essay (5 pts), scored offline by `js/core/essay.js` against a rubric sealed in `bank.js`; the results panel is page 9 and the total is 20.
- After changing video URLs in `content.json`, update the hard-coded checks in `validate-h5p.ps1`. Keep `dev/preview.js` in sync with `content.json`.
- When releasing a version, bump it in `library.json`, `h5p.json` (dependency + `changes`), `js/core/xapi.js` (`LIBRARY`), `validate-h5p.ps1` and `dev/preview.js`, then build and validate.
