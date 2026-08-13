// Resume CRUD routes - create, read, update, delete, duplicate

const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const { extractText } = require('../utils/extractText');
const { parseResumeText } = require('../utils/resumeParser');
const { MAX_BYTES } = require('../utils/fileValidation');
const { coerceTemplate, coerceFont } = require('../utils/templates');

const router = express.Router();
router.use(requireAuth);

// Multer buffers the file in memory; extractText() does all validation.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

// Convert arrays/objects to JSON strings for storage
function stringifyFields(data) {
  const jsonFields = ['education', 'experience', 'skills', 'projects', 'certifications'];
  const out = { ...data };
  jsonFields.forEach(f => {
    if (out[f] !== undefined && typeof out[f] !== 'string') {
      out[f] = JSON.stringify(out[f]);
    }
  });
  return out;
}

// GET /api/resumes - list all resumes for this user
router.get('/', (req, res) => {
  const resumes = db.getAllResumes(req.userId);
  res.json({ resumes });
});

// ==========================================================
// POST /api/resumes/import
// Upload a PDF/DOCX/TXT resume, extract the text, parse it into
// structured fields, and save it as a new resume the user can then
// edit in the builder and use on every other page.
//
// NOTE ON ROUTE ORDER: this is declared BEFORE `GET /:id` because
// Express matches routes top-down — otherwise "/import" would be
// captured by the ":id" parameter and treated as a resume ID.
//
// NOTE ON CREDITS: importing is deliberately FREE. It is an onboarding
// step, and charging a user a credit just to get their own data into
// the app is poor UX. It is rate-limited instead, and the local
// rules-based parser means it works even with no Gemini key at all.
// ==========================================================
router.post('/import', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const { text } = await extractText(req.file);

    if (text.length < 50) {
      return res.status(422).json({
        error: 'That file contained very little text. Please check it is your resume, '
             + 'or paste the content into the builder manually.',
      });
    }

    const { fields, source, warnings } = await parseResumeText(text);

    // Name the resume after the uploaded file so the user recognises it
    const baseName = String(req.file.originalname || 'Imported Resume')
      .replace(/\.(pdf|docx|txt)$/i, '')
      .slice(0, 60)
      .trim() || 'Imported Resume';

    const resume = db.createResume({
      id: uuidv4(),
      user_id: req.userId,
      title: baseName,
      version: 1,
      template: 'modern',
      full_name: fields.full_name,
      email: fields.email,
      phone: fields.phone,
      location: fields.location,
      linkedin: fields.linkedin,
      summary: fields.summary,
      education:      JSON.stringify(fields.education),
      experience:     JSON.stringify(fields.experience),
      skills:         JSON.stringify(fields.skills),
      projects:       JSON.stringify(fields.projects),
      certifications: JSON.stringify(fields.certifications),
      imported_from: req.file.originalname,
    });

    res.status(201).json({
      resume,
      source,                 // 'gemini' or 'local_rules'
      warnings,               // fields we could not find, for honest UI feedback
      textLength: text.length,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.userMessage || 'Could not import that resume. Please try again.',
    });
  }
});

// GET /api/resumes/:id - get one full resume
router.get('/:id', (req, res) => {
  const resume = db.getResumeById(req.params.id, req.userId);
  if (!resume) return res.status(404).json({ error: 'Resume not found' });
  res.json({ resume });
});

// POST /api/resumes - create a new resume
router.post('/', (req, res) => {
  const data = stringifyFields(req.body);
  const resume = db.createResume({
    id: uuidv4(),
    user_id: req.userId,
    title: data.title || 'Untitled Resume',
    version: 1,
    full_name: data.full_name || '',
    email: data.email || '',
    phone: data.phone || '',
    location: data.location || '',
    linkedin: data.linkedin || '',
    summary: data.summary || '',
    education: data.education || '[]',
    experience: data.experience || '[]',
    skills: data.skills || '[]',
    projects: data.projects || '[]',
    certifications: data.certifications || '[]',
    // Validate against the template whitelist so only known designs
    // can ever reach the renderer.
    template: coerceTemplate(data.template),
    font: coerceFont(data.font),
  });
  res.status(201).json({ resume });
});

// PUT /api/resumes/:id - update an existing resume
router.put('/:id', (req, res) => {
  const existing = db.getResumeById(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Resume not found' });
  const data = stringifyFields(req.body);
  const updated = db.updateResume(req.params.id, req.userId, {
    title:          data.title          ?? existing.title,
    full_name:      data.full_name      ?? existing.full_name,
    email:          data.email          ?? existing.email,
    phone:          data.phone          ?? existing.phone,
    location:       data.location       ?? existing.location,
    linkedin:       data.linkedin       ?? existing.linkedin,
    summary:        data.summary        ?? existing.summary,
    education:      data.education      ?? existing.education,
    experience:     data.experience     ?? existing.experience,
    skills:         data.skills         ?? existing.skills,
    projects:       data.projects       ?? existing.projects,
    certifications: data.certifications ?? existing.certifications,
    template:       data.template !== undefined ? coerceTemplate(data.template) : (existing.template || 'modern'),
    font:           data.font !== undefined ? coerceFont(data.font) : (existing.font || null),
  });
  res.json({ resume: updated });
});

// POST /api/resumes/:id/duplicate - save as a new version, or (with
// tailoredForJobId) as a tailored variant linked back to this resume
// and the job it was tailored for. The original is never modified.
router.post('/:id/duplicate', (req, res) => {
  const original = db.getResumeById(req.params.id, req.userId);
  if (!original) return res.status(404).json({ error: 'Resume not found' });
  const { title, tailoredForJobId, tailoredForJobTitle } = req.body || {};
  const copy = db.createResume({
    ...original,
    id: uuidv4(),
    title: title || `${original.title} (v${original.version + 1})`,
    version: original.version + 1,
    ...(tailoredForJobId ? {
      parent_resume_id: original.parent_resume_id || original.id,
      tailored_for_job_id: tailoredForJobId,
      tailored_for_job_title: tailoredForJobTitle || null,
    } : {}),
  });
  res.status(201).json({ resume: copy });
});

// DELETE /api/resumes/:id
router.delete('/:id', (req, res) => {
  const deleted = db.deleteResume(req.params.id, req.userId);
  if (!deleted) return res.status(404).json({ error: 'Resume not found' });
  res.json({ success: true });
});

module.exports = router;
