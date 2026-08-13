// ==========================================================
// db.js — JSON file database (race-safe edition)
//
// WHY THIS FILE CHANGED:
// The original implementation called load() -> mutate -> save() inside
// every single function. Each call re-read and re-parsed the whole file
// from disk. Two requests arriving close together could both read the
// SAME old snapshot, and whichever called save() last silently
// overwrote the other's changes. This is the classic "lost update"
// race condition — e.g. two AI calls at once would only deduct one
// credit, or an application create could wipe out a resume save.
//
// WHAT CHANGED (3 things, no API change — every exported function
// keeps the exact same name and signature, so no route file breaks):
//
//   1. IN-MEMORY SOURCE OF TRUTH
//      The file is read ONCE at startup into `data`. All mutations
//      happen on that single object. Because Node runs our request
//      handlers on one thread and these functions contain no `await`,
//      each mutation runs to completion atomically. The read-modify-
//      write window that caused lost updates no longer exists.
//
//   2. ATOMIC DISK WRITES
//      save() writes to a temporary file, then renames it over the
//      real one. rename() is atomic on the same filesystem, so a crash
//      mid-write can never leave a truncated / corrupt db.json.
//      Previously a crash during writeFileSync could destroy all data.
//
//   3. DEFENSIVE COPIES
//      Reads return deep copies. Previously callers received live
//      references into the database and could mutate stored records by
//      accident — a whole class of "why did my data change?" bugs.
// ==========================================================

const fs   = require('fs');
const path = require('path');

const DB_DIR   = path.join(__dirname, '..', 'database');
const DB_FILE  = path.join(DB_DIR, 'db.json');
const TMP_FILE = DB_FILE + '.tmp';

const EMPTY_DB = () => ({
  users: [], resumes: [], applications: [], ats_scans: [], ai_suggestions: [], workflow_state: [],
});

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ---------- Load once at startup ----------
function loadFromDisk() {
  if (!fs.existsSync(DB_FILE)) {
    const fresh = EMPTY_DB();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    // Guarantee every collection exists even if the file predates a new feature
    return { ...EMPTY_DB(), ...parsed };
  } catch (e) {
    // Never silently start with an empty DB on top of a corrupt file —
    // back the bad file up first so the user's data stays recoverable.
    const backup = `${DB_FILE}.corrupt-${Date.now()}`;
    try {
      fs.copyFileSync(DB_FILE, backup);
      console.error(`❌ db.json was unreadable. Backed it up to ${backup} and started fresh.`);
    } catch (_) {
      console.error('❌ db.json was unreadable and could not be backed up.');
    }
    return EMPTY_DB();
  }
}

const data = loadFromDisk();

// ---------- Atomic save ----------
function save() {
  fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2));
  fs.renameSync(TMP_FILE, DB_FILE); // atomic swap
}

const clone = (obj) => (obj == null ? obj : JSON.parse(JSON.stringify(obj)));
const now   = () => new Date().toISOString();

// ==========================================================
// Users
// ==========================================================
function getUser(email) {
  if (!email) return null;
  return clone(data.users.find(u => u.email === String(email).toLowerCase())) || null;
}

function getUserById(id) {
  return clone(data.users.find(u => u.id === id)) || null;
}

function createUser({ id, name, email, passwordHash }) {
  const user = {
    id, name, email: String(email).toLowerCase(),
    password_hash: passwordHash,
    plan: 'free', ai_quota_used: 0, ai_quota_limit: 20,
    created_at: now(),
  };
  data.users.push(user);
  save();
  return clone(user);
}

function updateUser(id, fields) {
  const user = data.users.find(u => u.id === id);
  if (!user) return false;
  Object.assign(user, fields, { updated_at: now() });
  save();
  return true;
}

function deleteUser(id) {
  data.users          = data.users.filter(u => u.id !== id);
  data.resumes        = data.resumes.filter(r => r.user_id !== id);
  data.applications   = data.applications.filter(a => a.user_id !== id);
  data.ats_scans      = data.ats_scans.filter(s => s.user_id !== id);
  data.ai_suggestions = data.ai_suggestions.filter(s => s.user_id !== id);
  save();
}

function getQuota(id) {
  const u = data.users.find(u => u.id === id);
  return u ? { used: u.ai_quota_used, limit: u.ai_quota_limit, plan: u.plan } : null;
}

// Reserve one AI credit. Returns false if the user has none left.
function useQuota(id) {
  const u = data.users.find(u => u.id === id);
  if (!u) return false;
  if (u.ai_quota_used >= u.ai_quota_limit) return false;
  u.ai_quota_used++;
  save();
  return true;
}

// NEW: give a reserved credit back when the AI call fails.
// See routes/ai.js — credits are reserved BEFORE the call (so two
// simultaneous requests can't both spend the user's last credit) and
// refunded if the call throws, so a failure never costs the user.
function refundQuota(id) {
  const u = data.users.find(u => u.id === id);
  if (!u) return false;
  if (u.ai_quota_used > 0) u.ai_quota_used--;
  save();
  return true;
}

