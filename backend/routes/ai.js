// ==========================================================
// ai.js — AI suggestion routes
//
// WHY THIS FILE CHANGED — THE CREDIT BUG:
// Originally every route did:
//     db.useQuota(userId)          <- credit spent here
//     await aiService.something()  <- if this throws...
//     res.status(500)              <- ...user paid for nothing
//
// A Gemini outage, a malformed JSON response, or bad resume data all
// cost the user a real credit with no result delivered.
//
// THE FIX — "reserve then settle", the same pattern payment systems use:
//   1. RESERVE the credit before calling the AI. This is deliberate:
//      if we deducted only on success, two simultaneous requests could
//      both read "1 credit left" and both succeed, letting the user
//      overspend. Reserving first makes the quota check authoritative.
//   2. On success, keep it.
//   3. On ANY failure, REFUND it via db.refundQuota() so the user is
//      never charged for a response they did not receive.
//
// The `withCredit` helper below implements this once so all three
// routes share identical, correct behaviour.
// ==========================================================

const express = require('express');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const aiService = require('../utils/aiService');
const { getJob } = require('../utils/jobProvider');

const router = express.Router();
router.use(requireAuth);
router.use(aiLimiter);

/**
 * Reserve one AI credit, run `work`, and refund the credit if it fails.
 * Returns the AI result, or sends the appropriate error response.
 */
async function withCredit(req, res, work) {
  // 1. RESERVE
  if (!db.useQuota(req.userId)) {
    return res.status(403).json({
      error: 'AI quota exceeded. You have used all your free credits.',
    });
  }

  try {
    // 2. DO THE WORK
    const result = await work();
    const quota  = db.getQuota(req.userId);

    // Return the live credit balance with every AI response so the
    // frontend can update its counter without a second request.
    return res.json({
      ...result,
      creditsRemaining: quota ? Math.max(0, quota.limit - quota.used) : null,
    });
  } catch (err) {
    // 3. REFUND — the user got nothing, so charge nothing.
    db.refundQuota(req.userId);
    console.error('AI request failed (credit refunded):', err.message);
    return res.status(502).json({
      error: 'The AI service could not complete your request. Your credit was not used.',
      details: err.message,
    });
  }
}

// Shared resume lookup + validation
function loadResume(req, res) {
  const { resumeId } = req.body;
  if (!resumeId) {
    res.status(400).json({ error: 'Please select a resume first.' });
    return null;
  }
  const resume = db.getResumeById(resumeId, req.userId);
  if (!resume) {
    res.status(404).json({ error: 'Resume not found.' });
    return null;
  }
  return resume;
}

// POST /api/ai/improve-summary
router.post('/improve-summary', async (req, res) => {
  const resume = loadResume(req, res);
  if (!resume) return;

  // The frontend may now pass an optional jobDescription to target the
  // rewrite at a specific role. Empty string keeps the old generic behaviour.
  const jobDescription = typeof req.body.jobDescription === 'string'
    ? req.body.jobDescription.slice(0, 20000)
    : '';

  return withCredit(req, res, () => aiService.improveSummary(resume, jobDescription));
});

// POST /api/ai/rewrite-bullet
router.post('/rewrite-bullet', async (req, res) => {
  const { bulletText } = req.body;
  if (!bulletText || !String(bulletText).trim())
    return res.status(400).json({ error: 'Please enter a bullet point to rewrite.' });
  if (String(bulletText).length > 2000)
    return res.status(400).json({ error: 'That bullet point is too long (max 2000 characters).' });

  const resume = loadResume(req, res);
  if (!resume) return;

  return withCredit(req, res, () => aiService.rewriteBullet(String(bulletText).trim(), resume));
});

// POST /api/ai/tailor
// Optional jobId: when tailoring for a job from the local catalogue, its
// curated requiredSkills/preferredSkills (see seedJobs.json) let the
// summary rewrite prioritise the specific verified terms that matter
// most for THIS job, instead of only working from raw job-ad prose.
router.post('/tailor', async (req, res) => {
  const { jobDescription, jobId } = req.body;
  if (!jobDescription || !String(jobDescription).trim())
    return res.status(400).json({ error: 'Please paste the job description you are targeting.' });

  const resume = loadResume(req, res);
  if (!resume) return;

  const job = jobId ? getJob(jobId) : null;
  const requiredSkills = job ? [...(job.requiredSkills || []), ...(job.preferredSkills || [])] : [];

  return withCredit(req, res,
    () => aiService.tailorResume(resume, String(jobDescription).slice(0, 20000), requiredSkills));
});

// POST /api/ai/chat — compact chat used inside AI Tailoring. Proposes
// edits (summary or one bullet) for the user to Apply/Regenerate/Discard;
// never writes to the resume itself. Persists the thread on workflow_state
// so it survives navigation/refresh, scoped to the current tailoring session.
router.post('/chat', async (req, res) => {
  const { message, currentSummary } = req.body;
  if (!message || !String(message).trim())
    return res.status(400).json({ error: 'Please enter a message.' });

  const resume = loadResume(req, res);
  if (!resume) return;

  const workflow = db.getWorkflowState(req.userId);
  const history = workflow.chat_history || [];

  return withCredit(req, res, async () => {
    const result = await aiService.chatRefine({
      resume, job: workflow.selected_job, currentSummary, message: String(message).trim(), history,
    });
    const nextHistory = [
      ...history,
      { role: 'user', content: String(message).trim(), timestamp: new Date().toISOString() },
      { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() },
    ].slice(-40); // keep the thread bounded
    db.setWorkflowState(req.userId, { chat_history: nextHistory });
    return { ...result, chatHistory: nextHistory };
  });
});

// GET /api/ai/quota
router.get('/quota', (req, res) => {
  const q = db.getQuota(req.userId);
  if (!q) return res.status(404).json({ error: 'User not found' });
  res.json({
    used: q.used,
    limit: q.limit,
    remaining: Math.max(0, q.limit - q.used),
    plan: q.plan,
  });
});

module.exports = router;
