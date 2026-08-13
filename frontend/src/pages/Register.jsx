// Register.jsx - New user registration with live password strength checker

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/UI';

// Password rules - each has a label and a test function
const RULES = [
  { id: 'len',     label: 'At least 8 characters',          test: pw => pw.length >= 8 },
  { id: 'upper',   label: 'At least one uppercase letter',  test: pw => /[A-Z]/.test(pw) },
  { id: 'lower',   label: 'At least one lowercase letter',  test: pw => /[a-z]/.test(pw) },
  { id: 'num',     label: 'At least one number',            test: pw => /[0-9]/.test(pw) },
  { id: 'special', label: 'At least one special character', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

// Password strength meter component
function PasswordStrength({ password }) {
  const passed = RULES.filter(r => r.test(password)).length;
  const label  = ['', 'Weak', 'Fair', 'Good', 'Strong'][passed] || '';
  const colour = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][passed] || '#e2e8f0';

  return (
    <div style={{ marginTop: 10 }}>
      {/* Strength bars */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 3,
            background: i < passed ? colour : '#e2e8f0',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      {password && (
        <div style={{ fontSize: 12, color: colour, fontWeight: 600, marginBottom: 8 }}>
          {label}
        </div>
      )}
      {/* Individual rule checklist */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {RULES.map(r => (
          <li key={r.id} style={{
            fontSize: 12,
            color: r.test(password) ? '#10b981' : '#94a3b8',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
            transition: 'color 0.2s',
          }}>
            {r.test(password) ? '✅' : '⬜'} {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error ||
        'Could not reach the registration server. Check that the backend is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>

        <div className="auth-logo">✨ ResumeAI</div>
        <div className="auth-tagline">Start building your dream career today</div>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Alex Nguyen"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Create a strong password"
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#64748b',
                }}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Show strength meter only when user starts typing */}
            {form.password && <PasswordStrength password={form.password} />}
          </div>

          <button
            className="btn btn-primary btn-block btn-lg"
            type="submit"
            disabled={loading}
            style={{ marginTop: 16 }}
          >
            {loading ? '⏳ Creating account...' : '🎉 Create Free Account'}
          </button>
        </form>

        {/* Free credits notice */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #bbf7d0',
          borderRadius: 10, padding: '12px 16px',
          marginTop: 16, fontSize: 13, color: '#166534',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          🎁 <span><strong>20 free AI credits</strong> included — no credit card needed</span>
        </div>

        <div className="auth-footer-link">
          Already have an account? <Link to="/login">Log in →</Link>
        </div>
      </div>
    </div>
  );
}
