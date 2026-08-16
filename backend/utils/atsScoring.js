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
  'work','working','team','ability',
  // Generic job-ad boilerplate — these show up in almost every listing
  // regardless of what the job actually needs, so they're noise as
  // "missing keywords", not genuine requirements.
  'typically','suited','candidates','candidate','essential','closely','participate',
  'maintainable','thousands','used','write','clean','fundamentals','requirements',
  'responsibilities','environment','strong','across','stack','key','skills','build',
  'design','using','including','ensure','ensuring','help','helping','new','existing',
  'every','day','daily','part','plus','join','joining','apply','applicants','include',
  'includes','ideal','suitable','background','role','position','opportunity','well',
  'good','great','excellent','high','level','levels','based','make','making','need',
  'needs','needed','various','multiple','wide','range','ongoing',
]);

// Curated technology/tool/platform names. Used for two things:
//  1. ATS scoring — these are the "hard skills" that should carry far
//     more weight than generic job-ad language when matching a resume
//     against a job.
//  2. truthCheck.js — a rewrite that introduces even ONE of these not
//     present in the original resume is a real fabricated claim, unlike
//     a single generic new word (which is normal paraphrasing).
// Not exhaustive by design — it only needs to catch common, genuinely
// distinctive terms, not tokenise every possible technology on earth.
const HARD_SKILLS = [
  'javascript','typescript','python','java','c++','c#','php','ruby','go','golang','swift','kotlin',
  'node.js','nodejs','react','angular','vue','next.js','express','django','flask','spring',
  'html','css','sass','tailwind','bootstrap',
  'sql','mysql','postgresql','postgres','mongodb','sqlite','oracle','redis','nosql',
  'rest apis','rest api','graphql','microservices','soap',
  'docker','kubernetes','ci/cd','jenkins','git','github','gitlab','terraform','ansible',
  'aws','azure','gcp','google cloud','cloud computing',
  'windows server','active directory','dns','dhcp','vpn','vlans','vlan','tcp/ip',
  'cisco','firewalls','firewall','network security','vulnerability assessment','penetration testing',
  'siem','incident response','risk assessment','splunk','wireshark','nmap','metasploit','kali linux',
  'machine learning','deep learning','data science','pandas','numpy','tensorflow','pytorch',
  'power bi','tableau','excel','data structures','algorithms','agile','scrum','jira',
  'unit testing','automated testing','test automation','selenium','manual testing',
  'salesforce','sap','erp','crm','linux','ubuntu','macos','windows',
  // IT support / help desk phrases — a whole job category in this app's
  // demo catalogue, so these need to be recognised as real hard skills
  // rather than falling through to generic single-word keyword matching.
  'help desk','service desk','technical support','hardware troubleshooting',
  'software troubleshooting','remote support','network troubleshooting',
  'microsoft 365','office 365','ticketing systems','end-user support','end user support',
  'customer service','it support',
  // Field/technician phrases — same reasoning as IT support above.
  'cabling','soldering','circuit testing','fault diagnosis','equipment maintenance',
  'technical documentation','quality control',
  // Sales phrases — same reasoning: recognised as real hard skills for
  // sales-category jobs instead of falling through to generic keywords.
  'b2b sales','lead generation','cold calling','prospecting','territory management',
  'account management','client relationship management','negotiation','upselling',
  'cash handling','product knowledge','pos systems',
];

// Generic job-FUNCTION phrases — these describe the nature of the work
// ("technical support", "help desk") rather than a specific named
// technology/tool/product. A resume that describes "helping people with
// computer problems" genuinely IS technical support; that's a fair
// paraphrase, not a new claim. truthCheck.js uses this to exclude them
// from its single-term fabrication block (they're still covered by its
// bulk-fabrication check) — only a genuinely distinctive named
// technology (Windows, AWS, Cisco...) triggers that block on its own.
const GENERIC_ROLE_PHRASES = new Set([
  'help desk','service desk','technical support','hardware troubleshooting',
  'software troubleshooting','remote support','network troubleshooting',
  'end-user support','end user support','customer service','it support',
  'cabling','soldering','circuit testing','fault diagnosis','equipment maintenance',
  'technical documentation','quality control',
  'b2b sales','lead generation','cold calling','prospecting','territory management',
  'account management','client relationship management','negotiation','upselling',
  'cash handling','product knowledge','pos systems',
]);
const STRICT_TECH_TERMS = HARD_SKILLS.filter(s => !GENERIC_ROLE_PHRASES.has(s));

// Small, controlled synonym map: different wording for the SAME true
// skill (never different skills — "PC troubleshooting" and "hardware
// troubleshooting" describe the same real activity, but "AWS" and
// "Azure" don't). Used so a resume that says "PC troubleshooting"
// still credits the candidate for "hardware troubleshooting" without
// us inventing anything.
const SKILL_SYNONYMS = {
  'hardware troubleshooting': ['pc troubleshooting', 'computer troubleshooting', 'device troubleshooting'],
  'software troubleshooting': ['software issues', 'application troubleshooting', 'application issues'],
  'technical support': ['technical assistance', 'tech support', 'it support'],
  'microsoft 365': ['office 365', 'o365', 'ms 365'],
  'network troubleshooting': ['network issues', 'network problems', 'connectivity issues'],
  'remote support': ['remote assistance', 'remote troubleshooting', 'remote desktop support'],
  'customer service': ['customer support', 'client service'],
  'help desk': ['service desk'],
};

