# AI Career Management Platform — Implementation Plan

**Project:** ResumeAI v2 → AI Career Management Platform
**Approach:** Incremental. Every step below extends the existing architecture; nothing is rewritten.

---

## 1. Existing Architecture (as analysed)

```
resumeai_v2/
├── backend/                 Node + Express, CommonJS, port 5000
│   ├── config/
│   │   ├── db.js            Single JSON file store, exports flat CRUD functions
│   │   └── env.js           [NEW in Step 1] boot-time config validation
│   ├── middleware/
│   │   ├── auth.js          JWT verify → sets req.userId
│   │   └── rateLimit.js     [NEW in Step 1] per-route throttles
│   ├── routes/              One router per domain, all mounted under /api/*
│   ├── utils/               Pure logic modules, no Express dependency
│   └── server.js            Entry point, upload endpoint, error handler
└── frontend/                React 18 + CRA, react-router v6, axios
    ├── context/AuthContext  Global user state, token in localStorage
    ├── services/api.js      Axios instance, JWT interceptor, 401 auto-logout
    ├── components/          Layout, Sidebar, UI primitives
    └── pages/               One component per route
```

**The five conventions every new feature must follow:**

| Convention | Rule |
|---|---|
| Auth | `router.use(requireAuth)` at the top; scope all queries by `req.userId` |
| Data access | Never touch `db.json` directly — add a function to `config/db.js` |
| Business logic | Pure functions in `utils/`, no `req`/`res` — keeps them testable |
| Frontend data | Always through `services/api.js`, never a raw `fetch` |
| Page shell | Every page returns `<Layout title subtitle actions>` |

**Why this matters:** because logic already lives in `utils/` as pure functions, the ATS engine and Gemini service can be *reused* by the recommendation engine and interview generator without duplication. That is the single biggest architectural lever in this plan.

---

## 2. Step 1 — Critical Fixes ✅ COMPLETE

| # | Issue | Fix | Verified |
|---|---|---|---|
| 1 | Delete-account password bypass | Password now mandatory and always compared | ✅ empty/missing/wrong all rejected |
| 2 | Credit lost on AI failure | Reserve-then-refund via `withCredit()` + `db.refundQuota()` | ✅ 502 returned, credit balance unchanged |
| 3 | No brute-force protection | `express-rate-limit` on login (8/15min), register (5/hr), sensitive (10/15min), AI (20/min), upload (15/min) | ✅ 429 on 9th login attempt |
| 4 | `pdf-parse` required but not installed | Added to `package.json`, imported at top level | ✅ installs and loads |
| 5 | ATS score could exceed 100% | `clampScore()` on every sub-score and the total; numerator capped | ✅ worst case = 100, not 166 |
| 6 | Upload trusted filename only | Extension + MIME + magic bytes must all agree | ✅ renamed .txt→.pdf rejected |
| 7 | No env validation | `config/env.js` exits with actionable message | ✅ fails fast on missing JWT_SECRET |
| 8 | JSON db race conditions | In-memory source of truth + atomic temp-file rename + corrupt-file backup | ✅ |
| 9 | Multi-word skills never matched | Skills tokenised same as JD | ✅ "Project Management" now scores |
| 10 | Generic "Server error." | Error handler distinguishes multer / JSON / size / unknown | ✅ |

**Bonus finding:** the zip contained a junk folder `resumeai_v2/{backend/{config,middleware,...}` — leftover from a failed shell brace-expansion during scaffolding. Removed.

---

## 3. Step 2 — Resume Template System

**Why:** the builder stores data and the exporter hardcodes one layout. Presentation must become a variable, not a constant.

**Design decision:** the template is a *property of the resume record* (`resume.template`), not a global setting. This means each resume can use a different template, switching is instant, and — critically — **no user data changes when the template changes**, exactly as required.

### Files to edit

| File | Change | Why |
|---|---|---|
| `backend/config/db.js` | ✅ already returns `template` (defaults to `'modern'`) | Prepared in Step 1 |
| `backend/routes/resume.js` | Accept + validate `template` on POST/PUT against a whitelist | Prevents arbitrary values reaching the renderer |
| `backend/utils/templates.js` | **NEW** — template registry: id, name, fonts, colours, spacing, section order | Single source of truth shared by PDF, DOCX and the React preview |
| `backend/utils/exportResume.js` | Replace hardcoded styling with a lookup from the registry | Reuses existing pdfkit/docx code, only styling becomes dynamic |
| `frontend/src/components/ResumePreview.jsx` | **NEW** — renders the live preview from the same registry | |
| `frontend/src/pages/ResumeBuilder.jsx` | Add template picker + split-pane live preview | |
| `frontend/src/styles/global.css` | Template CSS classes | |

