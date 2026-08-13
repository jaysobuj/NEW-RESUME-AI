// Dashboard.jsx - Home page after login, shows stats and quick links

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Spinner, GradientBanner, ProgressBar, Alert } from '../components/UI';
import WorkflowProgress, { useWorkflowStatus } from '../components/WorkflowProgress';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Colour for each application status
const STATUS_COLOURS = {
  Saved: '#6366f1', Applied: '#3b82f6',
  Interview: '#f59e0b', Offer: '#10b981', Rejected: '#ef4444',
};

// Quick action cards shown on the dashboard
const QUICK_ACTIONS = [
  { to: '/resume-builder', icon: '📝', label: 'Build Resume',     colour: '#6366f1', desc: 'Create or edit your resume' },
  { to: '/search-jobs',    icon: '🔍', label: 'Search Jobs',      colour: '#f59e0b', desc: 'Find and select a job'      },
  { to: '/ai-tailoring',   icon: '✂️', label: 'Tailor Resume',    colour: '#ec4899', desc: 'AI-tailor + chat'           },
  { to: '/applications',   icon: '📋', label: 'Track Jobs',       colour: '#10b981', desc: 'Manage applications'        },
];

function nextStepFor(w, atsScore) {
  if (!w) return null;
  if (!w.hasResume) return { label: 'Upload / Build Your Resume', to: '/resume-builder' };
  if (!w.selectedJob) return { label: 'Search & Select a Job', to: '/search-jobs' };
  if (!w.tailoredResume) return { label: 'Tailor Your Resume', to: '/ai-tailoring' };
  if (atsScore == null) return { label: 'Continue ATS Scan', to: '/ats-scan' };
  if (!w.exported) return { label: 'Export Tailored Resume', to: '/export' };
  if (!w.tracked) return { label: 'Add to Application Tracker', to: '/applications' };
  return { label: 'View Application Tracker', to: '/applications' };
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workflowStatus] = useWorkflowStatus();
  const [atsScore, setAtsScore] = useState(null);
  const [resumes, setResumes]     = useState([]);
  const [appStats, setAppStats]   = useState(null);
  const [quota, setQuota]         = useState(null);
  const [reminderCount, setReminderCount] = useState(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const tailoredId = workflowStatus?.tailoredResume?.id;
    if (tailoredId) {
      api.get(`/ats/history/${tailoredId}`)
        .then(r => setAtsScore(r.data.scans?.[0]?.overall_score ?? null))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowStatus?.tailoredResume?.id]);

  useEffect(() => {
    // Load all dashboard data at once
    Promise.all([
      api.get('/resumes'),
      api.get('/applications/stats/summary'),
      api.get('/ai/quota'),
      api.get('/applications/reminders').catch(() => ({ data: { reminders: [] } })),
    ])
      .then(([resumesRes, statsRes, quotaRes, remindersRes]) => {
        setResumes(resumesRes.data.resumes);
        setAppStats(statsRes.data.summary);
        setQuota(quotaRes.data);
        setReminderCount(remindersRes.data.reminders.length);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout title="Dashboard"><Spinner label="Loading your dashboard..." /></Layout>;

  const totalApps = appStats ? Object.values(appStats).reduce((a, b) => a + b, 0) : 0;
  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <Layout
      title={`Hey ${firstName}! 👋`}
      subtitle="Here's what's happening with your job search today."
    >
      {/* Welcome banner */}
      <GradientBanner
        icon="🚀"
        title="Ready to land your next role?"
        subtitle="Use the tools below to build a standout resume and track your applications."
      />

      <WorkflowProgress status={workflowStatus} atsScored={atsScore != null} />

      {/* Guided workflow status */}
      {workflowStatus && (
        <Card title="🧭 Your Workflow" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, fontSize: 13.5, marginBottom: 14 }}>
            <div><strong>Resume:</strong> {workflowStatus.hasResume ? `Uploaded (${workflowStatus.resumeCount})` : 'Not yet'}</div>
            <div><strong>Selected Job:</strong> {workflowStatus.selectedJob ? workflowStatus.selectedJob.title : 'None selected'}</div>
            <div><strong>Tailored Resume:</strong> {workflowStatus.tailoredResume ? 'Ready' : 'Not yet'}</div>
            <div><strong>ATS:</strong> {atsScore != null ? `${atsScore}%` : 'Not scanned'}</div>
            <div><strong>Application:</strong> {workflowStatus.tracked ? workflowStatus.trackedApp.status : 'Not submitted'}</div>
          </div>
          {nextStepFor(workflowStatus, atsScore) && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(nextStepFor(workflowStatus, atsScore).to)}>
              {nextStepFor(workflowStatus, atsScore).label} →
            </button>
          )}
        </Card>
      )}

      {/* Smart reminder nudge */}
      {reminderCount > 0 && (
        <Link to="/applications" style={{ textDecoration: 'none' }}>
          <Alert type="warning" style={{ marginBottom: 20, cursor: 'pointer' }}>
            You have {reminderCount} application reminder{reminderCount !== 1 ? 's' : ''} — tap to review.
          </Alert>
        </Link>
      )}

      {/* Stat cards row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-value">{resumes.length}</div>
          <div className="stat-label">📄 Resumes</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{totalApps}</div>
          <div className="stat-label">📋 Applications</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{appStats?.Interview || 0}</div>
          <div className="stat-label">🎤 Interviews</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{quota ? quota.remaining : '—'}</div>
          <div className="stat-label">💡 AI Credits Left</div>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {QUICK_ACTIONS.map(action => (
          <Link key={action.to} to={action.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              textAlign: 'center', cursor: 'pointer', padding: '20px 16px',
              borderTop: `3px solid ${action.colour}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{action.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: action.colour }}>{action.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{action.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        {/* Recent resumes */}
        <Card title="📄 Your Resumes">
          {resumes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
              <p className="page-subtitle">No resumes yet.</p>
              <Link to="/resume-builder" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
                Build your first resume →
              </Link>
            </div>
          ) : (
            <>
              {resumes.slice(0, 5).map((r) => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #f1f5f9',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                    <span className="badge badge-purple" style={{ marginLeft: 8, fontSize: 11 }}>v{r.version}</span>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>
                    {new Date(r.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
              <Link to="/resume-builder" className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
                Manage resumes →
              </Link>
            </>
          )}
        </Card>

        {/* Application pipeline */}
        <Card title="📊 Application Pipeline">
          {appStats ? (
            <>
              {Object.entries(appStats).map(([status, count]) => (
                <div key={status} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{status}</span>
                    <span style={{ fontWeight: 700, color: STATUS_COLOURS[status] }}>{count}</span>
                  </div>
                  <ProgressBar value={count} max={Math.max(totalApps, 1)} colour={STATUS_COLOURS[status]} />
                </div>
              ))}
              <Link to="/applications" className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
                Open tracker →
              </Link>
            </>
          ) : (
            <p className="page-subtitle">No applications yet.</p>
          )}
        </Card>
      </div>

      {/* AI credits bar */}
      {quota && (
        <Card style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>💡 AI Credits</span>
              <span className="badge badge-purple" style={{ marginLeft: 10 }}>{user?.plan === 'pro' ? 'Pro' : 'Free'}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>
              {quota.remaining} / {quota.limit} remaining
            </span>
          </div>
          <ProgressBar
            value={quota.used}
            max={quota.limit}
            colour={quota.remaining <= 3 ? '#ef4444' : undefined}
          />
          {quota.remaining <= 5 && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#d97706' }}>
              ⚠️ Running low on credits. Paid top-ups coming soon!
            </div>
          )}
        </Card>
      )}
    </Layout>
  );
}