// Finds which curated hard-skill terms appear in a block of text
// (case-insensitive substring match, so multi-word terms like
// "rest apis" are caught, not just single tokens). Also credits a
// skill if any of its controlled synonyms appear.
function findHardSkills(text) {
  const lower = (text || '').toLowerCase();
  return HARD_SKILLS.filter(skill => textHasSkill(lower, skill));
}

// Same, but restricted to genuinely distinctive named technologies —
// used by truthCheck.js so a fabricated PRODUCT name (e.g. "Windows"
// used truthfully -> AI writes "Windows Server") still blocks on its
// own, while a paraphrased job FUNCTION ("technical support") doesn't.
function findStrictTechTerms(text) {
  const lower = (text || '').toLowerCase();
  return STRICT_TECH_TERMS.filter(skill => textHasSkill(lower, skill));
}

function textHasSkill(lowerText, skill) {
  const s = skill.toLowerCase();
  if (lowerText.includes(s)) return true;
  const synonyms = SKILL_SYNONYMS[s];
  return !!synonyms && synonyms.some(syn => lowerText.includes(syn));
}

// Words that signal a resume uses strong "action verbs" (good for ATS/recruiters)
const ACTION_VERBS = [
  'achieved','built','created','designed','developed','delivered','managed',
  'led','implemented','improved','increased','reduced','launched','organized',
  'coordinated','analyzed','automated','streamlined','optimized','resolved',
  'collaborated','mentored','trained','presented','negotiated','initiated',
  'established','executed','maintained','engineered','architected','deployed',
  'tested','debugged','documented','researched','planned','supervised',
  'supported','diagnosed','troubleshot','configured','administered','assisted',
  'provided','installed','repaired','escalated','monitored','handled',
];

// Turn a block of text into a clean list of significant lowercase words
function extractKeywords(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, ' ') // keep letters, numbers, and a few tech symbols like C++/#
    .split(/\s+/)
    // A trailing '.' is end-of-sentence punctuation, not part of the
    // word (the char class above keeps '.' for things like "node.js",
    // but that leaves ordinary sentence-ending words like "staff." never
    // matching their period-less form elsewhere).
    .map(w => w.replace(/\.+$/, ''))
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