### The six templates

| Template | Font | Accent | Layout | Best for |
|---|---|---|---|---|
| Modern | Helvetica | Indigo | Left-aligned, coloured headings | Tech / startup |
| Professional | Helvetica | Navy | Ruled section dividers | Corporate |
| Executive | Times | Charcoal | Wide margins, serif, generous spacing | Senior roles |
| Classic | Times | Black | Centred header, traditional | Academia / government |
| Minimal | Helvetica | Grey | No rules, whitespace-driven | Design-conscious |
| Creative | Helvetica | Teal | Skills as pills, coloured header block | Marketing / design |

**ATS safety note for your report:** all six remain single-column with no tables, no images and no text in headers/footers — the ATS-friendliness rules already documented in `exportResume.js`. Only typography and colour vary. This is a defensible design decision to write up.

---

## 4. Step 3 — Job Search Portal

**Why the architecture matters more than the data:** your prompt requires that demo jobs be swappable for a real API later. The way to guarantee that is a **provider interface** — the routes talk to an abstract provider, never to the data source.

```
routes/jobs.js  →  utils/jobProvider.js  →  ┌─ localProvider  (seed JSON, ships now)
                        (interface)         └─ apiProvider    (Adzuna/Jooble, later)
```

Switching providers becomes a one-line change in `.env`: `JOB_PROVIDER=local|adzuna`.

### Files

| File | Purpose |
|---|---|
| `backend/data/seedJobs.json` | **NEW** — ~60 realistic AU jobs (Sydney/Melbourne/Remote), varied salary, type, mode |
| `backend/utils/jobProvider.js` | **NEW** — `searchJobs(filters)`, `getJob(id)`; normalises every provider to one job shape |
| `backend/routes/jobs.js` | **NEW** — `GET /api/jobs` (search + filter + paginate), `GET /api/jobs/:id`, `POST /api/jobs/:id/save`, `GET /api/jobs/saved`, `DELETE /api/jobs/saved/:id` |
| `backend/config/db.js` | Add `saved_jobs` collection + CRUD |
| `backend/server.js` | Mount `/api/jobs` |
| `frontend/src/pages/JobSearch.jsx` | **NEW** — filter sidebar + results list + detail drawer |
| `frontend/src/pages/SavedJobs.jsx` | **NEW** |
| `frontend/src/components/Sidebar.jsx` | Add nav entries |
| `frontend/src/App.jsx` | Add routes |

**Normalised job shape** (every provider must return this):
```js
{ id, title, company, location, workMode, jobType, salaryMin, salaryMax,
  currency, description, requiredSkills[], postedDate, source, applyUrl }
```

**Integration:** "Apply" pre-fills the Application Tracker form (Step 4) with company, position and job description — the two features connect rather than sitting side by side.

---

## 5. Step 4 — Application Tracker Upgrade

**Why:** the current tracker has 5 statuses and 3 fields. Your teacher asked for 8 statuses and 9 fields.

**Migration risk — and how it's handled.** Existing records use `Interview`/`Offer`/`Rejected`, which survive. But `Saved` and `Applied` must map into the new pipeline. A one-time migration in `db.js` runs at startup: `Saved → Applied`, and any unrecognised status → `Applied`. Because this runs on load with the new atomic write, existing demo data is never lost.

| Old | New pipeline |
|---|---|
| Saved, Applied, Interview, Offer, Rejected | Applied → Reviewed → Interview → Assessment → Final Interview → Offer → Rejected → Withdrawn |

### New fields
`resume_id` (which resume was used), `interview_date`, `follow_up_date`, `job_description`, plus existing company/position/date/status/notes.

### Files

| File | Change |
|---|---|
| `backend/config/db.js` | New `ALLOWED_STATUSES`, migration function, richer `getAppStats` |
| `backend/routes/applications.js` | Validate new fields; add `?search=`, `?sort=`, `?status=` query params |
| `frontend/src/pages/ApplicationTracker.jsx` | 8-column kanban (horizontal scroll), edit modal, search/filter/sort bar, list⇄board toggle |

