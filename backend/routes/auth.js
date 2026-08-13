const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { loginLimiter, registerLimiter, sensitiveLimiter } = require('../middleware/rateLimit');
const router = express.Router();

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });
}

// REGISTER
router.post('/register',
  registerLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password needs at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password needs at least one number')
      .matches(/[^A-Za-z0-9]/).withMessage('Password needs at least one special character'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { name, email, password } = req.body;
    if (db.getUser(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = uuidv4();
    const user = db.createUser({ id: userId, name, email, passwordHash });
    const token = generateToken(userId);
    res.status(201).json({ token, user: { id: userId, name, email: user.email, plan: 'free' } });
  }
);

// LOGIN
router.post('/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { email, password } = req.body;
    const user = db.getUser(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password.' });
    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  }
);

// ME
router.get('/me', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, plan: user.plan, ai_quota_used: user.ai_quota_used, ai_quota_limit: user.ai_quota_limit } });
});

// UPDATE NAME
router.put('/update-name', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  db.updateUser(req.userId, { name: name.trim() });
  res.json({ success: true });
});

// CHANGE PASSWORD
router.put('/change-password', sensitiveLimiter, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return res.status(401).json({ error: 'Current password is incorrect.' });
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: 'New password needs at least one uppercase letter.' });
  if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: 'New password needs at least one number.' });
  if (!/[^A-Za-z0-9]/.test(newPassword)) return res.status(400).json({ error: 'New password needs at least one special character.' });
  db.updateUser(req.userId, { password_hash: bcrypt.hashSync(newPassword, 10) });
  res.json({ success: true });
});

// DELETE ACCOUNT
router.delete('/account', sensitiveLimiter, requireAuth, (req, res) => {
  const { password } = req.body;
  const user = db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  // SECURITY FIX: the original condition was `if (password && !compare(...))`.
  // When `password` was an empty string the whole check was skipped and the
  // account was deleted with NO verification whatsoever. Password is now
  // mandatory and always verified.
  if (!password || typeof password !== 'string')
    return res.status(400).json({ error: 'Your password is required to delete your account.' });
  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Incorrect password.' });

  db.deleteUser(req.userId);
  res.json({ success: true });
});

module.exports = router;