// Main scoring function. `requiredSkills` is optional — when the caller
// has the job's own curated skill list (e.g. seedJobs.json's
// requiredSkills/preferredSkills, already hand-picked hard skills), we
// score against THAT instead of re-deriving skills from job-ad prose.
// It's a far more reliable signal than generic keyword tokenisation, so
// it gets the largest single weight below.
function scoreResumeAgainstJob(resume, jobDescription, requiredSkills = []) {
  const resumeText = resumeToText(resume).toLowerCase();
  const resumeWords = new Set(extractKeywords(resumeText));
  const jobKeywords = extractKeywords(jobDescription);

  // 1. Keyword match (how many job-description keywords appear in the resume)
  const matched = jobKeywords.filter(k => resumeWords.has(k));
  const missing = jobKeywords.filter(k => !resumeWords.has(k));
  const keywordMatchRatio = jobKeywords.length > 0 ? matched.length / jobKeywords.length : 0;
  const keywordScore = clampScore(keywordMatchRatio * 100);

  // 2. Skills match. If we have the job's curated skill list, that's the
  // ground truth for "hard skills matched/missing". Otherwise fall back
  // to deriving hard skills straight out of the job description text.
  let skillsList = [];
  try {
    skillsList = (typeof resume.skills === 'string' ? JSON.parse(resume.skills) : resume.skills) || [];
  } catch { skillsList = []; }
  // FIX — multi-word skills were never matching.
  // Previously each skill was stored whole ("project management") and
  // compared against single job keywords ("project"), so a Set lookup
  // could never hit. We now tokenise skills the same way we tokenise the
  // job description, and keep the whole phrase as well.
  const skillsWords = new Set();
  const skillsPhraseText = [];
  skillsList.forEach(s => {
    const label = (typeof s === 'string' ? s : s.name || '').toLowerCase().trim();
    if (!label) return;
    skillsWords.add(label);                       // whole phrase
    skillsPhraseText.push(label);
    extractKeywords(label).forEach(w => skillsWords.add(w)); // individual words
  });
  const skillsText = skillsPhraseText.join(' ') + ' ' + resumeText;

  const curatedSkills = (requiredSkills || []).map(s => String(s).trim()).filter(Boolean);
  let hardMatched, hardMissing, skillsScore, relevantTerms;
  if (curatedSkills.length > 0) {
    hardMatched = curatedSkills.filter(s => textHasSkill(skillsText, s));
    hardMissing = curatedSkills.filter(s => !textHasSkill(skillsText, s));
    skillsScore = clampScore((hardMatched.length / curatedSkills.length) * 100);
    relevantTerms = curatedSkills;
  } else {
    // No curated list available (e.g. a manually pasted job description)
    // — derive hard skills straight from the job text as the next-best signal.
    const jobHardSkills = findHardSkills(jobDescription);
    hardMatched = jobHardSkills.filter(s => textHasSkill(skillsText, s));
    hardMissing = jobHardSkills.filter(s => !textHasSkill(skillsText, s));
    const skillMatches = jobKeywords.filter(k => skillsWords.has(k));
    // FIX — score could exceed 100%. The denominator was capped at 15 but
    // the numerator was not, so a resume matching 20 of 30 job keywords
    // scored (20/15)*100 = 133%. Cap the numerator to the same ceiling.
    const skillsCeiling = Math.min(jobKeywords.length, 15);
    const cappedMatches = Math.min(skillMatches.length, skillsCeiling);
    skillsScore = skillsCeiling > 0 ? clampScore(Math.round((cappedMatches / skillsCeiling) * 100)) : 0;
    relevantTerms = jobHardSkills.length ? jobHardSkills : jobKeywords.slice(0, 15);
  }

  // 2b. Experience & summary relevance — how much of what the job asks
  // for is made EXPLICIT in the sections that matter most, not just
  // somewhere in the resume. This is what actually moves when tailoring
  // rewrites the summary/bullets, so it's what lets legitimate tailoring
  // produce a real score increase instead of being diluted across
  // static sections (contact info, formatting) that never change.
  const experienceText = safeJoinExperience(resume.experience).toLowerCase();
  const summaryText = (resume.summary || '').toLowerCase();
  const relevanceCeiling = Math.max(relevantTerms.length, 1);
  const experienceRelevanceScore = clampScore(
    (relevantTerms.filter(t => textHasSkill(experienceText, t) || experienceText.includes(String(t).toLowerCase())).length / relevanceCeiling) * 100
  );
  const summaryRelevanceScore = clampScore(
    (relevantTerms.filter(t => textHasSkill(summaryText, t) || summaryText.includes(String(t).toLowerCase())).length / relevanceCeiling) * 100
  );

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

  // Weighted overall score - weights add up to 1.0.
  // Content/job-relevance (keyword + skills + experience + summary
  // relevance) now drives 85% of the score. Static checks that don't
  // change before/after tailoring (section completeness, contact,
  // formatting) are capped at a combined 10% — otherwise a resume can
  // sit at 60%+ just from formatting alone, leaving tailoring almost
  // nothing to move. Measurable achievements is deliberately unweighted
  // (0%) here: we do NOT want the AI pressured into inventing metrics
  // to chase a higher score — it's still computed and shown below.
  const weights = {
    keyword: 0.30,
    skills: 0.25,
    experienceRelevance: 0.20,
    summaryRelevance: 0.10,
    actionVerb: 0.05,
    section: 0.04,
    contact: 0.03,
    formatting: 0.03,
  };

  const overallScore = clampScore(
    keywordScore * weights.keyword +
    skillsScore * weights.skills +
    experienceRelevanceScore * weights.experienceRelevance +
    summaryRelevanceScore * weights.summaryRelevance +
    actionVerbScore * weights.actionVerb +
    sectionScore * weights.section +
    contactScore * weights.contact +
    formattingScore * weights.formatting
  );

  // Build human-readable suggestions
  const suggestions = [];
  if (hardMissing.length > 0) {
    suggestions.push(`This job asks for these skills your resume doesn't show: ${hardMissing.slice(0, 10).join(', ')}. Only add them to your resume if you genuinely have this experience.`);
  } else if (missing.length > 0) {
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
  if (summaryRelevanceScore < 50) {
    suggestions.push('Make your professional summary explicitly mention job-relevant skills you already have, using the job\u2019s own terminology where truthful.');
  }
  if (experienceRelevanceScore < 50) {
    suggestions.push('Make your work experience bullets explicitly reflect job-relevant tasks you\u2019ve genuinely done, not just generic descriptions.');
  }
  if (suggestions.length === 0) {
    suggestions.push('Great work! Your resume is well aligned with this job description.');
  }

  return {
    overallScore,
    breakdown: {
      keywordMatch: keywordScore,
      skillsMatch: skillsScore,
      experienceRelevance: experienceRelevanceScore,
      summaryRelevance: summaryRelevanceScore,
      sectionCompleteness: sectionScore,
      contactDetails: contactScore,
      actionVerbs: actionVerbScore,
      measurableAchievements: achievementScore,
      formatting: formattingScore,
    },
    matchedKeywords: matched.slice(0, 30),
    missingKeywords: missing.slice(0, 30),
    // Curated hard-skill matches — the higher-confidence signal used for
    // the "Matched/Missing Technical Skills" UI, separate from generic
    // keyword overlap above.
    matchedSkills: hardMatched,
    missingSkills: hardMissing,
    suggestions,
    formattingIssues,
  };
}

module.exports = {
  scoreResumeAgainstJob, extractKeywords, resumeToText, clampScore,
  findHardSkills, findStrictTechTerms, textHasSkill, HARD_SKILLS, STRICT_TECH_TERMS,
};
