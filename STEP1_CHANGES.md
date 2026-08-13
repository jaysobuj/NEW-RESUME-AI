# Step 1 — Critical Fixes: What Changed and Why

All changes verified by running the server and exercising each endpoint.

## Files added (4)
| File | Why it exists |
|---|---|
| `backend/config/env.js` | Missing JWT_SECRET used to boot fine, then throw a mystery 500 on first login. Now fails at startup with an actionable message. |
| `backend/middleware/rateLimit.js` | `/auth/login` had zero throttling — unlimited password guesses. |
| `backend/utils/fileValidation.js` | Uploads were classified by filename only. Now extension + MIME + magic bytes must agree. |
| `IMPLEMENTATION_PLAN.md` | Architecture plan for Steps 2-11. |

## Files modified (6)
| File | Change |
|---|---|
| `backend/routes/auth.js` | **Delete-account bypass fixed** + rate limiters applied |
| `backend/routes/ai.js` | Rewritten around `withCredit()` — reserve, then refund on failure |
| `backend/config/db.js` | In-memory source of truth, atomic writes, `refundQuota()`, corrupt-file backup |
| `backend/utils/atsScoring.js` | `clampScore()` on all scores; multi-word skills now match |
| `backend/server.js` | Env validation, MIME-checked upload, real `pdf-parse`, specific error messages |
| `backend/package.json` | Added `pdf-parse`, `express-rate-limit`; Node >= 18 |
| `frontend/src/pages/Settings.jsx` | Delete button disabled until password entered |

## Files removed
- `resumeai_v2/{backend/...` — junk folder from a failed shell brace-expansion during scaffolding

---

## The delete-account bug in detail

**Before:**
```js
if (password && !bcrypt.compareSync(password, user.password_hash))
  return res.status(401).json({ error: 'Incorrect password.' });
db.deleteUser(req.userId);
```
`Settings.jsx` initialises `delPw` to `''`. An empty string is falsy, so `password &&` short-circuits, the comparison never runs, and **the account is deleted with no verification at all.**

**After:**
```js
if (!password || typeof password !== 'string')
  return res.status(400).json({ error: 'Your password is required to delete your account.' });
if (!bcrypt.compareSync(password, user.password_hash))
  return res.status(401).json({ error: 'Incorrect password.' });
```

**Verified:** missing field → 400. Empty string → 400. Wrong password → 401. Account survives all three. Correct password → deleted.

---

## The credit bug in detail

Original order was: spend credit → call Gemini → if Gemini throws, return 500. The user paid for nothing.

The fix uses **reserve-then-settle**. Note it deliberately still reserves *before* the call rather than deducting only on success — if you deduct on success, two simultaneous requests can both read "1 credit left" and both go through, letting the user overspend. Reserving first makes the quota check authoritative; the refund handles the failure case.

**Verified** with a mocked failing AI service: HTTP 502 returned, credits used stayed at 0.

---

## Running it

```powershell
cd resumeai_v2\backend
npm install
copy .env.example .env
notepad .env      # set JWT_SECRET to something 16+ characters
npm start
```

The server now refuses to start if `.env` is incomplete, and tells you exactly which value is missing.
