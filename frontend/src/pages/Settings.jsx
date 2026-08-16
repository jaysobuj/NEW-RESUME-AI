// Settings.jsx - Account settings: update name, change password, delete account

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, GradientBanner, ProgressBar } from '../components/UI';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [quota, setQuota]       = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [billingMsg, setBillingMsg]   = useState(null);
  const [downgrading, setDowngrading] = useState(false);
  const [name, setName]         = useState(user?.name || '');
  const [nameMsg, setNameMsg]   = useState(null);
  const [curPw, setCurPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confPw, setConfPw]     = useState('');
  const [pwMsg, setPwMsg]       = useState(null);
  const [delPw, setDelPw]       = useState('');
  const [showDel, setShowDel]   = useState(false);
  const [delMsg, setDelMsg]     = useState('');

  const loadQuota = () => api.get('/ai/quota').then(res => setQuota(res.data)).catch(() => {});

  useEffect(() => { loadQuota(); }, []);

  const handleUpgradeSuccess = async (data) => {
    setShowUpgrade(false);
    setBillingMsg({ type: 'success', text: data.message || 'Upgraded to Pro!' });
    await refreshUser();
    loadQuota();
    setTimeout(() => setBillingMsg(null), 5000);
  };

  const handleDowngrade = async () => {
    if (!window.confirm('Switch back to the Free plan (20 credits)? This is just for demo purposes.')) return;
    setDowngrading(true);
    try {
      await api.post('/billing/downgrade');
      await refreshUser();
      loadQuota();
      setBillingMsg({ type: 'info', text: 'Back on the Free plan.' });
      setTimeout(() => setBillingMsg(null), 4000);
    } finally {
      setDowngrading(false);
    }
  };

  // Save updated display name
  const saveName = async () => {
    try {
      await api.put('/auth/update-name', { name });
      setNameMsg({ type: 'success', text: '✅ Name updated successfully!' });
      setTimeout(() => setNameMsg(null), 3000);
    } catch (err) {
      setNameMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update name.' });
    }
  };

  // Change password
  const changePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confPw) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    try {
      await api.put('/auth/change-password', { currentPassword: curPw, newPassword: newPw });
      setPwMsg({ type: 'success', text: '✅ Password changed successfully!' });
      setCurPw(''); setNewPw(''); setConfPw('');
      setTimeout(() => setPwMsg(null), 3000);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
    }
  };

  // Permanently delete the account
  const deleteAccount = async () => {
    // Matches the backend, which now REQUIRES a password (the old backend
    // skipped verification entirely when this field was empty).
    if (!delPw.trim()) {
      setDelMsg('Please enter your password to confirm.');
      return;
    }
    if (!window.confirm('Are you 100% sure? This will permanently delete your account and all data.')) return;
    try {
      await api.delete('/auth/account', { data: { password: delPw } });
      logout();
      navigate('/login');
    } catch (err) {
      setDelMsg(err.response?.data?.error || 'Failed to delete account.');
    }
  };

  return (
    <Layout title="⚙️ Settings" subtitle="Manage your account, password, and AI usage.">

      <GradientBanner
        icon="👤"
        title={`Logged in as ${user?.name || 'User'}`}
        subtitle={`Email: ${user?.email} · Plan: ${user?.plan === 'pro' ? 'Pro ⭐' : 'Free 🆓'}`}
      />

      <div className="grid-2">

        {/* Appearance / dark mode */}
        <Card title="🎨 Appearance">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Switch between light and dark themes. Your choice is remembered on this device.
              </div>
            </div>
            <label className="switch" title="Toggle dark mode">
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={toggleTheme}
                aria-label="Toggle dark mode"
              />
              <span className="slider" />
            </label>
          </div>
        </Card>

        {/* Profile name update */}
        <Card title="👤 Profile">
          <div className="form-group">
            <label className="form-label">Display name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
            <p className="form-hint">Email cannot be changed.</p>
          </div>
          {nameMsg && <Alert type={nameMsg.type}>{nameMsg.text}</Alert>}
          <button className="btn btn-primary" onClick={saveName}>💾 Save name</button>
        </Card>

        {/* AI credits usage */}
        <Card title="💡 AI Credits">
          {quota ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: '#64748b', fontSize: 14 }}>Credits used</span>
                <span style={{ fontWeight: 700 }}>{quota.used} / {quota.limit}</span>
              </div>
              <ProgressBar
                value={quota.used}
                max={quota.limit}
                colour={quota.remaining <= 3 ? '#ef4444' : undefined}
              />
              <div className={`soft-note ${quota.remaining > 5 || quota.plan === 'pro' ? 'ok' : 'warn'}`} style={{ marginTop: 14 }}>
                {quota.plan === 'pro'
                  ? '⭐ Pro plan — unlimited AI credits.'
                  : quota.remaining > 5
                    ? `✅ You have ${quota.remaining} credits remaining.`
                    : `⚠️ Only ${quota.remaining} credits left! Upgrade to Pro below for unlimited credits.`}
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                Each AI suggestion, bullet rewrite, or tailoring uses 1 credit.
              </div>
            </>
          ) : (
            <p className="page-subtitle">Loading credits...</p>
          )}
        </Card>

        {/* Plan & billing — demo upgrade flow, see UpgradeModal.jsx */}
        <Card title="💳 Plan & Billing">
          {billingMsg && <Alert type={billingMsg.type}>{billingMsg.text}</Alert>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{
              border: `1.5px solid ${user?.plan !== 'pro' ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 10, padding: 14,
              background: user?.plan !== 'pro' ? 'var(--primary-light)' : 'transparent',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🆓 Free</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0' }}>$0</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>20 AI credits</div>
              {user?.plan !== 'pro' && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>✓ Current plan</div>}
            </div>
            <div style={{
              border: `1.5px solid ${user?.plan === 'pro' ? '#f59e0b' : 'var(--border)'}`,
              borderRadius: 10, padding: 14,
              background: user?.plan === 'pro' ? '#fffbeb' : 'transparent',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>⭐ Pro</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0' }}>$12<span style={{ fontSize: 12, fontWeight: 500 }}>/mo</span></div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Unlimited AI credits</div>
              {user?.plan === 'pro' && <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginTop: 8 }}>✓ Current plan</div>}
            </div>
          </div>

          {user?.plan === 'pro' ? (
            <button className="btn btn-secondary" onClick={handleDowngrade} disabled={downgrading}>
              {downgrading ? '⏳...' : '↩️ Switch back to Free (demo)'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowUpgrade(true)}>
              ⭐ Upgrade to Pro
            </button>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
            🧪 This is a demo checkout for a capstone project — no real payment processor is connected.
          </p>
        </Card>

        {/* Change password */}
        <Card title="🔒 Change Password">
          <form onSubmit={changePassword}>
            <div className="form-group">
              <label className="form-label">Current password</label>
              <input className="form-input" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input className="form-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
              <p className="form-hint">Min 8 chars, uppercase, number, special character</p>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input className="form-input" type="password" value={confPw} onChange={e => setConfPw(e.target.value)} required />
            </div>
            {pwMsg && <Alert type={pwMsg.type}>{pwMsg.text}</Alert>}
            <button className="btn btn-primary" type="submit">🔒 Update password</button>
          </form>
        </Card>

        {/* Danger zone - delete account */}
        <Card title="⚠️ Danger Zone" style={{ borderColor: '#fca5a5' }}>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Permanently delete your account and all associated data.
            This action <strong>cannot be undone</strong>.
          </p>

          {!showDel ? (
            <button className="btn btn-danger" onClick={() => setShowDel(true)}>
              🗑️ Delete my account
            </button>
          ) : (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="form-group">
                <label className="form-label">Enter your password to confirm</label>
                <input
                  className="form-input"
                  type="password"
                  value={delPw}
                  onChange={e => setDelPw(e.target.value)}
                  placeholder="Your current password"
                  style={{ borderColor: '#ef4444' }}
                />
              </div>
              {delMsg && <Alert type="error">{delMsg}</Alert>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-danger" onClick={deleteAccount} disabled={!delPw.trim()}>
                  Yes, permanently delete
                </button>
                <button className="btn btn-secondary" onClick={() => setShowDel(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} />
      )}
    </Layout>
  );
}
