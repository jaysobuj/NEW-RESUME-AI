# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ResumeAI v2 — an AI-assisted resume builder / career platform. React 18 (CRA) frontend + Express (CommonJS) backend, backed by a single JSON file acting as the database (no SQL, no ORM). AI features (summary rewriting, bullet rewriting, tailoring, resume parsing) call Gemini when a key is configured and fall back to deterministic local-rules logic otherwise — every AI-touched endpoint works with zero API keys.

## Commands

**Quick start:** from the repo root, `node setup.js` (or `setup.bat` / `./setup.sh`) installs both `backend/` and `frontend/` deps and creates `backend/.env` with a random `JWT_SECRET` pre-filled; then `node start.js` (or `start.bat` / `./start.sh`) boots both servers together with colour-coded `[BACKEND]`/`[FRONTEND]` output and a single Ctrl+C to stop both. `start.js` refuses to run until `setup` has been run (checks for `.env` and `node_modules`) rather than failing confusingly mid-boot. See `setup.js`/`start.js` for the implementation — both are plain Node so they work identically on Windows/Mac/Linux; the `.bat`/`.sh` files are one-line wrappers.

Manual equivalent, backend (from `backend/`):
```
npm install
cp .env.example .env   # then set JWT_SECRET (16+ random chars); GEMINI_API_KEY optional
npm start               # node server.js, port 5000
npm run dev              # nodemon
```

Frontend (from `frontend/`):
```
npm install
npm start                # CRA dev server, port 3000
npm run build
```

Both must run simultaneously for the app to work. There is no test suite and no lint script configured in either `package.json` — do not assume `npm test` or `npm run lint` do anything meaningful.

The backend refuses to boot if `.env` is missing/invalid (`config/env.js` calls `process.exit(1)` with an actionable message) — check that first if the server won't start. `JWT_SECRET` is required and must not be the `.env.example` placeholder or under 16 chars.

## Architecture

```
backend/
  config/db.js       Single JSON file store (backend/database/db.json), exports flat CRUD functions
  config/env.js       Boot-time env validation, called before anything else in server.js
  middleware/auth.js       JWT verify → req.userId
  middleware/rateLimit.js  Per-route express-rate-limit instances
  routes/             One router per domain, mounted under /api/* in server.js
  utils/              Pure logic modules — no Express dependency, so they're reusable/testable
  server.js           Entry point; owns the generic /api/upload endpoint and the global error handler
frontend/src/
  context/AuthContext.jsx  Global user state; token/user cached in localStorage
  services/api.js          The one axios instance — JWT interceptor, 401 → auto-logout
  components/               Layout, Sidebar, shared UI primitives (Card, Alert, Spinner, ScoreRing, etc.)
  pages/                     One component per route, wired up in App.jsx
```

### Conventions every feature follows (violating these breaks the established pattern)

| Convention | Rule |
|---|---|
| Auth | `router.use(requireAuth)` at the top of the route file; every query scoped by `req.userId` |
| Data access | Never touch `db.json` directly — add a function to `config/db.js` |
| Business logic | Pure functions in `utils/`, no `req`/`res` params |
| Frontend data | Always through `services/api.js`, never a raw `fetch` |
| Page shell | Every page returns `<Layout title subtitle actions>` |

### The JSON database (`backend/config/db.js`)

- Loaded **once** into an in-memory `data` object at startup (`loadFromDisk()`). Every exported function mutates that object directly, then calls `save()`. Because Node is single-threaded and these functions contain no `await`, each call is effectively atomic — this is what eliminates the lost-update race that existed in the original version.
- `save()` writes to `db.json.tmp` then `fs.renameSync`s over `db.json` — atomic on the same filesystem, so a crash mid-write can't corrupt the file.
- Reads return **deep copies** (`clone()`), so callers can't mutate stored records by accident.
- A corrupt `db.json` on boot gets backed up to `db.json.corrupt-<timestamp>` rather than silently discarded.
- If you add a new collection, add it to `EMPTY_DB()` too, or old `db.json` files loaded via the `{...EMPTY_DB(), ...parsed}` spread won't get it.

### AI credit accounting (`backend/routes/ai.js`)

All three AI routes go through `withCredit(req, res, work)`:
1. **Reserve** the credit (`db.useQuota`) *before* calling the AI. Reserving first (not deducting on success) is deliberate — it's what prevents two simultaneous requests from both reading "1 credit left" and both succeeding.
2. Run `work()`.
3. On any throw, **refund** (`db.refundQuota`) and return 502 — a failed AI call never costs the user a credit.

Any new AI-costing endpoint should reuse `withCredit`, not reimplement quota logic.

### Truth-constrained AI output (`backend/utils/truthCheck.js`)

