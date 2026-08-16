// AITailoring.jsx - Step 4: tailor the resume for the selected job, with
// a compact chat for follow-up edits. Reuses the existing Gemini/local
// tailoring + truth-check pipeline; never overwrites the original resume.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, Spinner, GradientBanner } from '../components/UI';
import WorkflowProgress, { useWorkflowStatus } from '../components/WorkflowProgress';
import ResumePreview from '../components/ResumePreview';
import api from '../services/api';

export default function AITailoring() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, reloadStatus] = useWorkflowStatus();

  const [resumes, setResumes]   = useState([]);
  const [resumeId, setResumeId] = useState(''); // original resume being tailored
  const [originalResume, setOriginalResume] = useState(null); // full record (list is summary-only)
  const [job, setJob]           = useState(null);
  const [tailoredResume, setTailoredResume] = useState(null); // full resume object once created

  const [proposal, setProposal] = useState(null); // { tailoredSummary, keywordsToAdd, reasoning, truthFlags, source }
  const [loading, setLoading]   = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState('');
  const [atsFeedback] = useState(location.state?.atsFeedback || null);

  const [previewKey, setPreviewKey] = useState(0);
  const [appliedSummary, setAppliedSummary] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null); // { fromMessageIndex, proposedSummary, proposedBullet }
  const chatEndRef = useRef(null);

  const loadTailoredResume = async (id) => {
    if (!id) { setTailoredResume(null); return; }
    try {
      const res = await api.get(`/resumes/${id}`);
      setTailoredResume(res.data.resume);
    } catch (err) {
      // The linked tailored resume no longer exists (e.g. deleted from
      // the builder) — don't leave the workflow silently pointing at a
      // dead id forever, and don't leave a spinner-less blank state.
      setTailoredResume(null);
      await api.post('/workflow/tailored-resume', { resumeId: null }).catch(() => {});
    }
  };

  useEffect(() => {
    Promise.all([api.get('/resumes'), api.get('/workflow')]).then(([resumesRes, workflowRes]) => {
      const originals = resumesRes.data.resumes.filter(r => !r.parent_resume_id);
      setResumes(originals);
      if (originals.length > 0) setResumeId(originals[0].id);
      setJob(workflowRes.data.selected_job);
      setChatHistory(workflowRes.data.chat_history || []);
      if (workflowRes.data.tailored_resume_id) loadTailoredResume(workflowRes.data.tailored_resume_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  useEffect(() => {
    if (!resumeId) { setOriginalResume(null); return; }
    api.get(`/resumes/${resumeId}`).then(res => setOriginalResume(res.data.resume));
  }, [resumeId]);

  const currentSummary = tailoredResume?.summary || originalResume?.summary || '';
  const previewSource = (showOriginal || !tailoredResume) ? originalResume : tailoredResume;
  const previewResumeId = previewSource?.id || '';
  const previewTemplate = previewSource?.template || 'modern';
  const previewFont = previewSource?.font || null;

  const runTailor = async () => {
    if (!resumeId || !job) return;
    setError(''); setLoading(true); setProposal(null); setAppliedSummary(null);
    try {
      const res = await api.post('/ai/tailor', { resumeId, jobDescription: job.description, jobId: job.id });
      setProposal(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to tailor resume.');
    } finally {
      setLoading(false);
    }
  };

  // Reorders resume.skills locally (no AI, no invention) so job-relevant
  // skills appear first — this is the "skill ordering" improvement.
  const reorderSkills = (skills, jobDescription) => {
    const jd = (jobDescription || '').toLowerCase();
    const list = (skills || []).map(s => (typeof s === 'string' ? s : s.name || ''));
    return [...list].sort((a, b) => {
      const aHit = jd.includes(a.toLowerCase()) ? 0 : 1;
      const bHit = jd.includes(b.toLowerCase()) ? 0 : 1;
      return aHit - bHit;
    });
  };

  // Applies a summary rewrite and/or one or more bullet rewrites in one
  // save — this is what makes "Apply" update the WHOLE tailored resume
  // (summary + relevant bullets + skill order), not only the summary.
  // Creates the tailored copy on first use; every call after that edits
  // it in place. The original resume is never touched.
  const applyChanges = async ({ summary, bulletEdits, addSkills } = {}) => {
    if (!originalResume) {
      setError('Still loading your resume — please try again in a moment.');
      return;
    }
    setApplying(true);
    try {
      let targetId = tailoredResume?.id;
      let base = tailoredResume;
      if (!targetId) {
        const dup = await api.post(`/resumes/${resumeId}/duplicate`, {
          title: `${originalResume.title} — Tailored for ${job.title}`,
          tailoredForJobId: job.id,
          tailoredForJobTitle: job.title,
        });
        targetId = dup.data.resume.id;
        base = dup.data.resume;
        await api.post('/workflow/tailored-resume', { resumeId: targetId });
        // Commit immediately — if the PUT below fails, the app still
        // knows this tailored resume exists instead of forgetting it
        // and creating ANOTHER duplicate on the next retry.
        setTailoredResume(base);
        reloadStatus();
      }

      const fields = {};
      // Skills are the human self-certifying "yes I genuinely have this" —
      // the AI never adds to this list, only the user's own click does.
      let skillsList = safeParse(base?.skills).length ? safeParse(base?.skills) : (base?.skills || []);
      skillsList = skillsList.map(s => (typeof s === 'string' ? s : s.name || ''));
      let skillsTouched = false;
      (addSkills || []).forEach(s => {
        if (!skillsList.some(x => x.toLowerCase() === s.toLowerCase())) { skillsList.push(s); skillsTouched = true; }
      });
      if (summary !== undefined) {
        fields.summary = summary;
        skillsTouched = true; // existing behaviour: reorder skills whenever the summary is applied
      }
      if (skillsTouched) fields.skills = reorderSkills(skillsList, job.description);
      if (bulletEdits?.length) {
        const experience = JSON.parse(JSON.stringify(safeParse(base?.experience)));
        bulletEdits.forEach(({ expIndex, bulletIndex, text }) => {
          if (experience[expIndex]) {
            experience[expIndex].bullets = experience[expIndex].bullets || [];
            experience[expIndex].bullets[bulletIndex] = text;
          }
        });
        fields.experience = experience;
      }

      await api.put(`/resumes/${targetId}`, fields);
      await loadTailoredResume(targetId);
      reloadStatus();

      const applied = [];
      if (summary !== undefined) applied.push('Professional summary aligned to target role');
      if (bulletEdits?.length) applied.push(`${bulletEdits.length} experience bullet${bulletEdits.length > 1 ? 's' : ''} sharpened with job-relevant wording`);
      if (skillsTouched && summary !== undefined) applied.push('Existing skills reordered by job relevance');
      if (addSkills?.length) applied.push(`Self-certified skill${addSkills.length > 1 ? 's' : ''} added: ${addSkills.join(', ')}`);
      setAppliedSummary(applied);

      setProposal(null);
      setPendingEdit(null);
      setPreviewKey(k => k + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the tailored resume. Your progress so far was kept — try again.');
    } finally {
      setApplying(false);
    }
  };

  const applySummary = (summaryText) => applyChanges({ summary: summaryText });
  const applyBullet = (edit) => applyChanges({ bulletEdits: [edit] });
  const addSkill = (keyword) => applyChanges({ addSkills: [keyword] });

  const currentSkills = safeParse((tailoredResume || originalResume)?.skills)
    .map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase());
  const hasSkill = (keyword) => currentSkills.includes(keyword.toLowerCase());

  const sendChat = async () => {
    if (!chatInput.trim() || !resumeId) return;
    const message = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/chat', { resumeId, message, currentSummary });
      setChatHistory(res.data.chatHistory);
      if (res.data.proposedSummary || res.data.proposedBullet) {
        setPendingEdit({
          messageIndex: res.data.chatHistory.length - 1,
          proposedSummary: res.data.proposedSummary,
          proposedBullet: res.data.proposedBullet,
          truthFlags: res.data.truthFlags,
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Chat failed.');
    } finally {
      setChatLoading(false);
    }
  };

  if (!job) {
    return (
      <Layout title="✂️ AI Tailoring + Chat" subtitle="Tailor your resume to a specific job — without inventing anything new.">
        <WorkflowProgress status={status} atsScored={false} />
        <Alert type="warning">
          No job selected yet. <a href="/search-jobs">Search jobs and select one →</a>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="✂️ AI Tailoring + Chat" subtitle={`Tailoring for: ${job.title} at ${job.company}`}>
      <WorkflowProgress status={status} atsScored={false} />

      <GradientBanner icon="🎯" title="Truth-Constrained AI Tailoring"
        subtitle="The AI only uses facts already in your resume. It will never make up skills or experience." />

      {atsFeedback && (
        <Alert type="info" style={{ marginBottom: 16 }}>
          📊 Back from ATS Scan ({atsFeedback.score}%) — missing keywords: {atsFeedback.missingKeywords?.slice(0, 8).join(', ') || 'none'}.
          Ask the chat below to work these in, only if genuinely applicable.
        </Alert>
      )}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="📋 Setup">
            <div className="form-group">
              <label className="form-label">Original resume to tailor</label>
              <select className="form-select" value={resumeId} onChange={e => { setResumeId(e.target.value); setProposal(null); }}>
                {resumes.length === 0 && <option value="">No resumes yet</option>}
                {resumes.map(r => <option key={r.id} value={r.id}>{r.title} (v{r.version})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Job</label>
              <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 13 }}>
                <strong>{job.title}</strong> — {job.company}<br />
                <span style={{ color: 'var(--text-muted)' }}>{job.location} · {job.workMode}</span>
              </div>
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <button className="btn btn-primary btn-block btn-lg" onClick={runTailor} disabled={loading || !resumeId}>
              {loading ? '⏳ Tailoring...' : tailoredResume ? '🔄 Re-run Tailoring (1 credit)' : '✂️ Tailor My Resume for This Job (1 credit)'}
            </button>
          </Card>

          <Card title="👁️ Resume Preview">
            {previewResumeId ? (
              <>
                {tailoredResume && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'center' }}>
                    <button
                      className={`btn btn-sm ${!showOriginal ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setShowOriginal(false)}
                    >
                      ✨ Tailored
                    </button>
                    <button
                      className={`btn btn-sm ${showOriginal ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setShowOriginal(true)}
                    >
                      📄 Original
                    </button>
                  </div>
                )}
                <div style={{ maxWidth: 320, margin: '0 auto' }}>
                  <ResumePreview resumeId={previewResumeId} template={previewTemplate} font={previewFont} refreshKey={previewKey} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {tailoredResume
                      ? (showOriginal ? 'Showing your original resume, unchanged.' : 'Showing your tailored resume — toggle to compare.')
                      : 'Showing your original resume — tailor it to create a job-specific copy.'}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/resume-builder', { state: { openResumeId: previewResumeId } })}>
                    ✏️ Edit This Resume
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a resume to preview it here.</p>
            )}
          </Card>

          {proposal && (
            <Card title="✨ Proposed Changes">
              <span className={`badge ${proposal.source === 'gemini' ? 'badge-purple' : 'badge-gray'}`}>
                {proposal.source === 'gemini' ? '🤖 Gemini AI' : '📏 Local Rules'}
              </span>
              {proposal.tailoredSummary === currentSummary && !(proposal.tailoredBullets?.length > 0) && (
                <Alert type="warning" style={{ marginTop: 10 }}>
                  No safe changes found — the AI's rewrite would have introduced skills or claims not backed by your
                  resume, so your original summary was kept unchanged rather than invent a fit that isn't there. This
                  usually means the role is a significant departure from your current experience.
                </Alert>
              )}
              {proposal.tailoredSummary !== currentSummary && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginTop: 10 }}>
                  ✨ ATS-Optimised Summary — aligned to {job.title}
                </div>
              )}
              <div style={{ marginTop: 6, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: 14, fontSize: 14 }}>
                {proposal.tailoredSummary}
              </div>
              {proposal.tailoredBullets?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    EXPERIENCE BULLETS ({proposal.tailoredBullets.length} sharpened for this job)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {proposal.tailoredBullets.map((b, i) => (
                      <div key={i} style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 12.5 }}>
                        <div style={{ color: 'var(--text-muted)', textDecoration: 'line-through', marginBottom: 4 }}>{b.original}</div>
                        <div>→ {b.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {proposal.keywordsToAdd?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>JOB SKILLS NOT FOUND IN YOUR RESUME</div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 6px' }}>
                    Only add a skill if you can genuinely back it up — clicking "+" adds it to this tailored resume's Skills section. The AI never adds these on its own.
                  </p>
                  <div className="tag-list">
                    {proposal.keywordsToAdd.map((k, i) => hasSkill(k) ? (
                      <span key={i} className="tag" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>✓ {k}</span>
                    ) : (
                      <button key={i} className="tag" style={{ cursor: 'pointer', border: '1px dashed var(--border)', background: 'none' }}
                        disabled={applying} onClick={() => addSkill(k)}>
                        + {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {proposal.truthFlags?.length > 0 && (
                <Alert type="warning" style={{ marginTop: 10 }}>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {proposal.truthFlags.map((f, i) => <li key={i} style={{ marginBottom: i < proposal.truthFlags.length - 1 ? 6 : 0 }}>{f}</li>)}
                  </ul>
                </Alert>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm"
                  onClick={() => applyChanges({ summary: proposal.tailoredSummary, bulletEdits: proposal.tailoredBullets })}
                  disabled={applying || (proposal.tailoredSummary === currentSummary && !(proposal.tailoredBullets?.length > 0))}>
                  {applying ? '⏳...' : `✅ Apply All${proposal.tailoredBullets?.length ? ` (summary + ${proposal.tailoredBullets.length} bullets)` : ''}`}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={runTailor} disabled={loading}>🔄 Regenerate</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setProposal(null)}>✕ Discard</button>
              </div>
            </Card>
          )}

          {appliedSummary && (
            <Alert type="success">
              <div>
                <strong>✓ Safe improvements applied</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {appliedSummary.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            </Alert>
          )}

          {tailoredResume && (
            <Card title="📄 Current Tailored Resume">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{tailoredResume.title}</div>
              <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: 14, fontSize: 13.5, lineHeight: 1.6 }}>
                {tailoredResume.summary}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/ats-scan')}>🎯 Run ATS Scan</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/export')}>📥 Export</button>
              </div>
            </Card>
          )}
        </div>

        {/* Chat panel */}
        <Card title="💬 AI Chat">
          <div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {chatHistory.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Try: "Make the summary shorter", "Emphasise cyber security", "Rewrite the bullet about X", "Make it more ATS friendly".
                </p>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 12px', fontSize: 13.5,
                }}>
                  {m.content}
                  {pendingEdit && pendingEdit.messageIndex === i && (pendingEdit.proposedSummary || pendingEdit.proposedBullet) && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: 12.5, fontStyle: 'italic', marginBottom: 6 }}>
                        {pendingEdit.proposedSummary ? `Proposed summary: "${pendingEdit.proposedSummary.slice(0, 100)}${pendingEdit.proposedSummary.length > 100 ? '…' : ''}"` : ''}
                        {pendingEdit.proposedBullet ? `Proposed bullet: "${pendingEdit.proposedBullet.text.slice(0, 100)}${pendingEdit.proposedBullet.text.length > 100 ? '…' : ''}"` : ''}
                      </div>
                      {pendingEdit.truthFlags?.length > 0 && (
                        <div style={{ fontSize: 11, color: '#d97706', marginBottom: 6 }}>⚠️ {pendingEdit.truthFlags.join(' ')}</div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} disabled={applying}
                          onClick={() => pendingEdit.proposedSummary ? applySummary(pendingEdit.proposedSummary) : applyBullet(pendingEdit.proposedBullet)}>
                          ✅ Apply
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => { setChatInput(chatHistory[i - 1]?.content || ''); setPendingEdit(null); }}>
                          🔄 Regenerate
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setPendingEdit(null)}>
                          ✕ Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && <Spinner label="Thinking..." />}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="form-input" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !chatLoading && sendChat()}
                placeholder="Ask for an edit..." disabled={!resumeId} />
              <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>Send</button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function safeParse(field) {
  try { return typeof field === 'string' ? JSON.parse(field) : (field || []); } catch { return []; }
}
