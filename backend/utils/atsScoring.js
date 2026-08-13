// ==========================================================
// atsScoring.js
// This is our LOCAL, RULE-BASED ATS (Applicant Tracking System) scorer.
// It does NOT need any AI/API key - it works 100% offline using
// simple text analysis. This guarantees the demo always works.
//
// HOW IT WORKS (high level):
// 1. We pull all the text out of the resume (summary + experience + skills + projects).
// 2. We pull "keywords" out of the job description (simple noun/skill extraction).
// 3. We compare the two word lists to find matches and gaps.
// 4. We check other ATS-friendliness factors: contact info, action verbs,
//    numbers/achievements, and section completeness.
// 5. We combine everything into a weighted score out of 100.
// ==========================================================

// A small list of common English "stop words" we ignore when comparing text.
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','be','been','being',
  'to','of','in','on','for','with','as','by','at','from','that','this','these',
  'those','it','its','into','will','you','your','we','our','they','their',
  'have','has','had','do','does','did','can','could','should','would','may',
  'might','must','shall','not','no','yes','if','than','then','so','such',
  'about','across','after','again','all','also','any','because','before',
  'between','both','each','either','etc','how','however','more','most',
  'other','over','same','some','than','too','under','up','very','what',
  'when','where','which','while','who','whom','why','job','role','company',
  'looking','seeking','years','year','experience','required','preferred',
  'work','working','team','ability'
]);

// Words that signal a resume uses strong "action verbs" (good for ATS/recruiters)
const ACTION_VERBS = [
  'achieved','built','created','designed','developed','delivered','managed',
  'led','implemented','improved','increased','reduced','launched','organized',
  'coordinated','analyzed','automated','streamlined','optimized','resolved',
  'collaborated','mentored','trained','presented','negotiated','initiated',
  'established','executed','maintained','engineered','architected','deployed',
  'tested','debugged','documented','researched','planned','supervised'
];

// Turn a block of text into a clean list of significant lowercase words
function extractKeywords(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, ' ') // keep letters, numbers, and a few tech symbols like C++/#
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // Remove duplicates
  return [...new Set(words)];
}

// Combine all resume fields into one big searchable text blob
function resumeToText(resume) {
  const parts = [
    resume.summary,
    safeJoin(resume.skills),
    safeJoinExperience(resume.experience),
    safeJoinProjects(resume.projects),
    safeJoin(resume.certifications),
  ];
  return parts.filter(Boolean).join(' ');
}

function safeJoin(jsonField) {
  try {
    const arr = typeof jsonField === 'string' ? JSON.parse(jsonField) : jsonField;
    if (!Array.isArray(arr)) return '';
    return arr.map(i => (typeof i === 'string' ? i : i.name || '')).join(' ');
  } catch {
    return '';
  }
}

function safeJoinExperience(jsonField) {
  try {
    const arr = typeof jsonField === 'string' ? JSON.parse(jsonField) : jsonField;
    if (!Array.isArray(arr)) return '';
    return arr
      .map(e => `${e.title || ''} ${e.company || ''} ${(e.bullets || []).join(' ')}`)
      .join(' ');
  } catch {
    return '';
  }
}

function safeJoinProjects(jsonField) {
  try {
    const arr = typeof jsonField === 'string' ? JSON.parse(jsonField) : jsonField;
    if (!Array.isArray(arr)) return '';
    return arr.map(p => `${p.name || ''} ${p.description || ''}`).join(' ');
  } catch {
    return '';
  }
}

// Check whether the resume text contains any digits or % signs (measurable achievements)
function countMeasurableAchievements(resumeText) {
  const matches = resumeText.match(/\b\d+(\.\d+)?%?\b/g);
  return matches ? matches.length : 0;
}

// Check how many action verbs appear in the resume text
function countActionVerbs(resumeText) {
  const lower = resumeText.toLowerCase();
  return ACTION_VERBS.filter(verb => lower.includes(verb)).length;
}

