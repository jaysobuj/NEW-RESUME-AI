// ==========================================================
// jobProvider.js
// Minimal provider interface over job listing data. Callers (the
// recommendation engine, and later a full job search route) talk to
// THIS module, never to the data source directly — so swapping the
// seed dataset for a real job-search API (Adzuna, Jooble, etc.) later
// is a change confined to this one file.
//
// Every job returned follows the normalised shape from
// IMPLEMENTATION_PLAN.md §4:
//   { id, title, company, location, workMode, jobType, salaryMin,
//     salaryMax, currency, description, requiredSkills[], postedDate,
//     source, applyUrl }
// ==========================================================

const seedJobs = require('../data/seedJobs.json');

// Returns every job in the current provider's dataset.
function listAllJobs() {
  return seedJobs.slice();
}

function getJob(id) {
  return seedJobs.find(j => j.id === id) || null;
}

module.exports = { listAllJobs, getJob };
