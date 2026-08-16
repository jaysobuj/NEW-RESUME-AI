// ATSScan.jsx - ATS scoring with scan history comparison

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, Spinner, ScoreRing, GradientBanner, ProgressBar } from '../components/UI';
import WorkflowProgress, { useWorkflowStatus } from '../components/WorkflowProgress';
import api from '../services/api';

const CATEGORY_LABELS = {
  keywordMatch:           '🔑 Keyword Match',
  skillsMatch:            '🛠️ Skills Match',
  sectionCompleteness:    '📋 Section Completeness',
  contactDetails:         '📞 Contact Details',
  actionVerbs:            '⚡ Action Verbs',
  measurableAchievements: '📈 Measurable Achievements',
  formatting:             '🎨 Formatting',
};

function scoreColour(val) {
  return val >= 75 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444';
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ATSScan() {
  const navigate = useNavigate();
  const [status] = useWorkflowStatus();
  const [resumes, setResumes]     = useState([]);
  const [resumeId, setResumeId]   = useState('');
  const [jobDescription, setJD]   = useState('');
  const [job, setJob]             = useState(null);
  const [result, setResult]       = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [autoRan, setAutoRan]     = useState(false);
  const [addingSkill, setAddingSkill] = useState('');

  useEffect(() => {
    Promise.all([api.get('/resumes'), api.get('/workflow')]).then(([resumesRes, workflowRes]) => {
      const list = resumesRes.data.resumes;
      setResumes(list);
      const workflow = workflowRes.data;
      // Prefer the current tailored resume + the selected job's description
      // so no manual paste is needed after Search Jobs / Tailoring.
      const preferredId = workflow.tailored_resume_id && list.some(r => r.id === workflow.tailored_resume_id)
        ? workflow.tailored_resume_id
        : (list[0]?.id || '');
      if (preferredId) { setResumeId(preferredId); loadHistory(preferredId); }
      if (workflow.selected_job) { setJob(workflow.selected_job); setJD(workflow.selected_job.description); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run once both resume and job description are available.
  useEffect(() => {
    if (!autoRan && resumeId && jobDescription.trim()) {
      setAutoRan(true);
      runScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, jobDescription]);

  const loadHistory = (rid) =>
    api.get(`/ats/history/${rid}`).then(r => setHistory(r.data.scans || [])).catch(() => {});

  const onResumeChange = (id) => {
    setResumeId(id);
    setResult(null);
    loadHistory(id);
  };

  const runScan = async () => {
    if (!resumeId || !jobDescription.trim()) {
      setError('Please select a resume and paste a job description.');
      return;
    }
    setError(''); setLoading(true); setResult(null);
    try {
      const res = await api.post('/ats/scan', { resumeId, jobDescription });
      setResult(res.data);
      loadHistory(resumeId);
    } catch(err) {
      setError(err.response?.data?.error || 'Scan failed.');
    } finally { setLoading(false); }
  };

  const previousBest = history.length > 1 ? Math.max(...history.slice(1).map(s => s.overall_score)) : null;

  // Self-certified skill addition: the AI never adds skills on its own —
  // this only fires from the user's own click, confirming they genuinely
  // have it. Re-runs the scan immediately so the score reflects it.
  const addSkillAndRescan = async (keyword) => {
    setAddingSkill(keyword);
    setError('');
    try {
      const res = await api.get(`/resumes/${resumeId}`);
      const current = safeParse(res.data.resume.skills).map(s => (typeof s === 'string' ? s : s.name || ''));
      if (!current.some(s => s.toLowerCase() === keyword.toLowerCase())) {
        await api.put(`/resumes/${resumeId}`, { skills: [...current, keyword] });
      }
      await runScan();
    } catch (err) {
      setError('Could not add that skill. Please try again.');
    } finally {
      setAddingSkill('');
    }
  };

  const improveWithTailoring = () => {
    navigate('/ai-tailoring', {
      state: { atsFeedback: { score: result.overallScore, missingKeywords: result.missingKeywords } },
    });
  };

  const addToTracker = () => {
    navigate('/applications', {
      state: {
        prefill: {
          companyName: job?.company || '', jobTitle: job?.title || '',
          jobDescription, resumeId, jobId: job?.id || null, atsScore: result?.overallScore,
        },
      },
    });
  };

  return (
    <Layout title="🎯 ATS Scan" subtitle="See how well your resume matches a job description.">
      <WorkflowProgress status={status} atsScored={!!result} />
      <GradientBanner icon="🤖" title="Local ATS Scoring Engine"
        subtitle="No AI credits used — runs on our own keyword and rules engine. Results are instant." />

      {job && (
        <Alert type="info" style={{ marginBottom: 16 }}>
          🎯 Auto-scanning against your selected job: <strong>{job.title}</strong> at {job.company}. No manual paste needed.
        </Alert>
      )}

      <div className="grid-2">
        <Card title="📋 Scan Setup">
          <div className="form-group">
            <label className="form-label">Select your resume</label>
            <select className="form-select" value={resumeId} onChange={e => onResumeChange(e.target.value)}>
              {resumes.length === 0 && <option value="">No resumes yet — build one first</option>}
              {resumes.map(r => <option key={r.id} value={r.id}>{r.title} (v{r.version})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Job description</label>
            <p className="form-hint" style={{ marginTop: 0, marginBottom: 8 }}>
              Copy the job ad from Seek, LinkedIn or the company website and paste it here.
            </p>
            <textarea className="form-textarea" style={{ minHeight: 260 }} value={jobDescription}
              onChange={e => setJD(e.target.value)}
              placeholder="Paste the full job description here — responsibilities, requirements and skills..." />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              {jobDescription.trim() ? `${jobDescription.trim().split(/\s+/).length} words` : 'Longer job ads give more accurate results.'}
            </div>
          </div>

          {error && <Alert type="error">{error}</Alert>}
          <button className="btn btn-primary btn-block btn-lg" onClick={runScan} disabled={loading}>
            {loading ? '⏳ Scanning...' : '🚀 Run ATS Scan'}
          </button>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
            Free · No AI credits used · Results in seconds
          </p>

          {/* Scan history */}
          {history.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📈 Scan History
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.slice(0, 5).map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i === 0 ? 'Latest' : fmt(s.created_at)}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: scoreColour(s.overall_score) }}>{s.overall_score}%</span>
                  </div>
                ))}
              </div>
              {previousBest !== null && result && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: result.overallScore >= previousBest ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.overallScore >= previousBest ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, fontSize: 13 }}>
                  {result.overallScore >= previousBest
                    ? `✅ Improved by ${result.overallScore - previousBest}% vs your previous best`
                    : `⬇️ ${previousBest - result.overallScore}% below your previous best`}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="📊 Results">
          {loading && <Spinner label="Analyzing your resume..." />}
          {!loading && !result && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: 50, marginBottom: 12 }}>🎯</div>
              <p>Run a scan to see your results here.</p>
            </div>
          )}
          {result && (
            <div className="animate-in">
              <ScoreRing score={result.overallScore} />
              <p style={{ textAlign: 'center', marginTop: 8, color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                Overall ATS Score
              </p>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Score Breakdown</h4>
              {Object.entries(result.breakdown).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{CATEGORY_LABELS[key] || key}</span>
                    <strong style={{ color: scoreColour(val) }}>{val}%</strong>
                  </div>
                  <ProgressBar value={val} colour={scoreColour(val)} />
                </div>
              ))}
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 10px' }}>✅ Matched</h4>
              <div className="tag-list">
                {result.matchedKeywords.length === 0
                  ? <span style={{ color: '#94a3b8', fontSize: 13 }}>None found</span>
                  : result.matchedKeywords.map(k => (
                    <span key={k} className="tag" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>{k}</span>
                  ))}
              </div>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 10px' }}>❌ Missing</h4>
              {result.missingKeywords.length > 0 && (
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                  Only click "+" if you genuinely have it — this adds it to your resume's Skills section and re-scans.
                </p>
              )}
              <div className="tag-list">
                {result.missingKeywords.length === 0
                  ? <span style={{ color: '#94a3b8', fontSize: 13 }}>None — great match! 🎉</span>
                  : result.missingKeywords.map(k => (
                    <button key={k} className="tag" disabled={!!addingSkill}
                      style={{ cursor: 'pointer', background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}
                      onClick={() => addSkillAndRescan(k)}>
                      {addingSkill === k ? '⏳...' : `+ ${k}`}
                    </button>
                  ))}
              </div>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 10px' }}>💡 Suggestions</h4>
              <ul style={{ fontSize: 13.5, paddingLeft: 18, color: '#374151' }}>
                {result.suggestions.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
              </ul>
              <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={improveWithTailoring}>✂️ Improve Using ATS Feedback</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/export')}>📥 Export Resume</button>
                <button className="btn btn-secondary btn-sm" onClick={addToTracker}>📋 Add to Tracker</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}

function safeParse(field) {
  try { return typeof field === 'string' ? JSON.parse(field) : (field || []); } catch { return []; }
}