Every AI-generated (or local-fallback) text passes through `checkTextAgainstTruth()` before being returned to the client. It builds a "ground truth" word/number set from the user's *original* resume data and flags AI output that introduces numbers or skill-like terms not present in the original — reverting to the original text if `!isSafe`. This is a heuristic safety net, not a real fact-checker, and that limitation is documented inline. Any new AI feature that rewrites user content should route through this.

### Two-tier AI pattern (Gemini + local fallback)

Used identically in `utils/aiService.js` (summary/bullet/tailor) and `utils/resumeParser.js` (resume import): if `GEMINI_API_KEY` is set, try Gemini first (native `fetch`, no SDK); on missing key or any Gemini failure, fall through to a deterministic local-rules implementation. Every result carries `source: 'gemini' | 'local_rules'` so the frontend can be honest about which engine produced it. New AI features should follow this same shape rather than making Gemini a hard dependency.

### File upload validation (`backend/utils/fileValidation.js`, `utils/extractText.js`)

Uploaded files (PDF/DOCX/TXT, 5MB max) must agree on three independent signals before being parsed: file extension, reported MIME type, and magic bytes (`%PDF`, ZIP header `PK\x03\x04`, or "no NUL bytes" for txt). `extractText()` wraps this plus `mammoth`/`pdf-parse` extraction and is shared by the generic `/api/upload` endpoint and `/api/resumes/import` — don't duplicate extraction logic elsewhere.

### ATS scoring (`backend/utils/atsScoring.js`)

Pure, offline, no AI required — `scoreResumeAgainstJob(resume, jobDescription)` is the reusable core: keyword extraction/matching, a weighted 0–100 score (keyword 30%, skills 20%, sections 15%, contact 10%, action verbs 10%, achievements 10%, formatting 5%), all sub-scores and the total run through `clampScore()`. This function is also the basis `aiService.js` uses for its local (non-Gemini) summary/tailoring fallbacks — reuse it rather than re-deriving keyword matching elsewhere.

### Resume templates & multi-format export

Presentation is a property of the resume record (`resume.template`, defaults to `'modern'`), not a global setting — each resume can use a different design and switching changes no user data.

- **`backend/utils/templates.js`** is the single source of truth: a registry of every design (`id`, `name`, `category: 'ats'|'designer'`, `layout`, `font`, `accent`, `featured`, `atsSafe`). The renderer, the create/update validation, and the frontend picker (which fetches it via `GET /api/export/templates`) all read from here. Adding a template = one entry here + one CSS/layout branch in `renderHtml.js`. Nothing else changes. Always coerce untrusted template values with `coerceTemplate()` before they reach the renderer (done in `routes/resume.js` POST/PUT).
- **`backend/utils/renderHtml.js`** — `renderResumeHtml(resume, templateId)` turns a resume + template into a complete, self-contained HTML document (inline CSS, all user data HTML-escaped via `esc()`). This ONE function powers the PDF, the `.html` export, and the live preview — so the preview is byte-identical to the download, no drift.
- **`backend/utils/htmlToPdf.js`** — renders that HTML to a PDF via the environment's Chromium (playwright-core, `findChromium()` locates the binary — prefers `headless_shell`). It never hard-crashes: on missing/failed Chromium it throws a tagged error and the export route falls back to the legacy pdfkit `generatePDF` (same graceful-degradation philosophy as the AI features). `playwright-core` is a dependency but does **not** download a browser on install.
- **`backend/routes/export.js`** — format dispatch at `GET /api/export/:id/:format` where format ∈ `pdf|docx|txt|html|json`; plus `GET /:id/preview` (inline HTML for the `<iframe>`) and `GET /templates`. **Route order matters**: the literal `/templates` and `/:id/preview` are declared before the generic `/:id/:format`. `?template=` overrides the stored template for one export.
- Two ATS tiers: `atsSafe` (single-column, parse-clean) vs designer (richer, flagged with an "ATS risk" badge in the UI). `.txt`/`.json` emitters live in `exportResume.js`; the frontend picker (`components/TemplatePicker.jsx`) shows featured designs first and preview via `components/ResumePreview.jsx` (fetches HTML through `api.getPreviewHtml`, injects with `<iframe srcDoc>` so the JWT stays in the header).

### Theming / dark mode