// ==========================================================
// Resumes
// ==========================================================
function getAllResumes(userId) {
  return data.resumes
    .filter(r => r.user_id === userId)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map(({ id, title, version, full_name, template, font, updated_at, created_at, parent_resume_id, tailored_for_job_id, tailored_for_job_title }) =>
      ({ id, title, version, full_name, template: template || 'modern', font: font || null, updated_at, created_at, parent_resume_id: parent_resume_id || null, tailored_for_job_id: tailored_for_job_id || null, tailored_for_job_title: tailored_for_job_title || null }));
}

function getResumeById(id, userId) {
  return clone(data.resumes.find(r => r.id === id && r.user_id === userId)) || null;
}

function createResume(fields) {
  const resume = { ...fields, created_at: now(), updated_at: now() };
  data.resumes.push(resume);
  save();
  return clone(resume);
}

function updateResume(id, userId, fields) {
  const resume = data.resumes.find(r => r.id === id && r.user_id === userId);
  if (!resume) return null;
  Object.assign(resume, fields, { updated_at: now() });
  save();
  return clone(resume);
}

function deleteResume(id, userId) {
  const before = data.resumes.length;
  data.resumes = data.resumes.filter(r => !(r.id === id && r.user_id === userId));
  const changed = data.resumes.length < before;
  if (changed) save();
  return changed;
}

// ==========================================================
// Applications
// ==========================================================
const ALLOWED_STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

function getAllApplications(userId, status) {
  let apps = data.applications.filter(a => a.user_id === userId);
  if (status && ALLOWED_STATUSES.includes(status)) apps = apps.filter(a => a.status === status);
  return clone(apps.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))));
}

function getApplicationById(id, userId) {
  return clone(data.applications.find(a => a.id === id && a.user_id === userId)) || null;
}

function createApplication(fields) {
  // status_updated_at tracks ONLY status changes (see updateApplication),
  // separately from updated_at which changes on any edit — this is what
  // lets the smart-reminder system measure "days since this actually
  // moved stage" without being reset by an unrelated notes edit.
  const app = { ...fields, status_updated_at: now(), created_at: now(), updated_at: now() };
  data.applications.push(app);
  save();
  return clone(app);
}

function updateApplication(id, userId, fields) {
  const app = data.applications.find(a => a.id === id && a.user_id === userId);
  if (!app) return null;
  Object.assign(app, fields, { updated_at: now() });
  save();
  return clone(app);
}

function deleteApplication(id, userId) {
  const before = data.applications.length;
  data.applications = data.applications.filter(a => !(a.id === id && a.user_id === userId));
  const changed = data.applications.length < before;
  if (changed) save();
  return changed;
}

function getAppStats(userId) {
  const apps    = data.applications.filter(a => a.user_id === userId);
  const summary = {};
  ALLOWED_STATUSES.forEach(s => { summary[s] = 0; });
  apps.forEach(a => { if (summary[a.status] !== undefined) summary[a.status]++; });
  return summary;
}

// ==========================================================
// ATS scans
// ==========================================================
function saveAtsScan(fields) {
  const scan = { ...fields, created_at: now() };
  data.ats_scans.push(scan);
  save();
  return clone(scan);
}

function getAtsScanHistory(resumeId, userId) {
  return data.ats_scans
    .filter(s => s.resume_id === resumeId && s.user_id === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(({ id, overall_score, created_at }) => ({ id, overall_score, created_at }));
}

// ==========================================================
// Workflow state — one record per user, tracking where they are in
// the guided Upload -> Search -> Select -> Tailor -> ATS -> Export ->
// Track pipeline. Deliberately minimal: the selected job (snapshot,
// so it survives a seed-data change), the resume currently being
// tailored for it, and the chat thread for that tailoring session.
// Everything else (the resumes themselves, ATS scans, applications)
// already has its own collection and is only ever referenced by id.
// ==========================================================
function getWorkflowState(userId) {
  const w = data.workflow_state.find(w => w.user_id === userId);
  return w ? clone(w) : { user_id: userId, selected_job: null, tailored_resume_id: null, chat_history: [], exported: false };
}

function setWorkflowState(userId, fields) {
  let w = data.workflow_state.find(w => w.user_id === userId);
  if (!w) {
    w = { user_id: userId, selected_job: null, tailored_resume_id: null, chat_history: [], exported: false };
    data.workflow_state.push(w);
  }
  Object.assign(w, fields, { updated_at: now() });
  save();
  return clone(w);
}

module.exports = {
  getUser, getUserById, createUser, updateUser, deleteUser,
  getQuota, useQuota, refundQuota,
  getAllResumes, getResumeById, createResume, updateResume, deleteResume,
  getAllApplications, getApplicationById, createApplication, updateApplication,
  deleteApplication, getAppStats, ALLOWED_STATUSES,
  saveAtsScan, getAtsScanHistory,
  getWorkflowState, setWorkflowState,
};
