// ==========================================================
// truthCheck.js
// This is the "truth-constrained AI output" safety layer required
// by the project brief: the AI must NEVER invent skills, employers,
// job titles, qualifications, or numbers that are not present in the
// user's original resume data.
//
// HOW IT WORKS:
// 1. We build a "ground truth" set of words/facts from the user's
//    ORIGINAL resume data (before AI touched it).
// 2. We scan the AI's rewritten text for new claims: specifically
//    new numbers/percentages, new skill-like capitalised terms, and
//    new employer/company-like phrases that were NOT in the original.
// 3. Anything suspicious gets flagged. If "strict" mode is on, the
//    flagged sentence is reverted back to the original wording.
//
// NOTE: This is a heuristic safety net for a student demo project,
// not a perfect fact-checker - we explain this limitation clearly
// in the Technical Implementation Document.
// ==========================================================

const { extractKeywords } = require('./atsScoring');

function buildGroundTruth(resume) {
  const truthText = [
    resume.summary,
    joinField(resume.skills, s => s.name || s),
    joinField(resume.experience, e => `${e.title} ${e.company} ${(e.bullets || []).join(' ')}`),
    joinField(resume.projects, p => `${p.name} ${p.description}`),
    joinField(resume.certifications, c => c.name || c),
  ].filter(Boolean).join(' ');

  return {
    words: new Set(extractKeywords(truthText)),
    numbers: new Set((truthText.match(/\b\d+(\.\d+)?%?\b/g) || [])),
  };
}

function joinField(field, mapper) {
  try {
    const arr = typeof field === 'string' ? JSON.parse(field) : field;
    if (!Array.isArray(arr)) return '';
    return arr.map(mapper).join(' ');
  } catch {
    return '';
  }
}

// Checks one piece of AI-generated text against the ground truth.
// Returns { isSafe, flags: [reasons], cleanedText }
function checkTextAgainstTruth(aiText, groundTruth, originalText = '') {
  const flags = [];

  // 1. Check for new numbers that weren't anywhere in the original resume
  const aiNumbers = aiText.match(/\b\d+(\.\d+)?%?\b/g) || [];
  const newNumbers = aiNumbers.filter(n => !groundTruth.numbers.has(n));
  if (newNumbers.length > 0) {
    flags.push(`AI introduced number(s) not found in your original resume: ${newNumbers.join(', ')}. Please verify or remove before use.`);
  }

  // 2. Check for new keywords that look like skills/tools (capitalised or tech-like words)
  const aiWords = extractKeywords(aiText);
  const newWords = aiWords.filter(w => !groundTruth.words.has(w));
  // Filter to "interesting" new words only (longer than 3 chars, likely nouns/skills)
  const suspiciousNew = newWords.filter(w => w.length > 3).slice(0, 8);
  if (suspiciousNew.length > 3) {
    flags.push(`AI text contains several terms not present in your original resume (${suspiciousNew.slice(0, 5).join(', ')}...). Review carefully - do not keep any skill or claim you cannot genuinely support.`);
  }

  const isSafe = flags.length === 0;

  return {
    isSafe,
    flags,
    // In strict mode, calling code can choose to fall back to originalText when !isSafe
    cleanedText: isSafe ? aiText : (originalText || aiText),
  };
}

// Same truth-constraint check as checkTextAgainstTruth, scoped to one
// bullet rewrite. Ground truth is the bullet's own words PLUS the rest
// of the resume (when the caller has it) — a rewrite may reuse a term
// that's genuinely true of the candidate even if it wasn't in this
// exact bullet (e.g. a skill listed in the Skills section). Checking
// against only the single bullet's own wording made almost any
// rephrasing look "unsafe" even when it introduced nothing untrue.
function checkBulletRewrite(aiText, originalBullet, resumeGroundTruth = null) {
  const groundTruth = {
    words: new Set([...extractKeywords(originalBullet || ''), ...(resumeGroundTruth?.words || [])]),
    numbers: new Set([...(String(originalBullet || '').match(/\b\d+(\.\d+)?%?\b/g) || []), ...(resumeGroundTruth?.numbers || [])]),
  };
  return checkTextAgainstTruth(aiText, groundTruth, originalBullet);
}

module.exports = { buildGroundTruth, checkTextAgainstTruth, checkBulletRewrite };
