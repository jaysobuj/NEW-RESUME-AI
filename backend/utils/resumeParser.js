// ==========================================================
// resumeParser.js
//
// WHY THIS FILE EXISTS:
// Turning raw resume text into the structured shape the Resume Builder
// expects (full_name, email, phone, summary, skills[], experience[],
// education[]) is genuinely hard — resume layouts vary wildly.
//
// STRATEGY — same two-tier pattern used everywhere else in this project
// (see aiService.js):
//   1. If GEMINI_API_KEY is set, ask Gemini to return strict JSON.
//      It handles unusual layouts far better than regex.
//   2. If Gemini is missing, rate-limited, or returns junk, fall back to
//      a deterministic rules-based parser. It is less clever but never
//      fails, so importing always works — including in an offline demo.
//
// SAFETY: this parser only ever EXTRACTS what is already written in the
// user's own file. It never invents content. Anything it cannot find is
// left blank for the user to fill in, which is the honest behaviour —
// silently guessing a job title would be worse than leaving it empty.
// ==========================================================

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ----------------------------------------------------------
// Rules-based fallback
// ----------------------------------------------------------

const SECTION_PATTERNS = {
  summary:    /^\s*(professional\s+summary|summary|profile|objective|about\s+me|career\s+objective)\s*:?\s*$/i,
  experience: /^\s*(work\s+experience|professional\s+experience|employment(\s+history)?|experience|career\s+history)\s*:?\s*$/i,
  education:  /^\s*(education|academic\s+background|qualifications|academic\s+qualifications)\s*:?\s*$/i,
  skills:     /^\s*(skills|technical\s+skills|key\s+skills|core\s+competencies|competencies)\s*:?\s*$/i,
  projects:   /^\s*(projects|key\s+projects|personal\s+projects)\s*:?\s*$/i,
  certs:      /^\s*(certifications?|licences?|licenses?|accreditations?)\s*:?\s*$/i,
};

function findEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function findPhone(text) {
  // Handles common AU formats: 0412 345 678, +61 412 345 678, (02) 9999 9999
  const m = text.match(/(\+?\d{1,3}[\s-]?)?(\(?0?\d{1,2}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b/);
  if (!m) return '';
  const digits = m[0].replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? m[0].trim() : '';
}

function findLinkedIn(text) {
  const m = text.match(/(https?:\/\/)?(www\.)?(linkedin\.com\/in\/[A-Za-z0-9_-]+|github\.com\/[A-Za-z0-9_-]+)/i);
  return m ? m[0] : '';
}

function findName(lines, email) {
  // The name is almost always in the first few lines, and is the first
  // line that looks like a person's name: 2-4 words, mostly letters, no
  // digits, no @ sign, not a section heading.
  for (const raw of lines.slice(0, 8)) {
    const line = raw.trim();
    if (!line || line.length > 60) continue;
    if (line.includes('@') || /\d/.test(line)) continue;
    if (Object.values(SECTION_PATTERNS).some(p => p.test(line))) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-z][A-Za-z'.\- ]+$/.test(line)) {
      return line;
    }
  }
  // Fall back to guessing from the email local part (e.g. adnan.sami@ -> Adnan Sami)
  if (email) {
    const local = email.split('@')[0].replace(/\d+/g, '');
    const parts = local.split(/[._-]+/).filter(p => p.length > 1);
    if (parts.length >= 2) {
      return parts.map(p => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    }
  }
  return '';
}

// Split the document into labelled sections based on heading lines.
function splitSections(lines) {
  const sections = {};
  let current = 'header';
  sections[current] = [];

  for (const line of lines) {
    const key = Object.keys(SECTION_PATTERNS).find(k => SECTION_PATTERNS[k].test(line));
    if (key) {
      current = key;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }
  return sections;
}

function parseSkills(sectionLines) {
  if (!sectionLines || !sectionLines.length) return [];
  const joined = sectionLines.join(', ');
  return joined
    .split(/[,;|•·\u2022\n]+/)
    .map(s => s.replace(/^[-–—*\s]+/, '').trim())
    .filter(s => s.length > 1 && s.length < 50)
    .slice(0, 40);
}

function parseExperience(sectionLines) {
  if (!sectionLines || !sectionLines.length) return [];
  const entries = [];
  let current = null;

  const isBullet = (l) => /^[-–—*•·\u2022]/.test(l.trim());
  const dateRange = /((19|20)\d{2}|present|current|now)/i;

  for (const raw of sectionLines) {
    const line = raw.trim();
    if (!line) continue;

    if (isBullet(line)) {
      if (current) current.bullets.push(line.replace(/^[-–—*•·\u2022]\s*/, '').trim());
      continue;
    }

    // A non-bullet line containing a year usually starts a new role
    if (dateRange.test(line) || !current) {
      if (current) entries.push(current);
      // Try to split "Job Title — Company" or "Job Title at Company"
      // Split on ' - ', ' – ', ' — ', ' | ', ' at ' or ', ' — resumes use all of these
      const parts = line.split(/\s+[-–—|]\s+|\s+\bat\b\s+|,\s+/);
      const dates = line.match(/((19|20)\d{2})\s*[-–—to]+\s*((19|20)\d{2}|present|current)/i);
      current = {
        title: (parts[0] || '').replace(/\d{4}.*$/, '').trim(),
        company: (parts[1] || '').replace(/\d{4}.*$/, '').trim(),
        startDate: dates ? dates[1] : '',
        endDate: dates ? dates[3] : '',
        bullets: [],
      };
    } else if (current && !current.company) {
      current.company = line;
    } else if (current) {
      current.bullets.push(line);
    }
  }
  if (current) entries.push(current);
  return entries.filter(e => e.title || e.company).slice(0, 12);
}

function parseEducation(sectionLines) {
  if (!sectionLines || !sectionLines.length) return [];
  const entries = [];
  for (const raw of sectionLines) {
    const line = raw.trim().replace(/^[-–—*•·\u2022]\s*/, '');
    if (!line || line.length < 4) continue;
    const parts = line.split(/\s+[-–—|]\s+|,\s+|\s+\bat\b\s+/);
    const years = line.match(/((19|20)\d{2})\s*[-–—to]*\s*((19|20)\d{2}|present|current)?/i);
    entries.push({
      degree: (parts[0] || '').replace(/\d{4}.*$/, '').trim(),
      institution: (parts[1] || '').replace(/\d{4}.*$/, '').trim(),
      startDate: years && years[1] ? years[1] : '',
      endDate: years && years[3] ? years[3] : '',
    });
  }
  return entries.filter(e => e.degree).slice(0, 8);
}

function localParse(text) {
  const lines = text.split('\n').map(l => l.trim());
  const email = findEmail(text);
  const sections = splitSections(lines);

  return {
    full_name: findName(lines, email),
    email,
    phone: findPhone(text),
    linkedin: findLinkedIn(text),
    location: '',
    summary: (sections.summary || []).join(' ').trim().slice(0, 1200),
    skills: parseSkills(sections.skills),
    experience: parseExperience(sections.experience),
    education: parseEducation(sections.education),
    projects: [],
    certifications: parseSkills(sections.certs),
  };
}

// ----------------------------------------------------------
// Gemini-powered parse
// ----------------------------------------------------------

async function geminiParse(text) {
  const prompt = `You are a resume parser. Extract the information from the resume below into JSON.

STRICT RULES:
- Return ONLY valid JSON. No markdown fences, no commentary.
- Copy information EXACTLY as written. Do NOT invent, embellish, or infer anything.
- If a field is not present in the resume, use an empty string or empty array.
- Do not summarise or rewrite bullet points — copy them verbatim.

Required JSON shape:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "summary": "",
  "skills": ["skill one", "skill two"],
  "experience": [{"title":"","company":"","startDate":"","endDate":"","bullets":[""]}],
  "education": [{"degree":"","institution":"","startDate":"","endDate":""}],
  "projects": [{"name":"","description":""}],
  "certifications": ["cert name"]
}

RESUME TEXT:
${text.slice(0, 18000)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 3000, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini returned no text');

  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ----------------------------------------------------------
// Normalisation — guarantees the shape the builder expects
// regardless of which parser produced it.
// ----------------------------------------------------------

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function normalise(parsed) {
  const arr = (v) => (Array.isArray(v) ? v : []);

  return {
    full_name: str(parsed.full_name).slice(0, 100),
    email:     str(parsed.email).slice(0, 120),
    phone:     str(parsed.phone).slice(0, 40),
    location:  str(parsed.location).slice(0, 120),
    linkedin:  str(parsed.linkedin).slice(0, 200),
    summary:   str(parsed.summary).slice(0, 2000),

    skills: arr(parsed.skills)
      .map(s => (typeof s === 'string' ? s : str(s?.name)))
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 40),

    experience: arr(parsed.experience).map(e => ({
      title:     str(e?.title).slice(0, 120),
      company:   str(e?.company).slice(0, 120),
      startDate: str(e?.startDate).slice(0, 30),
      endDate:   str(e?.endDate).slice(0, 30),
      bullets:   arr(e?.bullets).map(b => str(b)).filter(Boolean).slice(0, 12),
    })).filter(e => e.title || e.company).slice(0, 12),

    education: arr(parsed.education).map(e => ({
      degree:      str(e?.degree).slice(0, 150),
      institution: str(e?.institution).slice(0, 150),
      startDate:   str(e?.startDate).slice(0, 30),
      endDate:     str(e?.endDate).slice(0, 30),
    })).filter(e => e.degree || e.institution).slice(0, 8),

    projects: arr(parsed.projects).map(p => ({
      name:        str(p?.name).slice(0, 150),
      description: str(p?.description).slice(0, 1000),
    })).filter(p => p.name).slice(0, 10),

    certifications: arr(parsed.certifications)
      .map(c => (typeof c === 'string' ? c : str(c?.name)))
      .map(c => c.trim())
      .filter(Boolean)
      .slice(0, 20),
  };
}

/**
 * Parse resume text into structured fields.
 * @returns {{ fields: object, source: 'gemini'|'local_rules', warnings: string[] }}
 */
async function parseResumeText(text) {
  let fields;
  let source = 'local_rules';

  if (process.env.GEMINI_API_KEY) {
    try {
      fields = normalise(await geminiParse(text));
      source = 'gemini';
    } catch (e) {
      console.warn('Gemini resume parse failed, using local rules:', e.message);
    }
  }

  if (!fields) fields = normalise(localParse(text));

  // Tell the user honestly what could not be found, rather than
  // presenting a half-empty form with no explanation.
  const warnings = [];
  if (!fields.full_name) warnings.push('name');
  if (!fields.email)     warnings.push('email');
  if (!fields.phone)     warnings.push('phone number');
  if (!fields.summary)   warnings.push('professional summary');
  if (!fields.skills.length)     warnings.push('skills');
  if (!fields.experience.length) warnings.push('work experience');
  if (!fields.education.length)  warnings.push('education');

  return { fields, source, warnings };
}

module.exports = { parseResumeText, localParse, normalise };
