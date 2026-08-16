// ==========================================================
// billing.js — DEMO payment / plan upgrade routes.
//
// This is a deliberate, clearly-labelled FAKE payment gateway for a
// capstone project demo. It never contacts a real payment processor,
// never validates card details as genuine, and accepts ANY input —
// the point is to demonstrate the "Free -> Pro" upgrade flow and its
// effect on AI credit quota, not to process real payments. No card
// data is stored; only loosely shape-checked, then discarded.
// ==========================================================

const express = require('express');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { sensitiveLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth);

const PRO_QUOTA_LIMIT = 999999; // effectively unlimited for the demo

// GET /api/billing/plans — plan comparison, single source of truth for
// the frontend pricing section (so the numbers can't drift out of sync).
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        credits: 20,
        features: ['20 AI credits (tailoring, rewrites, chat)', 'Unlimited resumes & templates', 'ATS scoring & job search', 'Application tracker'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 12,
        credits: PRO_QUOTA_LIMIT,
        features: ['Unlimited AI credits', 'Everything in Free', 'Priority-feeling badge ⭐', 'Support this capstone project 😉'],
      },
    ],
  });
});

// POST /api/billing/upgrade — DEMO checkout. Any card details are
// accepted; this never charges anything real. Only loose shape checks
// (non-empty, roughly the right length) so the form feels real, then
// the card fields are discarded — never persisted anywhere.
router.post('/upgrade', sensitiveLimiter, (req, res) => {
  const { cardNumber, expiry, cvv, cardholderName } = req.body;
  const digitsOnly = String(cardNumber || '').replace(/\s+/g, '');

  if (!cardholderName || !cardholderName.trim())
    return res.status(400).json({ error: 'Cardholder name is required.' });
  if (!/^\d{12,19}$/.test(digitsOnly))
    return res.status(400).json({ error: 'Enter a card number (any digits work — this is a demo).' });
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(String(expiry || '')))
    return res.status(400).json({ error: 'Enter an expiry date in MM/YY format.' });
  if (!/^\d{3,4}$/.test(String(cvv || '')))
    return res.status(400).json({ error: 'Enter a 3-4 digit CVV.' });

  const user = db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  db.updateUser(req.userId, { plan: 'pro', ai_quota_limit: PRO_QUOTA_LIMIT });
  const updated = db.getUserById(req.userId);
  res.json({
    success: true,
    demo: true,
    message: 'Demo payment accepted — no real charge was made. Your plan is now Pro with unlimited AI credits.',
    user: { id: updated.id, name: updated.name, email: updated.email, plan: updated.plan, ai_quota_used: updated.ai_quota_used, ai_quota_limit: updated.ai_quota_limit },
  });
});

// POST /api/billing/downgrade — reset back to Free, mainly so a demo
// can be replayed from a clean state without editing the database by hand.
router.post('/downgrade', (req, res) => {
  db.updateUser(req.userId, { plan: 'free', ai_quota_limit: 20 });
  const updated = db.getUserById(req.userId);
  res.json({
    success: true,
    user: { id: updated.id, name: updated.name, email: updated.email, plan: updated.plan, ai_quota_used: updated.ai_quota_used, ai_quota_limit: updated.ai_quota_limit },
  });
});

module.exports = router;
