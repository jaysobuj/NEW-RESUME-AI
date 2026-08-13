// jobs.js - Search real, live job listings via the Adzuna API
//
// Adzuna is a free job-listing aggregator (developer.adzuna.com). You need
// a free ADZUNA_APP_ID and ADZUNA_APP_KEY in your .env file — see the
// README section added for this feature.
//
// This route just proxies the request: the frontend calls OUR backend
// (so our API keys never reach the browser), and we call Adzuna on its
// behalf, then return a simplified list of jobs.

const express = require('express');
const requireAuth = require('../middleware/auth');
const db = require('../config/db');
const { recommendJobs } = require('../utils/recommendationEngine');
const { listAllJobs, getJob } = require('../utils/jobProvider');
const { scoreResumeAgainstJob } = require('../utils/atsScoring');

const router = express.Router();
router.use(requireAuth); // only logged-in users can search

// ==========================================================
// GET /api/jobs/catalogue — local demo job database (~60 IT roles),
// no external API required. Supports the "Search Jobs" step of the
// guided workflow. Optional resumeId scores every result against
// that resume with the SAME engine ATS Scan uses, so match% is
// consistent everywhere in the app.
// ==========================================================
router.get('/catalogue', (req, res) => {
  const { q = '', location = '', type = '', experienceLevel = '', workMode = '', resumeId } = req.query;
  let jobs = listAllJobs();

  const query = q.trim().toLowerCase();
  if (query) {
    jobs = jobs.filter(j =>
      j.title.toLowerCase().includes(query) ||
      j.company.toLowerCase().includes(query) ||
      (j.requiredSkills || []).some(s => s.toLowerCase().includes(query)));
  }
  if (location.trim()) {
    const loc = location.trim().toLowerCase();
    jobs = jobs.filter(j => j.location.toLowerCase().includes(loc));
  }
  if (type && type !== 'All') jobs = jobs.filter(j => j.jobType === type);
  if (experienceLevel && experienceLevel !== 'All') jobs = jobs.filter(j => j.experienceLevel === experienceLevel);
  if (workMode && workMode !== 'All') jobs = jobs.filter(j => j.workMode === workMode);

  let resume = null;
  if (resumeId) resume = db.getResumeById(resumeId, req.userId);

  const results = jobs.map(job => {
    if (!resume) return { job, matchScore: null, matchedSkills: [], missingSkills: [], reason: null };
    const scored = scoreResumeAgainstJob(resume, job.description);
    const reqSkillsLower = (job.requiredSkills || []).map(s => s.toLowerCase());
    const matchedSkills = job.requiredSkills.filter(s => scored.matchedKeywords.some(k => s.toLowerCase().includes(k)));
    const missingSkills = job.requiredSkills.filter(s => !matchedSkills.includes(s));
    return {
      job,
      matchScore: scored.overallScore,
      matchedSkills: matchedSkills.slice(0, 6),
      missingSkills: missingSkills.slice(0, 4),
      reason: matchedSkills.length
        ? `Matches ${matchedSkills.length} of ${reqSkillsLower.length} required skills.`
        : 'No direct skill overlap yet — review the requirements below.',
    };
  });

  res.json({
    jobs: results,
    count: results.length,
    filters: {
      types: [...new Set(listAllJobs().map(j => j.jobType))].sort(),
      experienceLevels: [...new Set(listAllJobs().map(j => j.experienceLevel))].sort(),
      workModes: [...new Set(listAllJobs().map(j => j.workMode))].sort(),
    },
  });
});

// GET /api/jobs/catalogue/:id — single job detail (for View / Select)
router.get('/catalogue/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ job });
});

// GET /api/jobs/recommended
// Score a small demo catalogue against the user's most recently edited resume.
// This route has no external API dependency, so Job Matches remains useful even
// when Adzuna has not been configured.
router.get('/recommended', (req, res) => {
  const summaries = db.getAllResumes(req.userId);
  if (!summaries.length) {
    return res.status(404).json({
      error: 'Create or import a resume first so we can recommend matching jobs.',
    });
  }

  const resume = db.getResumeById(summaries[0].id, req.userId);
  res.json(recommendJobs(resume));
});

// GET /api/jobs/search?what=frontend+developer&where=london&page=1
router.get('/search', async (req, res) => {
  const { what, where = '', page = 1 } = req.query;

  if (!what || !what.trim()) {
    return res.status(400).json({ error: 'A search term (what) is required.' });
  }

  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return res.status(503).json({
      error: 'Job search is not configured yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to backend/.env.',
    });
  }

  // Adzuna splits its index by country. 'us' works well as a default;
  // change to 'gb', 'au', 'ca', etc. if most of your users are elsewhere.
  const country = process.env.ADZUNA_COUNTRY || 'us';
  const pageNum = Math.max(1, Number(page) || 1);

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${pageNum}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('what', what.trim());
  if (where.trim()) url.searchParams.set('where', where.trim());
  url.searchParams.set('results_per_page', '20');
  url.searchParams.set('content-type', 'application/json');

  try {
    const adzunaRes = await fetch(url.toString());

    if (!adzunaRes.ok) {
      // Adzuna returns 4xx for bad credentials or bad params
      const body = await adzunaRes.text();
      console.error('Adzuna API error:', adzunaRes.status, body);
      return res.status(502).json({ error: 'Could not fetch jobs right now. Please try again shortly.' });
    }

    const data = await adzunaRes.json();

    // Simplify Adzuna's response down to just what the frontend needs
    const jobs = (data.results || []).map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company?.display_name || 'Unknown company',
      location: job.location?.display_name || '',
      salaryMin: job.salary_min || null,
      salaryMax: job.salary_max || null,
      description: job.description,
      url: job.redirect_url,
      posted: job.created,
    }));

    res.json({
      jobs,
      count: data.count || jobs.length,
      page: pageNum,
    });
  } catch (err) {
    console.error('Job search failed:', err);
    res.status(500).json({ error: 'Something went wrong searching for jobs.' });
  }
});

module.exports = router;
