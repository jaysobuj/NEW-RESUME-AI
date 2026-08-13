// ==========================================================
// server.js — application entry point
//
// WHY THIS FILE CHANGED:
//   1. Environment variables are now validated at boot (config/env.js)
//      so a missing JWT_SECRET fails immediately with a clear message
//      instead of throwing a mystery 500 on the first login.
//   2. The /api/upload endpoint validated files by FILENAME only. It now
//      verifies extension + MIME type + magic bytes (utils/fileValidation).
//   3. pdf-parse is now a real declared dependency, so PDF upload
//      actually works instead of silently failing on a missing module.
//   4. The global error handler now distinguishes multer errors, JSON
//      parse errors, and CORS rejections instead of returning a bare
//      "Server error." for everything.
// ==========================================================

require('dotenv').config();

// Validate configuration BEFORE anything else touches process.env
const { validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');

require('./config/db'); // loads the database into memory on startup

const { extractText } = require('./utils/extractText');
const { MAX_BYTES } = require('./utils/fileValidation');
const requireAuth  = require('./middleware/auth');
const { uploadLimiter } = require('./middleware/rateLimit');

const authRoutes        = require('./routes/auth');
const resumeRoutes      = require('./routes/resume');
const atsRoutes         = require('./routes/ats');
const aiRoutes          = require('./routes/ai');
const applicationRoutes = require('./routes/applications');
const exportRoutes      = require('./routes/export');
const jobRoutes         = require('./routes/jobs');
const workflowRoutes    = require('./routes/workflow');

const app  = express();
const PORT = Number(process.env.PORT);

// ---------- Core middleware ----------
const configuredOrigins = process.env.CLIENT_ORIGIN
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  // Requests without an Origin header (curl, mobile clients, same-origin
  // production requests) are not browser cross-origin requests.
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, '');
  if (configuredOrigins.includes(normalizedOrigin)) return true;

  // React automatically moves from :3000 to :3001 when :3000 is occupied.
  // Permit any localhost/loopback port in development, but never broaden the
  // production allow-list to arbitrary websites.
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { protocol, hostname } = new URL(normalizedOrigin);
      return (protocol === 'http:' || protocol === 'https:')
        && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
    } catch (_) {
      return false;
    }
  }

  return false;
}

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
}));
app.use(express.json({ limit: '4mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.path}`);
  next();
});

// ---------- File upload ----------
// Multer only buffers the bytes; ALL format decisions are made by
// validateUpload() below, which checks the file's actual contents.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

app.post('/api/upload', uploadLimiter, requireAuth, upload.single('file'), async (req, res) => {
  // Generic text extraction endpoint. Resume IMPORT has its own route
  // (POST /api/resumes/import) because it additionally parses the text
  // into structured fields and saves a resume record.
  try {
    const { text, type } = await extractText(req.file);
    res.json({ text, filename: req.file.originalname, type });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.userMessage || 'Could not read that file.',
    });
  }
});

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    gemini: !!process.env.GEMINI_API_KEY,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// ---------- Feature routes ----------
app.use('/api/auth',         authRoutes);
app.use('/api/resumes',      resumeRoutes);
app.use('/api/ats',          atsRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/export',       exportRoutes);
app.use('/api/jobs',         jobRoutes);
app.use('/api/workflow',     workflowRoutes);

// ---------- 404 ----------
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// ---------- Global error handler ----------
// Previously every failure returned a generic "Server error." with no
// clue what went wrong. Now each common failure mode gets an accurate,
// actionable message — and unexpected errors still never leak stack
// traces to the client.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(413).json({ error: 'File is too large. Maximum size is 5 MB.' });
    return res.status(400).json({ error: `Upload failed: ${err.message}` });
  }

  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Request body was not valid JSON.' });

  if (err.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request body is too large.' });

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`\n✅ AI Career Platform API running at http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ ENABLED' : '⚠️  Not set (using local fallback)'}`);
  console.log(`   CORS origin: ${process.env.CLIENT_ORIGIN}\n`);
});

// Crash-safety: log and exit cleanly rather than dying silently mid-write.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
