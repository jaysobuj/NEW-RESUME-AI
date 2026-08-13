// ==========================================================
// htmlToPdf.js
// Converts an HTML string into a PDF Buffer using the Chromium that
// ships with the environment, driven by playwright-core.
//
// Why Chromium instead of pdfkit for the primary path: the template
// system needs real CSS layout (two-column sidebars, coloured header
// blocks, flexbox, pills). pdfkit draws imperatively and cannot do
// that. Chromium renders the exact same HTML the live preview uses.
//
// This module NEVER hard-crashes an export: if a browser can't be
// found or launched, it throws a tagged error so the export route can
// fall back to the legacy pdfkit generator (see routes/export.js).
// ==========================================================

const fs = require('fs');
const os = require('os');
const path = require('path');

// playwright-core's install CLI puts browsers under a platform-specific
// default cache dir when PLAYWRIGHT_BROWSERS_PATH isn't set, and the
// per-version folder layout (subfolder name + binary name) also differs
// per OS. '/opt/pw-browsers' is a container-specific convention some
// deploy environments pre-seed, so it's kept as a last-resort candidate.
function defaultBrowserBases() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return [path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'ms-playwright')];
  }
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Caches', 'ms-playwright')];
  }
  return [path.join(home, '.cache', 'ms-playwright'), '/opt/pw-browsers'];
}

function candidateBinaries(base, dir) {
  if (process.platform === 'win32') {
    return [
      { p: path.join(base, dir, 'chrome-win', 'headless_shell.exe'), shell: true },
      { p: path.join(base, dir, 'chrome-win', 'chrome.exe'), shell: false },
    ];
  }
  if (process.platform === 'darwin') {
    return [
      { p: path.join(base, dir, 'chrome-mac', 'headless_shell'), shell: true },
      { p: path.join(base, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'), shell: false },
    ];
  }
  return [
    // headless_shell implements the "old headless" mode playwright-core
    // asks for, so prefer it; fall back to the full chrome binary.
    { p: path.join(base, dir, 'chrome-linux', 'headless_shell'), shell: true },
    { p: path.join(base, dir, 'chrome-linux', 'chrome'), shell: false },
  ];
}

// Resolve a usable Chromium binary once and cache it.
let _execPath;
function findChromium() {
  if (_execPath !== undefined) return _execPath;

  // Explicit override wins.
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    _execPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    return _execPath;
  }

  const bases = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
    : defaultBrowserBases();

  const found = [];
  for (const base of bases) {
    try {
      for (const dir of fs.readdirSync(base)) {
        for (const { p, shell } of candidateBinaries(base, dir)) {
          if (fs.existsSync(p)) found.push({ p, shell });
        }
      }
    } catch {
      /* base dir missing — try the next candidate */
    }
  }

  // Prefer a headless_shell if any was found.
  const pick = found.find(f => f.shell) || found[0];
  _execPath = pick ? pick.p : null;
  return _execPath;
}

async function htmlToPdf(html) {
  const executablePath = findChromium();
  if (!executablePath) {
    const err = new Error('No Chromium binary found for PDF rendering.');
    err.code = 'NO_CHROMIUM';
    throw err;
  }

  let chromium;
  try {
    ({ chromium } = require('playwright-core'));
  } catch (e) {
    const err = new Error('playwright-core is not installed.');
    err.code = 'NO_PLAYWRIGHT';
    throw err;
  }

  let browser;
  try {
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return buffer;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { htmlToPdf, findChromium };
