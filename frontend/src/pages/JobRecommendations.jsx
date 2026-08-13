// JobRecommendations.jsx - "What kind of jobs should I look for?"

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, Spinner, GradientBanner } from '../components/UI';
import JobCard from '../components/JobCard';
import api from '../services/api';

const WORK_MODES = ['All', 'On-site', 'Hybrid', 'Remote'];
const JOB_TYPES  = ['All', 'Full-time', 'Part-time', 'Contract', 'Casual'];

export default function JobRecommendations() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [workMode, setWorkMode] = useState('All');
  const [jobType, setJobType]   = useState('All');

  useEffect(() => {
    api.get('/jobs/recommended')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Could not load job recommendations.'))
      .finally(() => setLoading(false));
  }, []);

  const handleApply = (job) => {
    navigate('/applications', {
      state: {
        prefill: {
          companyName: job.company,
          jobTitle: job.title,
          jobDescription: job.description,
        },
      },
    });
  };

  const filtered = useMemo(() => {
    if (!data?.recommendations) return [];
    const q = search.toLowerCase().trim();
    return data.recommendations.filter(rec => {
      const j = rec.job;
      if (workMode !== 'All' && j.workMode !== workMode) return false;
      if (jobType !== 'All' && j.jobType !== jobType) return false;
      if (q && !j.title.toLowerCase().includes(q) && !j.company.toLowerCase().includes(q) && !j.location.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, workMode, jobType]);

  if (loading) return <Layout title="🧭 Job Matches"><Spinner label="Scoring jobs against your resume..." /></Layout>;

  return (
    <Layout title="🧭 Job Matches" subtitle="What kind of jobs should you be looking for, based on your resume?">
      <GradientBanner
        icon="🧭"
        title="Your best-matching roles"
        subtitle="Ranked by how well your resume matches each listing — the same scoring engine that powers your ATS scan."
      />

      {error && <Alert type="error">{error}</Alert>}

      {!error && data && (
        <>
          {data.suggestedRoles.length > 0 && (
            <Card title="🎯 Suggested roles for you" style={{ marginBottom: 20 }}>
              <div className="tag-list">
                {data.suggestedRoles.map(role => (
                  <span key={role} className="chip">{role}</span>
                ))}
              </div>
              <p className="form-hint" style={{ marginTop: 10 }}>
                Based on the roles your resume matches best below — try searching for these titles on job boards.
              </p>
            </Card>
          )}

          <Alert type="info" style={{ marginBottom: 16 }}>
            📦 These listings come from a demo dataset (not a live job board yet) — great for practicing your targeting,
            but double check real openings elsewhere. {data.source === 'gemini' ? 'Reasons personalised by AI.' : 'Reasons generated locally.'}
          </Alert>

          {/* Search + filter bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder="🔍 Search by title, company or location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="form-select" style={{ width: 140 }} value={workMode} onChange={e => setWorkMode(e.target.value)}>
              {WORK_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
            <select className="form-select" style={{ width: 140 }} value={jobType} onChange={e => setJobType(e.target.value)}>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {(search || workMode !== 'All' || jobType !== 'All') && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setWorkMode('All'); setJobType('All'); }}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Results count */}
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Showing {filtered.length} of {data.recommendations.length} jobs
          </p>

          {filtered.length === 0 ? (
            <p className="page-subtitle">No jobs match your filters — try broadening the search.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filtered.map(rec => (
                <JobCard key={rec.job.id} recommendation={rec} onApply={handleApply} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
