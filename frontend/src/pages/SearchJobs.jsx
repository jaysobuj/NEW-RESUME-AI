// SearchJobs.jsx - Step 2 of the guided workflow: search the local demo
// job database, view a listing, and select one to carry into Tailoring.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, Spinner, GradientBanner } from '../components/UI';
import JobCard from '../components/JobCard';
import WorkflowProgress, { useWorkflowStatus } from '../components/WorkflowProgress';
import api from '../services/api';

export default function SearchJobs() {
  const navigate = useNavigate();
  const [status, reloadStatus] = useWorkflowStatus();
  const [resumeId, setResumeId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [filterMeta, setFilterMeta] = useState({ types: [], experienceLevels: [], workModes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [selecting, setSelecting] = useState('');

  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('All');
  const [experienceLevel, setExperienceLevel] = useState('All');

  useEffect(() => {
    api.get('/resumes').then(res => {
      if (res.data.resumes.length > 0) setResumeId(res.data.resumes[0].id);
    });
  }, []);

  const search = () => {
    setLoading(true);
    setError('');
    api.get('/jobs/catalogue', { params: { q, location, type, experienceLevel, resumeId: resumeId || undefined } })
      .then(res => { setJobs(res.data.jobs); setFilterMeta(res.data.filters); })
      .catch(() => setError('Could not load jobs.'))
      .finally(() => setLoading(false));
  };

  useEffect(search, [resumeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectJob = async (job) => {
    setSelecting(job.id);
    try {
      await api.post('/workflow/select-job', { jobId: job.id });
      reloadStatus();
      navigate('/ai-tailoring');
    } catch (err) {
      setError('Could not select this job.');
    } finally {
      setSelecting('');
    }
  };

  const trackJob = (job) => {
    navigate('/applications', {
      state: { prefill: { companyName: job.company, jobTitle: job.title, jobDescription: job.description } },
    });
  };

  const selectedJobId = status?.selectedJob?.id;

  return (
    <Layout title="🔍 Search Jobs" subtitle="Browse the demo IT job database, then select one to tailor your resume for.">
      <WorkflowProgress status={status} atsScored={false} />

      <GradientBanner icon="🔍" title="Local demo job database"
        subtitle="~60 realistic IT roles — no live job API required. Search, view, and select a job to carry it automatically into Tailoring and ATS Scan." />

      {!status?.hasResume && (
        <Alert type="warning" style={{ marginBottom: 16 }}>
          Upload or build a resume first so we can show match scores. <a href="/resume-builder">Go to Resume →</a>
        </Alert>
      )}

      {error && <Alert type="error">{error}</Alert>}

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" style={{ flex: 2, minWidth: 200 }} placeholder="🔍 Title, company or skill..."
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="📍 Location..."
            value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <select className="form-select" style={{ width: 150 }} value={type} onChange={e => setType(e.target.value)}>
            <option>All</option>
            {filterMeta.types.map(t => <option key={t}>{t}</option>)}
          </select>
          <select className="form-select" style={{ width: 150 }} value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}>
            <option>All</option>
            {filterMeta.experienceLevels.map(t => <option key={t}>{t}</option>)}
          </select>
          <button className="btn btn-primary" onClick={search} disabled={loading}>Search</button>
        </div>
      </Card>

      {loading ? <Spinner label="Searching jobs..." /> : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{jobs.length} jobs found</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {jobs.map(rec => (
              <JobCard key={rec.job.id} recommendation={rec}
                selected={rec.job.id === selectedJobId}
                onView={setViewing}
                onApply={trackJob}
                onSelect={selecting === rec.job.id ? undefined : selectJob} />
            ))}
          </div>
        </>
      )}

      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setViewing(null)}>
          <div style={{ maxWidth: 640, width: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <Card title={`${viewing.title} — ${viewing.company}`}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                📍 {viewing.location} · {viewing.workMode} · {viewing.jobType} · {viewing.experienceLevel}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{viewing.description}</p>
              {viewing.responsibilities?.length > 0 && (
                <>
                  <h4 style={{ fontSize: 14 }}>Responsibilities</h4>
                  <ul style={{ fontSize: 13.5, paddingLeft: 18 }}>
                    {viewing.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              )}
              <h4 style={{ fontSize: 14 }}>Required skills</h4>
              <div className="tag-list">{viewing.requiredSkills.map(s => <span className="tag" key={s}>{s}</span>)}</div>
              {viewing.preferredSkills?.length > 0 && (
                <>
                  <h4 style={{ fontSize: 14 }}>Preferred skills</h4>
                  <div className="tag-list">{viewing.preferredSkills.map(s => <span key={s} className="badge badge-gray" style={{ fontSize: 11 }}>{s}</span>)}</div>
                </>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => { setViewing(null); selectJob(viewing); }}>
                  🎯 Select & Tailor My Resume
                </button>
                <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
}
