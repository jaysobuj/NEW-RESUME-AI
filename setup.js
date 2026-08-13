#!/usr/bin/env node
// ==========================================================
// setup.js — one-time project setup, run from the repo root.
//
// What it does:
//   1. Creates backend/.env from backend/.env.example if it doesn't
//      exist yet, and fills in a secure random JWT_SECRET automatically
//      (the app refuses to boot without one — see config/env.js).
//   2. Runs `npm install` in both backend/ and frontend/.
//   3. Prints exactly where to paste your own API keys.
//
// Run it with: node setup.js   (or double-click setup.bat on Windows,
// or ./setup.sh on Mac/Linux)
// ==========================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

function log(msg) { console.log(msg); }
function rule() { log('----------------------------------------------------------------'); }

function ensureBackendEnv() {
  const envPath = path.join(BACKEND, '.env');
  const examplePath = path.join(BACKEND, '.env.example');

  if (fs.existsSync(envPath)) {
    log('✅ backend/.env already exists — leaving it untouched.');
    return;
  }

  if (!fs.existsSync(examplePath)) {
    log('⚠️  backend/.env.example not found — cannot create backend/.env automatically.');
    return;
  }

  let contents = fs.readFileSync(examplePath, 'utf8');

  // Generate a secure random JWT_SECRET so the backend boots on the
  // very first run without any manual editing (config/env.js requires
  // 16+ chars and rejects the placeholder value).
  const secret = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  contents = contents.replace(
    /JWT_SECRET=.*/,
    `JWT_SECRET=${secret}`
  );

  fs.writeFileSync(envPath, contents);
  log('✅ Created backend/.env with a randomly generated JWT_SECRET.');
}

function npmInstall(dir, label) {
  const nodeModules = path.join(dir, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    log(`✅ ${label} dependencies already installed — skipping (delete ${label}/node_modules to force a reinstall).`);
    return;
  }
  log(`📦 Installing ${label} dependencies (this can take a minute)...`);
  // shell: true is required on Windows to resolve npm.cmd correctly.
  const result = spawnSync('npm', ['install'], {
    cwd: dir,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    log(`❌ npm install failed in ${label}/. See the output above.`);
    process.exit(result.status || 1);
  }
}

// PDF export renders each resume template through real Chromium (see
// backend/utils/htmlToPdf.js) so the download matches the live preview.
// playwright-core is a dependency but deliberately doesn't download a
// browser on `npm install` — without this, PDF export silently falls
// back to a fixed single-column layout that ignores the chosen template.
// Non-fatal: htmlToPdf.js already degrades gracefully if this is skipped
// or fails (e.g. offline), so we never block setup on it.
function installChromium() {
  const cacheHint = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
    : process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
      : path.join(process.env.HOME || '', '.cache', 'ms-playwright');

  if (cacheHint && fs.existsSync(cacheHint) && fs.readdirSync(cacheHint).some(d => d.startsWith('chromium'))) {
    log('✅ Chromium (for PDF export) already installed — skipping.');
    return;
  }

  log('📦 Installing Chromium for PDF export (this can take a minute)...');
  const result = spawnSync('npx', ['playwright-core', 'install', 'chromium'], {
    cwd: BACKEND,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    log('⚠️  Chromium install failed or was skipped — PDF export will still work, but will');
    log('    fall back to a fixed layout that ignores the selected template. Re-run');
    log('    "npx playwright-core install chromium" from backend/ to fix this later.');
  }
}

log('');
log('============================================');
log('  ResumeAI — first-time setup');
log('============================================');
log('');

ensureBackendEnv();
log('');
npmInstall(BACKEND, 'backend');
log('');
npmInstall(FRONTEND, 'frontend');
log('');
installChromium();

log('');
rule();
log('IMPORTANT — add your API keys now:');
log('  Open backend/.env and fill in whichever of these you have:');
log('');
log('  GEMINI_API_KEY=...   (optional — free at https://aistudio.google.com/apikey)');
log('                        Without it, AI features still work via local fallback logic.');
rule();
log('');
log('Setup complete! Run start.bat (Windows) or ./start.sh (Mac/Linux) to launch the app.');
log('');
