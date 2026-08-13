// AISuggestions.jsx - Get AI-generated improvements for your summary and bullet points

import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, Alert, Spinner, GradientBanner } from '../components/UI';
import api from '../services/api';

export default function AISuggestions() {
  const [resumes, setResumes]             = useState([]);
  const [resumeId, setResumeId]           = useState('');
  const [bulletText, setBulletText]       = useState('');
  const [summaryResult, setSummaryResult] = useState(null);
  const [bulletResult, setBulletResult]   = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingBullet, setLoadingBullet]   = useState(false);
  const [error, setError]                 = useState('');
  const [bulletError, setBulletError]     = useState('');
  const [quota, setQuota]                 = useState(null);

  useEffect(() => {
    api.get('/resumes').then(res => {
      setResumes(res.data.resumes);
      if (res.data.resumes.length > 0) setResumeId(res.data.resumes[0].id);
    });
    refreshQuota();
  }, []);

  const refreshQuota = () =>
    api.get('/ai/quota').then(res => setQuota(res.data)).catch(() => {});

  // Improve the summary using AI
  const improveSummary = async () => {
    setError(''); setLoadingSummary(true); setSummaryResult(null);
    try {
      const res = await api.post('/ai/improve-summary', { resumeId, jobDescription: '' });
      setSummaryResult(res.data);
      refreshQuota();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate summary suggestion.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Rewrite a bullet point using AI
  const rewriteBullet = async () => {
    if (!bulletText.trim()) {
      setBulletError('Enter a bullet point to rewrite.');
      return;
    }
    setBulletError(''); setLoadingBullet(true); setBulletResult(null);
    try {
      const res = await api.post('/ai/rewrite-bullet', { bulletText: bulletText.trim(), resumeId });
      setBulletResult(res.data);
      refreshQuota();
    } catch (err) {
      setBulletError(err.response?.data?.error || 'Unable to rewrite this bullet right now. Your original text has not been changed.');
    } finally {
      setLoadingBullet(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Layout title="💡 AI Suggestions" subtitle="Let AI improve your writing — all output is truth-checked against your original resume.">

      <GradientBanner
        icon="🤖"
        title="AI-Powered Writing Assistant"
        subtitle="Uses Google Gemini AI (or local rules if no API key). All suggestions are verified against your actual resume data."
      />

      {/* Quota display */}
      {quota && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
          background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 12,
          padding: '12px 18px',
        }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>AI Credits Remaining</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Each suggestion uses 1 credit</div>
          </div>
          <span style={{
            fontWeight: 800, fontSize: 18,
            color: quota.remaining <= 3 ? '#ef4444' : '#6366f1',
          }}>
            {quota.remaining} / {quota.limit}
          </span>
        </div>
      )}

      {/* Resume selector */}
      <div style={{ maxWidth: 360, marginBottom: 20 }}>
        <label className="form-label">Working with resume</label>
        <select className="form-select" value={resumeId} onChange={e => setResumeId(e.target.value)}>
          {resumes.length === 0 && <option value="">No resumes yet — build one first</option>}
          {resumes.map(r => <option key={r.id} value={r.id}>{r.title} (v{r.version})</option>)}
        </select>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid-2">
        {/* Summary improvement */}
        <Card title="📝 Improve Professional Summary">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Generates a more compelling version of your professional summary using only facts already in your resume.
          </p>
          <button
            className="btn btn-primary"
            onClick={improveSummary}
            disabled={loadingSummary || !resumeId}
          >
            {loadingSummary ? '⏳ Generating...' : '✨ Improve My Summary'}
          </button>

          {loadingSummary && <Spinner label="AI is thinking..." />}

          {summaryResult && (
            <div style={{ marginTop: 16 }} className="animate-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className={`badge ${summaryResult.source === 'gemini' ? 'badge-purple' : 'badge-gray'}`}>
                  {summaryResult.source === 'gemini' ? '🤖 Gemini AI' : '📏 Local Rules'}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(summaryResult.text)}
                >
                  📋 Copy
                </button>
              </div>
              <div style={{
                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                borderRadius: 10, padding: 14, fontSize: 14, lineHeight: 1.6,
              }}>
                {summaryResult.text}
              </div>
              {summaryResult.truthFlags?.length > 0 && (
                <Alert type="warning" style={{ marginTop: 10 }}>
                  <div>
                    <strong>⚠️ Truth-check flags:</strong>
                    <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                      {summaryResult.truthFlags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                </Alert>
              )}
            </div>
          )}
        </Card>

        {/* Bullet point rewriter */}
        <Card title="⚡ Rewrite a Bullet Point">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
            Paste one bullet point and get a stronger, action-verb-led rewrite.
          </p>
          <textarea
            className="form-textarea"
            value={bulletText}
            onChange={e => { setBulletText(e.target.value); setBulletError(''); }}
            placeholder="e.g. Responsible for handling customer complaints and resolving issues"
            style={{ minHeight: 90 }}
          />
          <button
            className="btn btn-pink"
            onClick={rewriteBullet}
            disabled={loadingBullet}
            style={{ marginTop: 10 }}
          >
            {loadingBullet ? '⏳ Rewriting...' : '✍️ Rewrite Bullet Point'}
          </button>

          {bulletError && <Alert type="error" style={{ marginTop: 10 }}>{bulletError}</Alert>}

          {loadingBullet && <Spinner label="Rewriting..." />}

          {bulletResult && (
            <div style={{ marginTop: 16 }} className="animate-in">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>AI Rewrite</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className={`badge ${bulletResult.source === 'gemini' ? 'badge-purple' : 'badge-gray'}`}>
                  {bulletResult.source === 'gemini' ? '🤖 Gemini AI' : '📏 Local Rules'}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(bulletResult.rewrittenBullet)}
                >
                  📋 Copy
                </button>
              </div>
              <div style={{
                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                borderRadius: 10, padding: 14, fontSize: 14, lineHeight: 1.6,
              }}>
                {bulletResult.rewrittenBullet}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                {bulletResult.rewrittenBullet.trim().split(/\s+/).filter(Boolean).length} words · {bulletResult.rewrittenBullet.length} characters
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setBulletText(bulletResult.rewrittenBullet)}>Use This</button>
                <button className="btn btn-secondary btn-sm" onClick={rewriteBullet} disabled={loadingBullet}>Rewrite Again</button>
              </div>
              {bulletResult.truthFlags?.length > 0 && (
                <Alert type="warning" style={{ marginTop: 10 }}>
                  <div>
                    <strong>⚠️ Truth-check flags:</strong>
                    <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                      {bulletResult.truthFlags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                </Alert>
              )}
              {bulletResult.truthFlags?.length === 0 && (
                <Alert type="success" style={{ marginTop: 10 }}>✓ No unsupported metrics detected.</Alert>
              )}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