**Reusing existing code:** the current kanban grouping logic and `STATUS_COLOURS` map extend directly — only the array of statuses grows.

---

## 6. Step 5 — ATS Improvements + Interview Questions

**Why this is the highest-value step:** it reuses `atsScoring.js` and `aiService.js` unchanged and produces the most impressive demo output per line of new code.

### 5a. Richer ATS output (no AI needed — stays free and instant)

`utils/atsScoring.js` gains a `buildInsights()` function deriving, from the score breakdown you already compute:
- **Strengths** — every sub-score ≥ 75, phrased as a positive
- **Weaknesses** — every sub-score < 50, with the specific cause
- **Missing skills** — missing keywords filtered against a known-skills dictionary (distinguishes a real skill gap from a stopword miss)
- **Keyword density** — `matched / total resume words`, with a healthy-range indicator (2–5%)
- **Match percentage** — matched ÷ total JD keywords, reported separately from the weighted overall score

### 5b. Interview question generator

`utils/interviewService.js` **(NEW)** builds a Gemini prompt from resume + JD + the ATS gap analysis, requesting strict JSON:

```
5 technical · 3 behavioural · 2 HR · 2 manager
each: { question, whyAsked, sampleAnswer, tips[] }
```

**Two things that make this production-ready rather than a demo hack:**
1. **Local fallback** — a rules-based generator produces questions from matched skills and weak areas when Gemini is unavailable, matching the existing `source: 'gemini' | 'local_rules'` pattern used everywhere else in your codebase.
2. **Truth-check reuse** — sample answers pass through the existing `truthCheck.js` so the AI cannot fabricate experience the user does not have. This is your unit's ethics angle and it comes free.

**Cost:** 2 credits (it is a large generation). Handled by `withCredit()` from Step 1 — so a failure still refunds automatically.

### Files
`utils/atsScoring.js` (extend), `utils/interviewService.js` (new), `routes/ats.js` (add `POST /api/ats/interview-questions`), `frontend/src/pages/ATSScan.jsx` (tabbed results: Score / Insights / Questions), `frontend/src/components/InterviewQuestions.jsx` (new, accordion).

---

## 7. Step 6 — AI Job Recommendation Engine

**Why it works without any new AI cost:** `atsScoring.js` already scores a resume against a job description. A job listing *is* a job description. So scoring one resume against 60 seed jobs is 60 calls to a function you already wrote — no Gemini, no credits, instant results.

```
resume → utils/resumeProfile.js (extract skills/experience/education/tech/certs)
       → for each job: scoreResumeAgainstJob(resume, job.description)
       → rank by score → top N with reasons
```

Gemini is used only for the *narrative* reason ("Your Docker and AWS experience directly matches their infrastructure requirements") — and only if a key is present, with a template-based fallback otherwise.

### Output per recommendation
Match %, reasons[], matchedSkills[], missingSkills[], salary estimate (from the job record), career level (derived from years of experience in the resume).

### Files
`utils/resumeProfile.js` (new), `utils/recommendationEngine.js` (new), `routes/jobs.js` (add `GET /api/jobs/recommended`), `frontend/src/pages/JobRecommendations.jsx` (new), `frontend/src/components/JobCard.jsx` (new, shared with Job Search).

---

## 8. Step 7 & 8 — Dashboard + Analytics

**Why together:** both read the same aggregated data. Computing it once server-side avoids the frontend firing eight requests.

**New endpoint:** `GET /api/analytics/summary` returns everything in one payload — average ATS score, application counts by status, interview conversion rate, offer rate, credits, recent resumes, recent scans, ATS trend series, applications-per-month series.

**Interview rate** = interviews ÷ total applications. **Offer rate** = offers ÷ total. Both guard against divide-by-zero (return `null`, and the UI shows "—" rather than `NaN%`).

**Charting:** add `recharts` to the frontend — it is the lightest option and pairs naturally with React. Charts: ATS improvement (line, uses the `getAtsScanHistory` endpoint that already exists but nothing calls), applications per month (bar), status distribution (donut), conversion funnel.

