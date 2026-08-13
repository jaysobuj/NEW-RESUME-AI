# Deploying ResumeAI v2 (Render, free tier)

This app is two pieces from one repo:

- **Backend** — Express API (`backend/`), stores data in a single JSON file.
- **Frontend** — React app (`frontend/`), built to static files.

The repo ships a `render.yaml` **Blueprint** that defines both services, so
deployment is mostly clicking through Render's dashboard.

---

## Before you start — two things to know

1. **Data is a JSON file, and the free disk is ephemeral.** Accounts and
   resumes reset on every restart/redeploy. Great for a demo or uni
   submission; for permanent data, add a paid Render **Disk** mounted at
   `.../backend/database`, or use a host with a persistent volume.
2. **Designer-template PDFs use the pdfkit fallback here.** The free Node
   runtime has no Chromium, so Sidebar/Creative export as clean
   single-column PDFs. Everything else — DOCX, TXT, HTML, JSON, and the
   live on-screen previews — is unaffected. (Want Chromium-rendered
   designer PDFs online? Deploy the backend as a Docker container with
   Chromium installed and set `PLAYWRIGHT_CHROMIUM_PATH`.)

---

## Steps

### 1. Create the Blueprint
- Go to <https://dashboard.render.com> → **New** → **Blueprint**.
- Connect your GitHub and pick the `resume` repo (branch with `render.yaml`).
- Render reads `render.yaml` and proposes **resumeai-api** and **resumeai-web**. Click **Apply**.

### 2. Let the first deploy finish
- `JWT_SECRET` is generated for you automatically.
- Both services will build. Note each service's URL, e.g.
  - API: `https://resumeai-api.onrender.com`
  - Web: `https://resumeai-web.onrender.com`

### 3. Wire the two URLs together
These can't be known until the services exist, so set them now:

- **resumeai-web** → Environment → set
  `REACT_APP_API_URL = https://resumeai-api.onrender.com/api`
  (your API URL + `/api`). Save → this triggers a rebuild (CRA bakes the
  URL in at build time).
- **resumeai-api** → Environment → set
  `CLIENT_ORIGIN = https://resumeai-web.onrender.com`
  (your web URL, no trailing slash). Save → redeploy.

### 4. (Optional) Enable Gemini AI
- **resumeai-api** → Environment → set `GEMINI_API_KEY`.
- Leave it unset and every AI feature still works via the local-rules fallback.

### 5. Done
Open the web URL, register an account, and use the app. First load after
idle can be slow — free services spin down when unused and cold-start.

---

## Local development (for reference)

```bash
# backend
cd backend && npm install
cp .env.example .env         # set JWT_SECRET (16+ chars)
npm start                    # http://localhost:5000

# frontend (separate terminal)
cd frontend && npm install
npm start                    # http://localhost:3000
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend loads but every API call fails / CORS error | `CLIENT_ORIGIN` on the API must exactly equal the web URL; `REACT_APP_API_URL` must end in `/api`. Redeploy after changing. |
| "Backend refuses to boot" | `JWT_SECRET` missing or under 16 chars. Render's generated value is fine; if you set it manually, make it long. |
| Data disappeared after a redeploy | Expected on the free ephemeral disk — add a Render Disk or a volume host for persistence. |
| Designer PDF looks single-column | Expected without Chromium — use the Docker route for full-fidelity designer PDFs. |
| Login works locally but not deployed | You're mixing the local and deployed API URLs; check `REACT_APP_API_URL` in the web service. |
