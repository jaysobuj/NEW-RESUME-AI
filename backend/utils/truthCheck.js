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

const { extractKeywords, findStrictTechTerms, textHasSkill } = require('./atsScoring');

// Common professional rewrite vocabulary — action verbs and general
// workplace nouns that are safe paraphrasing regardless of whether the
// exact word appears in the original resume (e.g. resume says "helped
// customers", AI writes "resolved customer issues" — "resolved" isn't
// a new fact, it's a normal synonym). Only words OUTSIDE this list
// count toward the "unsupported claim" check below, so genuine new
// facts (tech names, tools, platforms) still get caught while normal
// wording doesn't trip false positives.
const SAFE_REWRITE_WORDS = new Set([
  'managed', 'maintained', 'supported', 'support', 'resolved', 'resolve', 'assisted', 'assist',
  'provided', 'provide', 'diagnosed', 'diagnose', 'troubleshot', 'troubleshoot', 'troubleshooting',
  'configured', 'configure', 'improved', 'improve', 'collaborated', 'collaborate', 'delivered', 'deliver',
  'administered', 'administer', 'handled', 'handle', 'utilised', 'utilized', 'utilise', 'utilize',
  'optimised', 'optimized', 'optimise', 'optimize', 'streamlined', 'streamline', 'coordinated', 'coordinate',
  'implemented', 'implement', 'developed', 'develop', 'monitored', 'monitor', 'ensured', 'ensure',
  'performed', 'perform', 'conducted', 'conduct', 'aligned', 'align', 'strengthened', 'strengthen',
  'technical', 'systems', 'system', 'users', 'user', 'customer', 'customers', 'client', 'clients',
  'software', 'hardware', 'environment', 'environments', 'reliability', 'access', 'issues', 'issue',
  'accounts', 'account', 'devices', 'device', 'services', 'service', 'operations', 'operation',
  'processes', 'process', 'procedures', 'procedure', 'documentation', 'communication', 'end-user',
  'end-users', 'setup', 'installation', 'maintenance', 'security', 'network', 'networking',
  'infrastructure', 'permissions', 'requests', 'request', 'tickets', 'ticket', 'incidents', 'incident',
  'professional', 'clearly', 'effectively', 'efficiently', 'closely', 'directly', 'first', 'point',
  'contact', 'across', 'organisation', 'organization', 'complex', 'level', 'related',
  // Common résumé-summary framing language — near-universal phrasing
  // that isn't itself a factual claim about skills/experience.
  'offering', 'offer', 'skilled', 'expertise', 'proficient', 'proficiency', 'knowledge',
  'background', 'exposure', 'familiar', 'familiarity', 'understanding', 'proven', 'demonstrated',
  'solid', 'hands-on', 'seeking', 'dedicated', 'focused', 'oriented', 'driven', 'committed',
  'reliable', 'adaptable', 'resourceful', 'detail-oriented', 'ensuring', 'continuity', 'operational',
  // Microsoft 365 <-> Office 365 is a single-fact synonym pair (see
  // SKILL_SYNONYMS in atsScoring.js) at the PHRASE level, but this
  // bulk word-novelty check works word-by-word — without this, the
  // lone word "microsoft" still counts as "new" even when the phrase
  // check already allowed the full term via the synonym match.
  'microsoft', 'office', '365', 'desk', 'remote', 'in-person', 'assistance', 'basic',
  // Docker experience is commonly described with these related words —
  // safe only in the sense that "container/containerized" is a fair
  // paraphrase of Docker work; the hard-skill check still strictly
  // requires "docker" itself to be genuinely present before crediting it.
  'specializing', 'specialize', 'specialise', 'foundations', 'foundation',
  'fundamentals', 'fundamental', 'container', 'containers', 'containerized', 'containerization',
  // "experience" itself is in atsScoring.js's STOP_WORDS (generic filler
  // when extracting REQUIRED job-ad keywords) — but that means it's also
  // silently absent from a resume's own ground truth, so an AI rewrite
  // using "experienced" always looked "new" even though describing
  // one's experience is baseline resume language, not a factual claim.
  'experience', 'experienced', 'experiences',
]);
const SAFE_REWRITE_STEMS = new Set([...SAFE_REWRITE_WORDS].flatMap(stemVariants));

// A minimal suffix-stripping stemmer — just enough to match common
// inflections ("troubleshoot" vs "troubleshooting", "resolve" vs
// "resolved") without pulling in a full NLP dependency. It doesn't need
// to be linguistically perfect, only consistent between the resume's
// words and the AI's rewrite. Returns multiple candidate stems because
// English silent-e verbs need both handled ("experience" -> "experienced"
// is "drop the final d", not "drop ed" which would wrongly give
// "experienc").
function stemVariants(word) {
  const variants = [word];
  const w = word;
  if (w.length > 6 && w.endsWith('ies')) variants.push(w.slice(0, -3) + 'y');
  if (w.length > 6 && w.endsWith('ing')) {
    variants.push(w.slice(0, -3));
    variants.push(w.slice(0, -3) + 'e'); // manage -> managing
  }
  if (w.length > 5 && w.endsWith('ed')) {
    variants.push(w.slice(0, -2)); // troubleshoot+ed -> troubleshoot
    variants.push(w.slice(0, -1)); // experience+d -> experience (silent e)
  }
  if (w.length > 5 && w.endsWith('es')) variants.push(w.slice(0, -2));
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) variants.push(w.slice(0, -1));
  return variants;
}

