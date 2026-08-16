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

// pdf-parse bundles a ~2017 snapshot of PDF.js that fails outright ("bad
// XRef entry" and similar) on PDFs using newer cross-reference-stream
// structures — common output from Canva, Google Docs, and some Word
// export paths, not actually corrupt or password-protected files. When
// pdf-parse throws, we retry with pdfjs-dist (actively maintained,
// current PDF.js) before giving up — same graceful-degradation shape as
// the Chromium -> pdfkit fallback used for PDF export.
async function extractPdfText(buffer) {
  try {
    const r = await pdfParse(buffer);
    return r.text;
  } catch (e) {
    console.warn('pdf-parse failed, retrying with pdfjs-dist:', e.message);
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Reconstruct line breaks from each item's hasEOL flag — without
      // this, an entire page collapses into one line and the resume
      // parser's "heading alone on its own line" section detection
      // (e.g. "SKILLS") never matches anything.
      for (const item of content.items) {
        text += item.str;
        text += item.hasEOL ? '\n' : ' ';
      }
      text += '\n';
    }
    return text;
  }
}

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
      text = await extractPdfText(file.buffer);
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
