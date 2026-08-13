// ==========================================================
// extractText.js
//
// WHY THIS FILE EXISTS:
// The file -> text logic lived inline inside server.js's /api/upload
// handler. Now that resume import ALSO needs to read PDF/DOCX/TXT, that
// logic has to be shared rather than copy-pasted. This module owns it,
// and both endpoints call it.
//
// It runs the same validation as before (extension + MIME + magic bytes
// via fileValidation.js), then returns plain text.
// ==========================================================

const mammoth  = require('mammoth');
const pdfParse = require('pdf-parse');
const { validateUpload } = require('./fileValidation');

/**
 * Turn an uploaded file (from multer) into plain text.
 * Throws an Error with a user-safe `.userMessage` and `.status` on failure,
 * so route handlers can respond consistently.
 */
async function extractText(file) {
  const check = validateUpload(file);
  if (!check.ok) {
    const err = new Error(check.error);
    err.userMessage = check.error;
    err.status = 400;
    throw err;
  }

  let text = '';
  try {
    if (check.type === 'docx') {
      const r = await mammoth.extractRawText({ buffer: file.buffer });
      text = r.value;
    } else if (check.type === 'pdf') {
      const r = await pdfParse(file.buffer);
      text = r.text;
    } else {
      text = file.buffer.toString('utf-8');
    }
  } catch (e) {
    console.error('Parse failed:', e.message);
    const err = new Error(e.message);
    err.userMessage = 'Could not read that file. It may be password-protected or damaged. '
                    + 'Try copying and pasting the text instead.';
    err.status = 422;
    throw err;
  }

  // Normalise whitespace: PDFs in particular produce ragged line breaks
  // and non-breaking spaces that confuse downstream section detection.
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) {
    const err = new Error('empty');
    err.userMessage = 'That file opened correctly but contained no readable text. '
                    + 'If it is a scanned document or an image, please copy and paste the text instead.';
    err.status = 422;
    throw err;
  }

  return { text, type: check.type };
}

module.exports = { extractText };
