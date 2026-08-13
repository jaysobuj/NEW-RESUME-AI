# Resume Upload — What Changed

## The problem
- "+ New Resume" only cleared the form. If the form was already blank, nothing visibly happened — so it looked broken.
- There was no way to upload a resume anywhere.
- The ATS Scan page had a file upload, but it was for the **job description**, which nobody needs — people paste job ads.

## The fix
Upload moved to where it belongs: **Resume Builder**. Removed from ATS Scan.

---

## How it works now

**Resume Builder page**
1. Drag a PDF/DOCX/TXT onto the drop zone, or click "📤 Upload Resume"
2. Backend extracts the text, parses it into structured fields, saves it as a new resume
3. It loads straight into the editor so you can check and correct it
4. Press Save

The imported resume then appears everywhere — ATS Scan, AI Suggestions, AI Tailoring, Export.

**"+ New Blank Resume"** now shows a confirmation message so it no longer feels dead.

**ATS Scan page** is now paste-only, with a word counter.

---

## Parsing: two tiers

Same pattern as the rest of your app (`aiService.js`):

1. **Gemini** (if `GEMINI_API_KEY` is set) — handles unusual layouts well, returns strict JSON at temperature 0.1
2. **Local rules parser** — regex + section detection. Runs when Gemini is missing or fails.

**Import always works, even with no API key.** Verified: a DOCX with no Gemini key extracted name, email, phone, LinkedIn, summary, 10 skills, 2 roles with dates and bullets, 1 education entry, 2 certifications.

The response tells the UI which engine ran (`source: 'gemini' | 'local_rules'`) and lists anything it couldn't find (`warnings`), so the user gets an honest message rather than a mysteriously half-empty form.

**The parser never invents content.** It only extracts what's written in the file. Missing fields stay blank for you to fill in — silently guessing a job title would be worse than leaving it empty.

---

## Import is free (no credits)

Deliberate: charging a credit just to get your own data into the app is bad UX, and the local parser needs no AI. It's rate-limited instead (15/min).

---

## Files

**New**
| File | Purpose |
|---|---|
| `backend/utils/extractText.js` | Shared file → text. Both `/api/upload` and the import route use it instead of duplicating the logic. |
| `backend/utils/resumeParser.js` | Text → structured fields. Gemini + local fallback + normalisation. |

**Modified**
| File | Change |
|---|---|
| `backend/routes/resume.js` | `POST /api/resumes/import`. Declared **before** `GET /:id` — Express matches top-down, so otherwise "import" would be read as a resume ID. |
| `backend/server.js` | `/api/upload` refactored to use `extractText` |
| `frontend/src/services/api.js` | `api.importResume(file)` |
| `frontend/src/pages/ResumeBuilder.jsx` | Drop zone, upload button, import handler, fixed "+ New Blank Resume" |
| `frontend/src/pages/ATSScan.jsx` | Upload removed, paste-only with word counter |
| `frontend/src/pages/ApplicationTracker.jsx` | Removed dead `Badge` import (kills your eslint warning) |

---

## Installing

No new npm packages. Overwrite the files, then in your **backend** terminal press `Ctrl+C` and `npm start` again.

The frontend hot-reloads by itself — no restart needed.

## Testing it
1. Resume Builder → drag a resume PDF/DOCX in
2. Fields populate, message says what was found
3. Press Save
4. ATS Scan → the resume is in the dropdown → paste a job ad → Run Scan
