// ==========================================================
// resumeProfile.js
// Derives a compact, matchable profile from a resume record — the
// input the recommendation engine ranks job listings against.
//
// resumeParser.js only extracts raw fields (title/company/dates); it
// does not derive metrics like total years of experience or a career
// level, so that logic lives here instead.
// ==========================================================

function safeParse(field) {
  try {
    return typeof field === 'string' ? JSON.parse(field) : (field || []);
  } catch {
    return [];
  }
}

// Pull the first 4-digit year out of a free-text date string.
// Resumes come from manual entry, Gemini, and the local parser, so
// dates arrive in wildly different shapes ("2019", "Mar 2019",
// "03/2019", "2019-03") — a lenient year-only extraction is the only
// approach robust to all of them.
function extractYear(text) {
  if (!text) return null;
  const match = String(text).match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function isCurrent(text) {
  return /present|current/i.test(String(text || ''));
}

// Sums the duration of each experience entry. Overlapping roles are
// summed rather than merged — a deliberate simplification consistent
// with this codebase's other heuristic scoring (see atsScoring.js).
function estimateYearsExperience(experience) {
  const thisYear = new Date().getFullYear();
  let totalYears = 0;

  experience.forEach(exp => {
    const startYear = extractYear(exp.startDate);
    if (!startYear) return; // can't do anything without a start year
    const endYear = isCurrent(exp.endDate) || !exp.endDate
      ? thisYear
      : (extractYear(exp.endDate) || startYear);
    const span = Math.max(0, endYear - startYear);
    // A role with start==end year is still real experience (e.g. a
    // 2024-2024 internship) — count it as at least half a year rather
    // than zero, so short stints aren't invisible to the profile.
    totalYears += span === 0 ? 0.5 : span;
  });

  return Math.round(totalYears * 10) / 10;
}

function careerLevelFromYears(years) {
  if (years < 2) return 'Entry';
  if (years < 5) return 'Mid';
  if (years < 10) return 'Senior';
  return 'Lead';
}

function extractSkillNames(skills) {
  return skills.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
}

// Builds the profile the recommendation engine matches jobs against.
function buildResumeProfile(resume) {
  const experience = safeParse(resume.experience);
  const skills = extractSkillNames(safeParse(resume.skills));
  const yearsExperience = estimateYearsExperience(experience);

  return {
    skills,
    yearsExperience,
    careerLevel: careerLevelFromYears(yearsExperience),
    mostRecentTitle: experience[0]?.title || null,
  };
}

module.exports = { buildResumeProfile, estimateYearsExperience, careerLevelFromYears };
