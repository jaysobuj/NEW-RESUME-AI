// ==========================================================
// workflow.js — guided workflow state (Upload -> Search -> Select ->
// Tailor + Chat -> ATS -> Export -> Track).
//
// Deliberately thin: it only persists the ONE thing no existing
// collection already owns — "which job is currently selected, and
// which tailored resume / chat thread belongs to it" — so every other
// page (ATS Scan, Export, Dashboard) can read it instead of asking the
// user to re-paste a job description or re-pick a resume. Resumes,
// ATS scans and applications all keep using their own existing routes.
// ==========================================================

const express = require('express');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { getJob } = require('../utils/jobProvider');

const router = express.Router();
router.use(requireAuth);

// GET /api/workflow — current selection + tailoring session
router.get('/', (req, res) => {
  res.json(db.getWorkflowState(req.userId));
});

// POST /api/workflow/select-job { jobId }
// Selecting a (new) job resets the tailored resume + chat thread, since
// both are scoped to "tailoring resume X for job Y".
router.post('/select-job', (req, res) => {
  const { jobId } = req.body;
  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found in the demo catalogue.' });
  const state = db.setWorkflowState(req.userId, {
    selected_job: job,
    tailored_resume_id: null,
    chat_history: [],
    exported: false,
  });
  res.json(state);
});

// DELETE /api/workflow/select-job — clear the current selection
router.delete('/select-job', (req, res) => {
  const state = db.setWorkflowState(req.userId, { selected_job: null, tailored_resume_id: null, chat_history: [], exported: false });
  res.json(state);
});

// POST /api/workflow/tailored-resume { resumeId }
router.post('/tailored-resume', (req, res) => {
  const { resumeId } = req.body;
  if (resumeId) {
    const resume = db.getResumeById(resumeId, req.userId);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
  }
  const state = db.setWorkflowState(req.userId, { tailored_resume_id: resumeId || null });
  res.json(state);
});

// POST /api/workflow/mark-exported — flips the progress indicator once
// the user has downloaded the tailored resume at least once.
router.post('/mark-exported', (req, res) => {
  res.json(db.setWorkflowState(req.userId, { exported: true }));
});

module.exports = router;
