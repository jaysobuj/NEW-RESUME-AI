// ==========================================================
// Export routes — download a resume in a chosen format & template.
//
//   GET /api/export/templates             -> template registry (for the picker)
//   GET /api/export/:id/preview?template= -> inline HTML (for the live <iframe>)
//   GET /api/export/:id/:format?template= -> download (pdf|docx|txt|html|json)
//
// ROUTE ORDER MATTERS (Express matches top-down): the literal
// "/templates" and "/:id/preview" routes are declared BEFORE the
// generic "/:id/:format" route so they aren't swallowed by it.
//
// PDF path: the HTML template is rendered by Chromium (renderHtml +
// htmlToPdf). If Chromium is unavailable for any reason we fall back to
// the legacy single-column pdfkit generator so exporting never breaks —
// the same graceful-degradation philosophy as the AI features.
// ==========================================================

const express = require('express');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { generatePDF, generateDOCX, generateTXT, generateJSON } = require('../utils/exportResume');
const { renderResumeHtml } = require('../utils/renderHtml');
const { htmlToPdf } = require('../utils/htmlToPdf');
const { listTemplates, coerceTemplate, listFonts, coerceFont } = require('../utils/templates');

const router = express.Router();
router.use(requireAuth);

const FORMATS = new Set(['pdf', 'docx', 'txt', 'html', 'json']);

function safeName(resume) {
  return (resume.full_name || 'resume').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'resume';
}

// Which template to use: an explicit ?template= wins, else the one
// stored on the resume, else the default — always coerced to valid.
function resolveTemplate(req, resume) {
  return coerceTemplate(req.query.template || resume.template);
}

// Same pattern as resolveTemplate: an explicit ?font= wins, else the
// one stored on the resume, else null (meaning "use the template's
// own default font").
function resolveFont(req, resume) {
  return coerceFont(req.query.font || resume.font);
}

// GET /api/export/templates — list available designs for the picker.
router.get('/templates', (req, res) => {
  res.json({ templates: listTemplates() });
});

// GET /api/export/fonts — list available font overrides for the picker.
router.get('/fonts', (req, res) => {
  res.json({ fonts: listFonts() });
});

// GET /api/export/:id/preview — inline HTML for the builder's live preview.
router.get('/:id/preview', (req, res) => {
  const resume = db.getResumeById(req.params.id, req.userId);
  if (!resume) return res.status(404).send('Resume not found');
  const template = resolveTemplate(req, resume);
  const font = resolveFont(req, resume);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderResumeHtml(resume, template, font));
});

// GET /api/export/:id/:format — download in the requested format.
router.get('/:id/:format', async (req, res) => {
  const { format } = req.params;
  if (!FORMATS.has(format)) {
    return res.status(400).json({ error: `Unsupported format "${format}". Use one of: ${[...FORMATS].join(', ')}.` });
  }

  const resume = db.getResumeById(req.params.id, req.userId);
  if (!resume) return res.status(404).json({ error: 'Resume not found' });

  const template = resolveTemplate(req, resume);
  const font = resolveFont(req, resume);
  const filename = safeName(resume);

  try {
    switch (format) {
      case 'pdf': {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        try {
          const buffer = await htmlToPdf(renderResumeHtml(resume, template, font));
          return res.send(buffer);
        } catch (e) {
          // Chromium unavailable — fall back to the legacy pdfkit renderer.
          console.warn('[export] PDF via Chromium failed, falling back to pdfkit:', e.code || e.message);
          return generatePDF(resume).pipe(res);
        }
      }

      case 'docx': {
        const buffer = await generateDOCX(resume);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
        return res.send(buffer);
      }

      case 'txt': {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        return res.send(generateTXT(resume));
      }

      case 'html': {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
        return res.send(renderResumeHtml(resume, template, font));
      }

      case 'json': {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        return res.send(generateJSON(resume));
      }

      default:
        return res.status(400).json({ error: 'Unsupported format.' });
    }
  } catch (err) {
    console.error('[export] failed:', err);
    return res.status(500).json({ error: 'Export failed. Please try again.', details: err.message });
  }
});

module.exports = router;