function buildGroundTruth(resume) {
  const truthText = [
    resume.summary,
    joinField(resume.skills, s => s.name || s),
    joinField(resume.experience, e => `${e.title} ${e.company} ${(e.bullets || []).join(' ')}`),
    joinField(resume.projects, p => `${p.name} ${p.description}`),
    joinField(resume.certifications, c => c.name || c),
  ].filter(Boolean).join(' ');

  const words = new Set(extractKeywords(truthText));
  return {
    words,
    stems: new Set([...words].flatMap(stemVariants)),
    numbers: new Set((truthText.match(/\b\d+(\.\d+)?%?\b/g) || [])),
    text: truthText.toLowerCase(),
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
//
// `bulkThreshold` (step 3 below) is deliberately higher for a whole
// rewritten SUMMARY than for a single bullet: a summary synthesises
// across the entire resume and naturally uses more connective/
// descriptive language than a line-for-line bullet edit, so the same
// tight threshold that's right for "does this one bullet still say the
// same thing" was flagging normal paragraph-level paraphrasing as bulk
// fabrication. The hard-skill check above (step 2) still strictly
// blocks any specific named technology regardless of this threshold —
// this only affects generic connective vocabulary.
function checkTextAgainstTruth(aiText, groundTruth, originalText = '', bulkThreshold = 3) {
  const flags = [];

  // 1. Check for new numbers that weren't anywhere in the original resume
  const aiNumbers = aiText.match(/\b\d+(\.\d+)?%?\b/g) || [];
  const newNumbers = aiNumbers.filter(n => !groundTruth.numbers.has(n));
  if (newNumbers.length > 0) {
    flags.push(`AI introduced number(s) not found in your original resume: ${newNumbers.join(', ')}. Please verify or remove before use.`);
  }

  // 2. Hard-skill/technology check — a rewrite that introduces even ONE
  // genuinely distinctive named technology/tool/platform not in the
  // original resume is a real fabricated claim (e.g. "Windows" ->
  // "Windows Server"), unlike ordinary paraphrasing, so this doesn't
  // need a count threshold. Scoped to STRICT_TECH_TERMS (not generic
  // job-function phrases like "technical support" — those are fair
  // paraphrasing, covered by the bulk check below instead) and matched
  // synonym-aware so "Office 365" in the resume satisfies "Microsoft
  // 365" in the rewrite — same true fact, not a new claim.
  const aiHardSkills = findStrictTechTerms(aiText);
  const newHardSkills = aiHardSkills.filter(s => !textHasSkill(groundTruth.text || '', s));
  if (newHardSkills.length > 0) {
    flags.push(`AI introduced technology/tool name(s) not found in your original resume: ${newHardSkills.join(', ')}. This must be removed unless you genuinely have this experience.`);
  }

  // 3. Bulk-fabrication check for everything else — normal professional
  // rewrite vocabulary (SAFE_REWRITE_WORDS) never counts here, so a
  // rewrite using words like "resolved" or "technical" isn't flagged
  // just because that exact word wasn't in the original. Only genuinely
  // new, unexplained vocabulary in bulk (not caught by the hard-skill
  // check above) trips this.
  const groundTruthStems = groundTruth.stems || new Set([...groundTruth.words].flatMap(stemVariants));
  const aiWords = extractKeywords(aiText);
  const newWords = aiWords.filter(w => {
    if (groundTruth.words.has(w) || SAFE_REWRITE_WORDS.has(w)) return false;
    const variants = stemVariants(w);
    return !variants.some(v => groundTruthStems.has(v) || SAFE_REWRITE_STEMS.has(v));
  });
  const suspiciousNew = newWords.filter(w => w.length > 3).slice(0, 8);
  if (suspiciousNew.length > bulkThreshold) {
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
  const words = new Set([...extractKeywords(originalBullet || ''), ...(resumeGroundTruth?.words || [])]);
  const groundTruth = {
    words,
    stems: new Set([...words].flatMap(stemVariants)),
    numbers: new Set([...(String(originalBullet || '').match(/\b\d+(\.\d+)?%?\b/g) || []), ...(resumeGroundTruth?.numbers || [])]),
    text: `${(originalBullet || '').toLowerCase()} ${resumeGroundTruth?.text || ''}`,
  };
  return checkTextAgainstTruth(aiText, groundTruth, originalBullet);
}

module.exports = { buildGroundTruth, checkTextAgainstTruth, checkBulletRewrite };
