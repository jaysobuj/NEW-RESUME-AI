// ==========================================================
// fileValidation.js
//
// WHY THIS FILE EXISTS:
// The original upload endpoint decided how to parse a file purely from
// its filename: `name.endsWith('.docx')`. A filename is user-controlled
// and proves nothing — renaming anything.exe to anything.docx would
// push arbitrary bytes into the mammoth parser.
//
// This module checks THREE things that must all agree:
//   1. the file extension,
//   2. the browser-reported MIME type (Content-Type),
//   3. the file's own magic bytes (the first few bytes of real file
//      formats are fixed signatures — this is the only check a
//      determined attacker cannot fake without supplying a genuinely
//      valid file of that type).
//
// Only if all three agree do we hand the buffer to a parser.
// ==========================================================

// Accepted formats. Each MIME list includes the loose types browsers
// sometimes send (octet-stream, text/plain) so real users aren't
// blocked — the magic-byte check is what actually enforces the format.
const ACCEPTED = {
  pdf: {
    ext: '.pdf',
    mimes: ['application/pdf', 'application/x-pdf', 'application/octet-stream'],
    // PDF files always start with the ASCII bytes "%PDF"
    magic: (buf) => buf.length >= 4 && buf.toString('ascii', 0, 4) === '%PDF',
  },
  docx: {
    ext: '.docx',
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/octet-stream',
    ],
    // .docx is a ZIP archive — ZIP files start with "PK\x03\x04"
    magic: (buf) =>
      buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,
  },
  txt: {
    ext: '.txt',
    mimes: ['text/plain', 'application/octet-stream'],
    // Plain text has no signature. Instead we reject anything containing
    // NULL bytes in the first 1 KB, which reliably identifies binary data.
    magic: (buf) => !buf.subarray(0, 1024).includes(0x00),
  },
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — a resume or job ad is never larger

/**
 * Validate an uploaded file from multer.
 * @returns {{ ok: true, type: 'pdf'|'docx'|'txt' } | { ok: false, error: string }}
 */
function validateUpload(file) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    return { ok: false, error: 'No file uploaded, or the file is empty.' };
  }

  if (file.buffer.length > MAX_BYTES) {
    return { ok: false, error: 'File is too large. Maximum size is 5 MB.' };
  }

  const name = String(file.originalname || '').toLowerCase();

  // Reject path traversal characters in the filename outright.
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return { ok: false, error: 'Invalid file name.' };
  }

  const type = Object.keys(ACCEPTED).find(k => name.endsWith(ACCEPTED[k].ext));
  if (!type) {
    return { ok: false, error: 'Only PDF, DOCX, and TXT files are supported.' };
  }

  const spec = ACCEPTED[type];

  // 2. MIME type reported by the browser
  const mime = String(file.mimetype || '').toLowerCase();
  if (!spec.mimes.includes(mime)) {
    return {
      ok: false,
      error: `That file says it is ${type.toUpperCase()} but its content type is "${mime}". Please re-save it and try again.`,
    };
  }

  // 3. Magic bytes — the authoritative check
  if (!spec.magic(file.buffer)) {
    return {
      ok: false,
      error: `That file is not a valid ${type.toUpperCase()} file. It may be renamed or corrupted.`,
    };
  }

  return { ok: true, type };
}

module.exports = { validateUpload, MAX_BYTES };
