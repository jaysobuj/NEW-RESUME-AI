// ==========================================================
// env.js — Startup environment validation
//
// WHY THIS FILE EXISTS:
// Previously, a missing JWT_SECRET did not fail at startup. The server
// booted "successfully", and then jwt.sign() threw on the very first
// login attempt — producing a confusing 500 error with no indication
// that the .env file was the real problem.
//
// This module fails FAST and LOUD at boot with an actionable message,
// which is standard practice for production services.
// ==========================================================

const REQUIRED = ['JWT_SECRET'];

const OPTIONAL_WITH_DEFAULTS = {
  PORT: '5000',
  JWT_EXPIRES_IN: '30d',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  CLIENT_ORIGIN: 'http://localhost:3000',
};

function validateEnv() {
  const errors = [];
  const warnings = [];

  // --- Hard requirements ---
  REQUIRED.forEach((key) => {
    if (!process.env[key] || !process.env[key].trim()) {
      errors.push(`${key} is missing. Add it to your .env file.`);
    }
  });

  // JWT_SECRET must be long enough to be meaningfully secure
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length < 16) {
    errors.push('JWT_SECRET is too short. Use at least 16 random characters.');
  }

  // Reject the placeholder value shipped in .env.example — this must be
  // kept in sync with that file's actual placeholder text, otherwise
  // someone who copies it verbatim boots with a publicly-known-from-
  // source JWT_SECRET that still passes the length check above.
  if (process.env.JWT_SECRET === 'replace_with_a_random_string_at_least_16_characters_long') {
    errors.push('JWT_SECRET is still the example placeholder. Set a real random value.');
  }

  // --- Fill in defaults so the rest of the code can rely on them ---
  Object.entries(OPTIONAL_WITH_DEFAULTS).forEach(([key, fallback]) => {
    if (!process.env[key] || !process.env[key].trim()) {
      process.env[key] = fallback;
      warnings.push(`${key} not set — using default "${fallback}".`);
    }
  });

  // PORT must actually be a number
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT="${process.env.PORT}" is not a valid port number (1-65535).`);
  }

  // --- Feature-level warnings (not fatal) ---
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
    warnings.push('GEMINI_API_KEY not set — AI features will use the local rules fallback.');
  }

  if (warnings.length) {
    console.warn('\n⚠️  Configuration warnings:');
    warnings.forEach((w) => console.warn(`   • ${w}`));
  }

  if (errors.length) {
    console.error('\n❌ Cannot start: your .env file is incomplete.\n');
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error('\n   Fix: copy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }

  console.log('✅ Environment validated.');
}

module.exports = { validateEnv };
