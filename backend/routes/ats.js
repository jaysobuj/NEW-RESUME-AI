// ATS scan routes - score a resume against a job description

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { scoreResumeAgainstJob } = require('../utils/atsScoring');
const { getJob } = require('../utils/jobProvider');

const router = express.Router();
router.use(requireAuth);

// POST /api/ats/scan
// Optional jobId: when the scan is for a job from the local catalogue,
// its curated requiredSkills/preferredSkills (already hand-picked hard
// skills, see seedJobs.json) drive the skills sub-score instead of
// re-deriving skills from job-ad prose — a much more reliable signal.
router.post('/scan', (req, res) => {
  const { resumeId, jobDescription, jobId } = req.body;
  if (!resumeId || !jobDescription)
    return res.status(400).json({ error: 'resumeId and jobDescription are required.' });

  const resume = db.getResumeById(resumeId, req.userId);
  if (!resume) return res.status(404).json({ error: 'Resume not found' });

  const job = jobId ? getJob(jobId) : null;
  const requiredSkills = job ? [...(job.requiredSkills || []), ...(job.preferredSkills || [])] : [];

  const result = scoreResumeAgainstJob(resume, jobDescription, requiredSkills);

  // Save scan to history
  db.saveAtsScan({
    id: uuidv4(),
    user_id: req.userId,
    resume_id: resumeId,
    job_description: jobDescription,
    overall_score: result.overallScore,
    breakdown: JSON.stringify(result.breakdown),
    matched_keywords: JSON.stringify(result.matchedKeywords),
    missing_keywords: JSON.stringify(result.missingKeywords),
    suggestions: JSON.stringify(result.suggestions),
  });

  res.json({ ...result });
});

// GET /api/ats/history/:resumeId
router.get('/history/:resumeId', (req, res) => {
  const scans = db.getAtsScanHistory(req.params.resumeId, req.userId);
  res.json({ scans });
});

module.exports = router;