// Guarantees any computed score sits within 0-100.
// Every sub-score is passed through this so a UI progress bar can never
// render past its track, and the weighted total can never exceed 100.
function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Main scoring function
function scoreResumeAgainstJob(resume, jobDescription) {
  const resumeText = resumeToText(resume).toLowerCase();
  const resumeWords = new Set(extractKeywords(resumeText));
  const jobKeywords = extractKeywords(jobDescription);

  // 1. Keyword match (how many job-description keywords appear in the resume)
  const matched = jobKeywords.filter(k => resumeWords.has(k));
  const missing = jobKeywords.filter(k => !resumeWords.has(k));
  const keywordMatchRatio = jobKeywords.length > 0 ? matched.length / jobKeywords.length : 0;
  const keywordScore = clampScore(keywordMatchRatio * 100);

  // 2. Skills match specifically (if resume.skills provided)
  let skillsList = [];
  try {
    skillsList = (typeof resume.skills === 'string' ? JSON.parse(resume.skills) : resume.skills) || [];
  } catch { skillsList = []; }
  // FIX 1 — multi-word skills were never matching.
  // Previously each skill was stored whole ("project management") and
  // compared against single job keywords ("project"), so a Set lookup
  // could never hit. We now tokenise skills the same way we tokenise the
  // job description, and keep the whole phrase as well.
  const skillsWords = new Set();
  skillsList.forEach(s => {
    const label = (typeof s === 'string' ? s : s.name || '').toLowerCase().trim();
    if (!label) return;
    skillsWords.add(label);                       // whole phrase
    extractKeywords(label).forEach(w => skillsWords.add(w)); // individual words
  });

  const skillMatches = jobKeywords.filter(k => skillsWords.has(k));

  // FIX 2 — score could exceed 100%.
  // The denominator was capped at 15 but the numerator was not, so a
  // resume matching 20 of 30 job keywords scored (20/15)*100 = 133%.
  // We now cap the numerator to the same ceiling and clamp the result,
  // so the value is mathematically guaranteed to sit in 0-100.
  const skillsCeiling  = Math.min(jobKeywords.length, 15);
  const cappedMatches  = Math.min(skillMatches.length, skillsCeiling);
  const skillsScore    = skillsCeiling > 0
    ? clampScore(Math.round((cappedMatches / skillsCeiling) * 100))
    : 0;

  // 3. Section completeness - does the resume have all key sections filled in?
  const sections = ['summary', 'education', 'experience', 'skills'];
  const filledSections = sections.filter(s => {
    const val = resume[s];
    if (!val) return false;
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      return Array.isArray(parsed) ? parsed.length > 0 : String(val).trim().length > 0;
    } catch {
      return String(val).trim().length > 0;
    }
  });
  const sectionScore = clampScore((filledSections.length / sections.length) * 100);

  // 4. Contact details presence
  const hasEmail = !!(resume.email && resume.email.includes('@'));
  const hasPhone = !!(resume.phone && resume.phone.replace(/\D/g, '').length >= 8);
  const contactScore = clampScore(((hasEmail ? 1 : 0) + (hasPhone ? 1 : 0)) / 2 * 100);

  // 5. Action verbs
  const actionVerbCount = countActionVerbs(resumeText);
  const actionVerbScore = clampScore((actionVerbCount / 8) * 100);

  // 6. Measurable achievements (numbers/percentages)
  const achievementCount = countMeasurableAchievements(resumeText);
  const achievementScore = clampScore((achievementCount / 5) * 100);

  // 7. Formatting friendliness - very simple heuristic checks
  const formattingIssues = [];
  if (!resume.full_name) formattingIssues.push('Missing full name');
  if (resumeText.length < 200) formattingIssues.push('Resume content looks too short for ATS parsing');
  if (skillsList.length === 0) formattingIssues.push('No skills listed separately (ATS systems weight the Skills section heavily)');
  const formattingScore = clampScore(100 - formattingIssues.length * 20);

  // Weighted overall score - weights add up to 1.0
  const weights = {
    keyword: 0.30,
    skills: 0.20,
    section: 0.15,
    contact: 0.10,
    actionVerb: 0.10,
    achievement: 0.10,
    formatting: 0.05,
  };

  const overallScore = clampScore(
    keywordScore * weights.keyword +
    skillsScore * weights.skills +
    sectionScore * weights.section +
    contactScore * weights.contact +
    actionVerbScore * weights.actionVerb +
    achievementScore * weights.achievement +
    formattingScore * weights.formatting
  );

  // Build human-readable suggestions
  const suggestions = [];
  if (missing.length > 0) {
    suggestions.push(`Add these missing keywords if genuinely applicable to your background: ${missing.slice(0, 10).join(', ')}.`);
  }
  if (actionVerbScore < 60) {
    suggestions.push('Use more strong action verbs (e.g. "developed", "led", "improved") at the start of your bullet points.');
  }
  if (achievementScore < 60) {
    suggestions.push('Add measurable achievements with numbers or percentages (e.g. "reduced processing time by 20%").');
  }
  if (!hasEmail || !hasPhone) {
    suggestions.push('Make sure your email and phone number are both clearly listed at the top of your resume.');
  }
  if (sectionScore < 100) {
    suggestions.push(`Complete these missing sections: ${sections.filter(s => !filledSections.includes(s)).join(', ')}.`);
  }
  if (skillsScore < 50) {
    suggestions.push('Add more of the job\u2019s required skills to your Skills section - only if you genuinely have them.');
  }
  if (suggestions.length === 0) {
    suggestions.push('Great work! Your resume is well aligned with this job description.');
  }

  return {
    overallScore,
    breakdown: {
      keywordMatch: keywordScore,
      skillsMatch: skillsScore,
      sectionCompleteness: sectionScore,
      contactDetails: contactScore,
      actionVerbs: actionVerbScore,
      measurableAchievements: achievementScore,
      formatting: formattingScore,
    },
    matchedKeywords: matched.slice(0, 30),
    missingKeywords: missing.slice(0, 30),
    suggestions,
    formattingIssues,
  };
}

module.exports = { scoreResumeAgainstJob, extractKeywords, resumeToText, clampScore };
