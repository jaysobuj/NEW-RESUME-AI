// ApplicationTracker.jsx - Track job applications through a visual pipeline

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, GradientBanner } from '../components/UI';
import api from '../services/api';

const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

// Colours for each status column
const STATUS_COLOURS = {
  Saved: '#6366f1', Applied: '#3b82f6',
  Interview: '#f59e0b', Offer: '#10b981', Rejected: '#ef4444',
};

const EMPTY_FORM = { companyName: '', jobTitle: '', jobDescription: '', status: 'Saved', notes: '', jobId: null, resumeId: null, atsScore: null };

const SIMULATE_LABELS = {
  Saved: 'Simulate: Mark Applied',
  Applied: 'Simulate: Next Update',
  Interview: 'Simulate: Next Update',
};

// Quick-action buttons offered per reminder type, mapped to a target status.
const REMINDER_ACTIONS = {
  stale_Saved:     [{ label: 'Mark Applied', status: 'Applied' }],
  stale_Applied:   [{ label: 'Mark Interview', status: 'Interview' }, { label: 'Mark Rejected', status: 'Rejected' }],
  followup:        [{ label: 'Got the offer', status: 'Offer' }, { label: 'Not selected', status: 'Rejected' }],
};

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export default function ApplicationTracker() {
  const location = useLocation();
  const [applications, setApplications] = useState([]);
  const [reminders, setReminders]       = useState([]);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [error, setError]               = useState('');

  const load = () => {
    api.get('/applications').then(res => setApplications(res.data.applications));
    api.get('/applications/reminders').then(res => setReminders(res.data.reminders)).catch(() => setReminders([]));
  };

  useEffect(() => {
    load();
    // Arrived here from "Track this application" on the Job Matches page —
    // open the form pre-filled with the listing's details.
    if (location.state?.prefill) {
      setForm({ ...EMPTY_FORM, ...location.state.prefill });
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/applications', form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add application.');
    }
  };

  const moveStatus = async (id, status) => {
    await api.put(`/applications/${id}`, { status });
    load();
  };

  const [simulating, setSimulating] = useState('');
  const simulateNext = async (id) => {
    setSimulating(id);
    try {
      await api.post(`/applications/${id}/simulate`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Nothing further to simulate for this application.');
    } finally {
      setSimulating('');
    }
  };

  const setInterviewDate = async (id, interviewDate) => {
    await api.put(`/applications/${id}`, { interviewDate });
    load();
  };

  const snooze = async (id, days = 3) => {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    await api.put(`/applications/${id}`, { reminderSnoozedUntil: until });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this application?')) return;
    await api.delete(`/applications/${id}`);
    load();
  };

  // Group applications by status for the kanban board
  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s);
    return acc;
  }, {});

  const total = applications.length;

  return (
    <Layout
      title="📋 Job Tracker"
      subtitle="Track every application through your pipeline."
      actions={
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Application'}
        </button>
      }
    >
      <GradientBanner
        icon="📊"
        title={`${total} application${total !== 1 ? 's' : ''} tracked`}
        subtitle="Move cards between columns as your applications progress."
      />

      <Alert type="warning" style={{ marginBottom: 20 }}>
        ⚠️ Application status updates are <strong>simulated</strong> for demonstration purposes because this system is
        not connected to live employer recruitment platforms. Use the status dropdown or "Simulate Status Update" on
        each card — real status changes always require you to check with the employer.
      </Alert>

      {/* Smart reminders */}
      {reminders.length > 0 && (
        <Card title="🔔 Reminders" style={{ marginBottom: 20 }}>
          {reminders.map((r, i) => {
            const app = applications.find(a => a.id === r.applicationId);
            const actionKey = r.type === 'stale' ? `stale_${app?.status}` : r.type;
            const actions = REMINDER_ACTIONS[actionKey] || [];
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 12, padding: '10px 0',
                borderBottom: i < reminders.length - 1 ? '1px solid var(--border)' : 'none',
                flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 13, color: r.severity === 'warning' ? '#d97706' : 'var(--text)' }}>
                  {r.severity === 'warning' ? '⚠️' : 'ℹ️'} {r.message}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {actions.map(a => (
                    <button key={a.status} className="btn btn-secondary btn-sm"
                      onClick={() => moveStatus(r.applicationId, a.status)}>
                      {a.label}
                    </button>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => snooze(r.applicationId, 3)}>
                    Snooze 3d
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Add application form */}
      {showForm && (
        <Card title="➕ New Application" style={{ marginBottom: 20 }}>
          {error && <Alert type="error">{error}</Alert>}
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company name *</label>
                <input className="form-input" value={form.companyName}
                  onChange={e => setForm({ ...form, companyName: e.target.value })} required placeholder="e.g. Google" />
              </div>
              <div className="form-group">
                <label className="form-label">Job title *</label>
                <input className="form-input" value={form.jobTitle}
                  onChange={e => setForm({ ...form, jobTitle: e.target.value })} required placeholder="e.g. Software Engineer" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Referral, deadline, etc." />
              </div>
            </div>
            {form.jobDescription && (
              <div className="form-group">
                <label className="form-label">Job description (from Job Matches)</label>
                <textarea className="form-textarea" value={form.jobDescription} readOnly
                  style={{ minHeight: 70, opacity: 0.8 }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit">💾 Save</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {/* Kanban board */}
      <div className="kanban-board">
        {STATUSES.map(status => (
          <div className="kanban-column" key={status}>
            <div className="kanban-column-title" style={{ color: STATUS_COLOURS[status] }}>
              <span>{status}</span>
              <span className="badge" style={{
                background: STATUS_COLOURS[status] + '22',
                color: STATUS_COLOURS[status],
              }}>
                {grouped[status].length}
              </span>
            </div>

            {grouped[status].length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: '#cbd5e1', fontSize: 13 }}>
                No applications here yet
              </div>
            )}

            {grouped[status].map(app => {
              const idleDays = daysAgo(app.status_updated_at || app.updated_at);
              return (
                <div className="kanban-card" key={app.id}>
                  <div className="kanban-card-title">{app.job_title}</div>
                  <div className="kanban-card-sub">🏢 {app.company_name}</div>
                  {Number.isFinite(app.ats_score) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      🎯 ATS score at time of application: <strong>{app.ats_score}%</strong>
                    </div>
                  )}
                  {app.notes && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontStyle: 'italic' }}>
                      {app.notes}
                    </div>
                  )}
                  {idleDays !== null && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                      🕓 {idleDays === 0 ? 'Updated today' : `${idleDays} day${idleDays === 1 ? '' : 's'} in this stage`}
                    </div>
                  )}
                  {app.status === 'Interview' && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label" style={{ fontSize: 10.5 }}>Interview date</label>
                      <input
                        type="date"
                        className="form-input"
                        style={{ fontSize: 12, padding: '5px 8px' }}
                        value={app.interview_date ? app.interview_date.slice(0, 10) : ''}
                        onChange={e => setInterviewDate(app.id, e.target.value)}
                      />
                    </div>
                  )}
                  {/* Status change dropdown */}
                  <select
                    className="form-select"
                    value={app.status}
                    onChange={e => moveStatus(app.id, e.target.value)}
                    style={{ fontSize: 12, padding: '5px 8px', marginBottom: 8 }}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {SIMULATE_LABELS[app.status] && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => simulateNext(app.id)}
                      disabled={simulating === app.id}
                      style={{ width: '100%', fontSize: 11, marginBottom: 6 }}
                      title="Advances this application through a valid simulated next stage — not a real employer update."
                    >
                      {simulating === app.id ? '⏳...' : `🎲 ${SIMULATE_LABELS[app.status]}`}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => remove(app.id)}
                    style={{ width: '100%', color: '#ef4444', borderColor: '#fca5a5', fontSize: 12 }}
                  >
                    🗑️ Remove
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Layout>
  );
}