### Files
`backend/routes/analytics.js` (new), `backend/utils/analytics.js` (new), `frontend/src/pages/Analytics.jsx` (new), `frontend/src/pages/Dashboard.jsx` (extend), `frontend/src/components/charts/` (new).

---

## 9. Step 9 — AI Career Coach

**Why it's cheap to build:** `aiService.js` already handles Gemini calls, error handling and fallback. The coach adds a conversation wrapper around `callGemini`.

**Key design decisions:**
- **Context injection** — the user's resume summary and skills are prepended to the system prompt, so advice is personalised rather than generic. This is what separates it from "a chatbot bolted on".
- **History cap** — only the last 10 turns are sent, keeping token cost bounded and predictable.
- **Storage** — conversations persist in a `coach_conversations` collection so a session survives a page refresh.
- **Cost** — 1 credit per message, through `withCredit()`.
- **Scope guard** — the system prompt restricts the model to career topics and instructs it to decline unrelated requests.

Six suggested-prompt chips seed the empty state: interview advice, salary negotiation, career guidance, resume advice, job search strategy, networking.

### Files
`backend/utils/coachService.js` (new), `backend/routes/coach.js` (new), `backend/config/db.js` (conversations collection), `frontend/src/pages/CareerCoach.jsx` (new).

---

## 10. Step 10 — UX Pass

Applied across all pages, not as a separate feature:

| Area | Change |
|---|---|
| Navigation | Sidebar grouped into sections: Resume / Jobs / Insights / Account |
| Loading | Skeleton components replacing full-page spinners (perceived speed) |
| Empty states | `<EmptyState icon title message action />` — every list gets one with a next-step button |
| Notifications | Toast system replacing inline `<Alert>` for transient success messages |
| Errors | Every `catch` surfaces `err.response?.data?.error` (the backend now sends good messages — Step 1 made this worthwhile) |
| Responsive | Sidebar collapses to a bottom bar under 768px; kanban scrolls horizontally |
| Accessibility | Real `aria-label`s on icon-only buttons, visible focus rings, `role="status"` on live regions, semantic headings. **Note:** the current UI uses emoji as the sole meaning-carrier in several places — screen readers announce these poorly. Each gets a text label. |

---

## 11. Step 11 — Final Review Checklist

**Already identified for cleanup:**
- `frontend/src/components/UI.jsx` — `Badge` is imported by `ApplicationTracker.jsx` but never rendered (dead import)
- `ExportResume.jsx` — option cards have `cursor: pointer` but no click handler on the card itself
- `AISuggestions.jsx` — hardcodes `jobDescription: ''`, so job-targeted summary rewriting was unreachable (backend already supported it; Step 1 kept the parameter, Step 2 wires up the UI field)
- `GET /api/ats/history/:resumeId` — fully implemented, zero callers (Step 8 finally uses it)
- Resume list and application list have no pagination — fine at demo scale, worth noting as a documented limitation

**Still-open production concerns to write up honestly in your report:**
1. **JWT in localStorage** — XSS-readable. httpOnly cookies are the production answer; the tradeoff is documented rather than hidden.
2. **JSON file storage** — the Step 1 changes remove the in-process race, but the design still cannot scale past one server process. Migration path: `sql.js` (WASM SQLite, no native compile — avoids the original `better-sqlite3`/Python problem entirely).
3. **No email verification / password reset** — a locked-out user has no recovery path.
4. **No automated tests** — adding Jest + supertest for the auth and ATS routes would materially strengthen a final-year submission.

---

## 12. Build Order

| Order | Step | Effort | Demo impact |
|---|---|---|---|
| ✅ 1 | Critical fixes | — | Foundation |
| 2 | Resume templates | Medium | High — visible instantly |
| 3 | Application tracker upgrade | Medium | High — explicitly requested |
| 4 | ATS insights + interview questions | Medium | **Highest** — best AI showcase |
| 5 | Job recommendations | Medium | High — reuses ATS engine |
| 6 | Job search portal | Large | High |
| 7 | Dashboard + analytics charts | Medium | Medium |
| 8 | Career coach | Small | Medium |
| 9 | UX + accessibility pass | Medium | Polish |
| 10 | Final review | Small | Report material |

**Recommended next:** Step 2 (templates) — it is self-contained, touches no auth or data logic, and gives you something visually different to show immediately.
