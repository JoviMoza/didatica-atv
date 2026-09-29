---
name: magnetismo-perfis
description: Project rules for adding Teacher and Student profiles (login, roles, teacher dashboard with scores, errors, top doubts and thematic axes, teacher access to editing) to the H5P activity "Magnetismo e Transporte" (H5P.MagnetismoTransporte). Use whenever work touches login, accounts, roles, permissions, teacher reports/dashboard, student data collection, xAPI actor identity, or a backend/portal around this H5P package.
---

# Perfis Professor/Aluno — Magnetismo e Transporte

Written by Claude on 25/09/2026 for this project. The full plan (phases, decisions, risks) lives in
`C:\Users\PC-Panda\Desktop\Skills-Frontend-Documentacao\PLANEJAMENTO-PERFIS.md`. Read it before starting a phase.

## Requirement (from the team)

| Profile | Can | Must never |
|---|---|---|
| **Professor** | See which students did each task; score per activity and total; right/wrong per question; top doubts (most-missed concepts); results by thematic axis; open the content editors. | — |
| **Aluno** | Do the 8-page activity exactly as it exists today. | See anything about other students, any dashboard, any editor, any admin link, or any answer before locking it. "NADA ALÉM" das atividades. |

Initial accounts: `Professor` / `Professor@123` and `Aluno` / `Aluno@123`.

## Facts about the current app you must not forget

- It is a **client-only H5P library** (plain JS/CSS, no Node, no bundler). There is **no server**. A teacher view of *many* students is impossible without a central store (LMS gradebook, LRS, or a backend you add).
- `js/core/xapi.js` sends one `completed` statement per graded activity, with a **fixed anonymous actor** (`h5p-magnetismo-transporte-learner`) and **only the score**. `conceptErrors`, per-question answers and attempts stay in the student's browser storage.
- Graded activities (`js/core/activities.js`): `dragWords` (5), `singleChoice` (4), `memory` (1), `trueFalse` (5). The lab (page 3) is not graded but records concept errors.
- Thematic axes = the `concept` field in `authoring/banco-de-questoes.json`: `polos`, `dominios`, `campo`, `equilibrio`, `earnshaw`, `eletroima`, `inducao`, `ems`, `supercondutor`, `motor-linear`, `maglev-mundo`. Group them for the teacher as: *Magnetismo* (polos, dominios, campo), *Equilíbrio e levitação* (equilibrio, earnshaw), *Eletromagnetismo* (eletroima, inducao, motor-linear), *Maglev* (ems, supercondutor, maglev-mundo). Confirm grouping with the team before hardcoding.
- Answers are sealed (`docs/seguranca.md`). The teacher dashboard is the **only** place allowed to show correct answers, and only server-side, after authentication.
- What the teacher can already edit in the H5P editor (Lumi): title, texts, video URLs/descriptions, behaviour flags (`semantics.json`). Questions are edited in `authoring/banco-de-questoes.json` + `scripts/build-h5p.ps1`, not in the editor.

## Hard rules

1. **Never put passwords, hashes or role checks only in the H5P JavaScript.** Anything shipped to the browser is readable. Authentication and authorization happen on a server (or are delegated to the LMS).
2. **One shared `Aluno` account cannot tell students apart.** Keep `Aluno/Aluno@123` as a demo/test account only; real use needs one account per student (or LMS identities). Say this to the user if a task assumes the shared account is enough.
3. Seed accounts from environment/config at first run, store **argon2id (or bcrypt) hashes**, force a password change on first login for real deployments. Never commit plaintext passwords to the repo or docs meant for students.
4. Authorization is checked **on every server route**, deny-by-default. Student routes return only that student's own data. Teacher-only routes: `/professor/*`, `/api/relatorios/*`, editor links.
5. Student UI must not contain hidden teacher links, role flags in the DOM, or dashboard code paths that are merely hidden with CSS.
6. Minors' data (LGPD Art. 14): collect the minimum (name/turma, answers, timestamps). No IP logging in reports, no third-party analytics, define retention and deletion.
7. Do not break existing invariants in `AGENTS.md`/`CLAUDE.md`: sealed bank, signed state, sequential navigation, first-attempt grading, no CDNs/web fonts, `library.json` load order, version bump checklist.
8. The H5P package must keep working **standalone in Lumi** (no backend) — profile features are additive and optional.

## Preferred architecture (see plan for alternatives)

- **Path A (quickest, no code):** publish in an LMS (Moodle) — roles, logins and gradebook come from the LMS. Improve `xapi.js` to send per-question `answered` statements with `concept` extensions so the LMS/LRS report shows errors and axes.
- **Path B (own portal):** Python **FastAPI + SQLite** (Python already on the machine; no Node). Serves the unpacked H5P with a vendored player (`h5p-standalone`, copied locally, no CDN), receives xAPI at `/xapi/statements`, stores per-student results, renders the teacher dashboard. Cookie sessions (`HttpOnly`, `Secure`, `SameSite=Lax`) + CSRF tokens, argon2 hashes, rate-limited login.

## Skills to load per task (from `Skills-Frontend\skills-perfis` and `Skills-Frontend\skills`)

| Task | Skills |
|---|---|
| Login, sessions, passwords | `owasp-security`, `api-authentication`, `csrf-protection` |
| Roles/permissions | `owasp-security` (broken access control), `defense-in-depth-validation` |
| Backend API | `fastapi-expert`, `rest-api-design`, `api-security-hardening` |
| Database/schema | `database-design`, `sqlite` |
| Student data, minors | `children-data-minimization`, `edtech-privacy-assessment` (US-law based; map to LGPD) |
| Teacher dashboard UI | `frontend-design`, `baseline-ui`, `fixing-accessibility`, plus the project's `h5p-frontend` conventions |
| Review before merge | `differential-review`, `sharp-edges`, `appsec-expert` |
| Test as each profile | `webapp-testing`, `ux-audit` (log in as Professor, then as Aluno, and try to reach teacher URLs) |
| Docs | `project-docs` |

## Definition of done for any profile feature

- Logged in as **Aluno**: only the activity is reachable; `/professor`, `/api/relatorios/*` and editor URLs return 403/redirect; no other student's name or score appears anywhere (HTML, JSON, storage).
- Logged in as **Professor**: sees each student, score per activity, right/wrong per question, top missed concepts, results by axis; can open the editors.
- Logged out: everything except the login page redirects to login.
- `scripts/validate-h5p.ps1` still passes and the `.h5p` still opens in Lumi without the backend.
