// ==========================================================
// rateLimit.js
//
// WHY THIS FILE EXISTS:
// /api/auth/login had no throttling at all. An attacker could send
// thousands of password guesses per minute against any known email
// address, and /api/auth/register could be spammed to fill up db.json
// with junk accounts. Rate limiting is the standard first line of
// defence against both.
//
// Limits are deliberately generous enough that a live demo will never
// trip them, but tight enough to make automated brute force useless.
// ==========================================================

const rateLimit = require('express-rate-limit');

// Shared response shape so the frontend's existing
// `err.response?.data?.error` handling displays these correctly.
const handler = (message) => (req, res) => res.status(429).json({ error: message });

// Login: 8 attempts per 15 minutes per IP.
// `skipSuccessfulRequests` means a legitimate user who logs in fine
// never burns through the allowance — only failed guesses count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many login attempts. Please wait 15 minutes and try again.'),
});

// Registration: 5 new accounts per hour per IP.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many accounts created from this network. Please try again later.'),
});

// Password change / account deletion also verify a password, so they
// are brute-forceable too — same protection applies.
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many attempts. Please wait a few minutes and try again.'),
});

// AI routes cost real Gemini quota and CPU — cap the burst rate.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('You are sending AI requests too quickly. Please slow down.'),
});

// File upload is the most expensive endpoint (parses whole documents).
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many uploads. Please wait a minute.'),
});

module.exports = {
  loginLimiter, registerLimiter, sensitiveLimiter, aiLimiter, uploadLimiter,
};