`frontend/src/context/ThemeContext.jsx` holds the theme and writes `<html data-theme="light|dark">`; the choice is persisted to `localStorage` (OS `prefers-color-scheme` is the first-run default) and applied pre-paint in `index.js` to avoid a flash. The Settings "Appearance" card toggles it. `global.css` defines the light palette on `:root` and overrides it under `:root[data-theme="dark"]` — **style new UI with the CSS variables (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--primary-light`) or theme-aware helpers (`.soft-note`, `.alert-*`, `.badge-*`), never hardcoded hex backgrounds**, or it won't adapt.

### Job recommendations

`GET /api/jobs/recommended?resumeId=` answers "what jobs should I look for" — it does **not** call any AI or job-search API. `backend/utils/jobProvider.js` is a minimal provider interface (`listAllJobs`, `getJob`) over `backend/data/seedJobs.json` (~50 demo AU listings), deliberately structured so a real job-search API can be swapped in later without touching the recommendation logic. `backend/utils/recommendationEngine.js` reuses `scoreResumeAgainstJob()` from `atsScoring.js` **unchanged** — a job listing's description is just another "job description" to score a resume against — ranks all seed jobs by match score, and derives `suggestedRoles` from the distinct titles among the top matches. Reasons follow the two-tier pattern (`source: 'gemini'|'local_rules'`): a template reason is always computed first as the safe fallback, and if `GEMINI_API_KEY` is set, **one batched call** (not one per job) asks for short personalised reasons for all top matches at once. `backend/utils/resumeProfile.js` derives `yearsExperience`/`careerLevel` from the resume's experience dates (lenient year-only parsing, handles "Present"/"Current") — this metric didn't exist anywhere before, since `resumeParser.js` only extracts raw fields. **No credit cost** — like ATS scoring, this is offline/instant and does not go through `withCredit()`. On the frontend, "Track this application" (`JobCard.jsx`) navigates to the Application Tracker with `location.state.prefill` set, pre-filling the add-application form — no separate saved-jobs storage exists yet.

### Smart application reminders

Deliberately **not** real status automation — there's no API that tells you "you got rejected." `backend/utils/reminders.js` is a pure, stateless function computed fresh on every `GET /api/applications/reminders` call (no cron, no email, no new dependencies), the same on-demand philosophy as ATS scoring. It flags: a `Saved`/`Applied` application idle past a threshold (`STALE_THRESHOLDS`), an `Interview` with a future `interview_date` (upcoming), or a past `interview_date` with no status change since (needs an outcome logged). The key correctness detail: `status_updated_at` is a **separate timestamp from `updated_at`**, stamped only when `status` actually changes (`routes/applications.js` PUT handler compares old vs new status) — otherwise an unrelated notes edit would reset the staleness clock, since the generic `updateApplication()` in `db.js` always touches `updated_at`. `reminder_snoozed_until` rides the existing generic PUT rather than a dedicated route. Legacy records without `status_updated_at` fall back to `updated_at`/`created_at` so old data doesn't break.

### Route ordering gotcha

In `routes/resume.js`, `POST /import` is declared *before* `GET /:id` — Express matches top-down, so if `/import` were declared after, it'd be swallowed by the `:id` param route. The same rule applies in `routes/export.js` (see above).

### Frontend auth flow

`AuthContext` holds `user`/`loading` state; JWT and user JSON live in `localStorage`. On mount it calls `GET /auth/me` if a token exists to hydrate `user`. `services/api.js`'s response interceptor auto-clears storage and hard-redirects to `/login` on any 401 — so a route handler doesn't need to special-case expired tokens itself.

## Current state vs. planned work

"Step 1 — Critical Fixes" from `IMPLEMENTATION_PLAN.md` is done (see `STEP1_CHANGES.md`, `UPLOAD_FEATURE.md`). **"Step 2 — Resume Template System" is also done and extended** beyond the original single-column-only scope: 6 templates across two tiers (ATS-safe + designer), HTML→PDF rendering, live preview, and 5 export formats (PDF/DOCX/TXT/HTML/JSON) — see the "Resume templates & multi-format export" section above. A light/dark theme toggle was also added (see "Theming"). **A slice of "Step 6 — Job Recommendation Engine" is done** (see "Job recommendations" above) using a seed dataset rather than the full Step 3 job search portal — the provider interface is in place so a real API is a later drop-in, but there's no saved-jobs storage or search/filter UI yet. **A lighter alternative to the "automatic status updates" idea is also done** (see "Smart application reminders") — in-app nudges only, deliberately not email/inbox integration. `IMPLEMENTATION_PLAN.md` lays out the architecture for everything else not yet built: the full job search portal, application tracker upgrade (5→8 statuses), ATS insights + interview questions, analytics dashboard, and an AI career coach. Read it before starting any of those.

Known, deliberately-undone items (see `IMPLEMENTATION_PLAN.md` §11): JWT lives in `localStorage` (XSS-readable — tradeoff documented, not accidental); single JSON file means no multi-process scaling; no email verification/password reset; no automated tests; no pagination on resume/application lists.
