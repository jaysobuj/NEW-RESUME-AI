// ExportResume.jsx - Download your resume in a chosen design + format.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, GradientBanner } from '../components/UI';
import TemplatePicker from '../components/TemplatePicker';
import FontPicker from '../components/FontPicker';
import ResumePreview from '../components/ResumePreview';
import WorkflowProgress, { useWorkflowStatus } from '../components/WorkflowProgress';
import api from '../services/api';

// The formats offered, with a short "best for" line.
const FORMATS = [
  { id: 'pdf',  icon: '📕', label: 'PDF',         desc: 'Best all-round. Keeps the design exactly.' },
  { id: 'docx', icon: '📘', label: 'Word (DOCX)', desc: 'Editable in Word or Google Docs.' },
  { id: 'txt',  icon: '📄', label: 'Plain text',  desc: 'Most ATS-safe. Paste into web forms.' },
  { id: 'html', icon: '🌐', label: 'HTML',        desc: 'Self-contained web page you can share.' },
  { id: 'json', icon: '🧩', label: 'JSON',        desc: 'Structured backup / re-import.' },
];

export default function ExportResume() {
  const navigate = useNavigate();
  const [status, reloadStatus]  = useWorkflowStatus();
  const [resumes, setResumes]   = useState([]);
  const [resumeId, setResumeId] = useState('');
  const [template, setTemplate] = useState('modern');
  const [font, setFont]         = useState(null);
  const [job, setJob]           = useState(null);
  const [error, setError]       = useState('');
  const [downloading, setDL]    = useState('');
  const [savingFont, setSavingFont] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/resumes'), api.get('/workflow')]).then(([resumesRes, workflowRes]) => {
      const list = resumesRes.data.resumes;
      setResumes(list);
      const workflow = workflowRes.data;
      const preferred = (workflow.tailored_resume_id && list.find(r => r.id === workflow.tailored_resume_id)) || list[0];
      if (preferred) { setResumeId(preferred.id); setTemplate(preferred.template || 'modern'); setFont(preferred.font || null); }
      setJob(workflow.selected_job);
    });
  }, []);

  // When switching which resume to export, adopt its saved template/font.
  const onResumeChange = (id) => {
    setResumeId(id);
    const r = resumes.find(x => x.id === id);
    if (r) { setTemplate(r.template || 'modern'); setFont(r.font || null); }
  };

  // Template/font choices are persisted onto the resume itself (same
  // field `resume.template` the builder + renderer already use) so the
  // choice survives navigation/refresh and is what actually gets
  // exported — not just a local, throwaway UI selection.
  const persistDesign = async (fields) => {
    if (!resumeId) return;
    setSavingFont(true);
    try { await api.put(`/resumes/${resumeId}`, fields); } catch (_) { /* non-fatal */ }
    setSavingFont(false);
  };
  const onTemplateChange = (id) => { setTemplate(id); persistDesign({ template: id }); };
  const onFontChange = (id) => { setFont(id); persistDesign({ font: id }); };

  const download = async (format) => {
    if (!resumeId) { setError('Please select a resume first.'); return; }
    setError(''); setDL(format);
    try {
      await api.downloadResume(resumeId, format, template, font);
      await api.post('/workflow/mark-exported', {});
      reloadStatus();
    } catch (err) {
      setError('Download failed. Please try again.');
    } finally {
      setDL('');
    }
  };

  const activeResume = resumes.find(r => r.id === resumeId);

  return (
    <Layout title="📤 Export Resume" subtitle="Choose a design and download in the format you need.">
      <WorkflowProgress status={status} atsScored={false} />

      <GradientBanner
        icon="📥"
        title="Download Your Resume"
        subtitle="Pick a template, preview it live, then export as PDF, Word, plain text, HTML or JSON."
      />

      {job && (
        <Alert type="info" style={{ marginBottom: 16 }}>
          🎯 Exporting for: <strong>{job.title}</strong> at {job.company}
          {activeResume?.parent_resume_id ? ' — using your tailored resume.' : ' — using your original resume (tailor it first for a job-specific version).'}
        </Alert>
      )}

      <div className="form-group" style={{ maxWidth: 560 }}>
        <label className="form-label">Which resume?</label>
        <select className="form-select" value={resumeId} onChange={e => onResumeChange(e.target.value)}>
          {resumes.length === 0 && <option value="">No resumes yet — build one first</option>}
          {resumes.map(r => (
            <option key={r.id} value={r.id}>{r.title} (v{r.version}){r.parent_resume_id ? ' — Tailored' : ''}</option>
          ))}
        </select>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: template picker + formats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="🎨 Customize Layout, Font & Content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Layout / Template</span>
              {savingFont && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving...</span>}
            </div>
            <TemplatePicker value={template} onChange={onTemplateChange} />

            <div style={{ fontWeight: 700, fontSize: 13, margin: '20px 0 8px' }}>Font</div>
            <FontPicker value={font} onChange={onFontChange} />

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Need to change the actual content — summary, experience, skills?
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!resumeId}
                onClick={() => navigate('/resume-builder', { state: { openResumeId: resumeId } })}
              >
                ✏️ Edit Full Resume
              </button>
            </div>
          </Card>

          <Card title="⬇️ Download Format">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {FORMATS.map(f => (
                <div key={f.id} style={{
                  border: '1.5px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 30, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, minHeight: 48 }}>{f.desc}</div>
                  <button
                    className="btn btn-primary btn-block btn-sm"
                    onClick={() => download(f.id)}
                    disabled={!!downloading || !resumeId}
                  >
                    {downloading === f.id ? '⏳...' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
            <Alert type="info" style={{ marginTop: 16 }}>
              💡 Applying to jobs? Use <strong>PDF</strong> (with an ATS-safe template) or <strong>Plain text</strong>. Save <strong>Designer</strong> templates for networking and personal sharing.
            </Alert>
          </Card>
        </div>

        {/* Right: live preview */}
        <Card title="👁️ Live Preview">
          {resumeId && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => download('pdf')}
                disabled={!!downloading || !resumeId}
              >
                {downloading === 'pdf' ? '⏳...' : '📕 Download PDF'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => download('docx')}
                disabled={!!downloading || !resumeId}
              >
                {downloading === 'docx' ? '⏳...' : '📘 Download Word'}
              </button>
            </div>
          )}
          <ResumePreview resumeId={resumeId} template={template} font={font} />
        </Card>
      </div>
    </Layout>
  );
}
