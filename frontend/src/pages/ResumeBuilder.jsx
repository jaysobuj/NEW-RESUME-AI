// ==========================================================
// ResumeBuilder.jsx
// The main resume editing page. Users pick/create a resume from
// the list on the left, then fill in personal info, summary,
// education, experience, skills, projects, and certifications
// on the right. Saving updates that resume; "Save as New Version"
// keeps the old copy (version control feature).
// ==========================================================

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { Card, Alert, Spinner } from '../components/UI';
import TemplatePicker from '../components/TemplatePicker';
import FontPicker from '../components/FontPicker';
import ResumePreview from '../components/ResumePreview';
import api from '../services/api';

const emptyResume = {
  title: 'My Resume',
  full_name: '', email: '', phone: '', location: '', linkedin: '',
  summary: '',
  template: 'modern',
  font: null,
  education: [],
  experience: [],
  skills: [],
  projects: [],
  certifications: [],
};

export default function ResumeBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [resumes, setResumes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(emptyResume);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [skillInput, setSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');
  // Bumped after every save so the live preview re-fetches the latest data.
  const [previewKey, setPreviewKey] = useState(0);

  // --- Resume import state ---
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef(null);

  const loadResumes = async () => {
    const res = await api.get('/resumes');
    setResumes(res.data.resumes);
    return res.data.resumes;
  };

  useEffect(() => {
    loadResumes().then((list) => {
      // Arrived here from "Edit Full Resume" (Export / Tailoring pages) —
      // open that specific resume instead of the default list view.
      const wantId = location.state?.openResumeId;
      if (wantId && list.some(r => r.id === wantId)) openResume(wantId);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openResume = async (id) => {
    setLoading(true);
    const res = await api.get(`/resumes/${id}`);
    const r = res.data.resume;
    setForm({
      ...r,
      template: r.template || 'modern',
      education: safeParse(r.education),
      experience: safeParse(r.experience),
      skills: safeParse(r.skills),
      projects: safeParse(r.projects),
      certifications: safeParse(r.certifications),
    });
    setActiveId(id);
    setLoading(false);
  };

  const startNew = () => {
    setForm(emptyResume);
    setActiveId(null);
    // FIX: previously this button gave no feedback at all. If the form was
    // already blank, nothing visibly happened and it looked broken.
    setMessage({ type: 'info', text: 'Started a blank resume — fill it in below, then press Save.' });
  };

  // ---- Import a resume file (PDF / DOCX / TXT) ----
  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const data = await api.importResume(file);

      // Load the newly created resume straight into the editor so the
      // user immediately sees what was extracted and can correct it.
      await loadResumes();
      await openResume(data.resume.id);

      const engine = data.source === 'gemini' ? 'AI extraction' : 'built-in parser';
      const missing = (data.warnings || []).length
        ? ` Could not find: ${data.warnings.join(', ')} — please add manually.`
        : ' Everything was picked up — check it over and press Save.';

      setMessage({
        type: (data.warnings || []).length ? 'warning' : 'success',
        text: `Imported "${file.name}" using ${engine}.${missing}`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Could not import that file. Please try again.',
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = ''; // allow re-uploading the same file
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (activeId) {
        await api.put(`/resumes/${activeId}`, form);
        setMessage({ type: 'success', text: 'Resume updated successfully.' });
      } else {
        const res = await api.post('/resumes', form);
        setActiveId(res.data.resume.id);
        setMessage({ type: 'success', text: 'Resume created successfully.' });
      }
      await loadResumes();
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save resume.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsNewVersion = async () => {
    if (!activeId) return handleSave();
    setSaving(true);
    try {
      // First save current edits, then duplicate as a new version
      await api.put(`/resumes/${activeId}`, form);
      const dup = await api.post(`/resumes/${activeId}/duplicate`);
      await loadResumes();
      setMessage({ type: 'success', text: `Saved as new version: "${dup.data.resume.title}"` });
      openResume(dup.data.resume.id);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create new version.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this resume permanently?')) return;
    await api.delete(`/resumes/${id}`);
    if (id === activeId) startNew();
    loadResumes();
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // ---- Repeater helpers ----
  const addItem = (field, item) => setForm((f) => ({ ...f, [field]: [...f[field], item] }));
  const updateItem = (field, index, item) =>
    setForm((f) => ({ ...f, [field]: f[field].map((it, i) => (i === index ? item : it)) }));
  const removeItem = (field, index) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== index) }));

  const addSkill = () => {
    if (skillInput.trim()) {
      addItem('skills', skillInput.trim());
      setSkillInput('');
    }
  };
  const addCert = () => {
    if (certInput.trim()) {
      addItem('certifications', certInput.trim());
      setCertInput('');
    }
  };

  if (loading) return <Layout title="Resume Builder"><Spinner /></Layout>;

  return (
    <Layout
      title="Resume Builder"
      subtitle="Build and manage your resumes with full version control."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={startNew}>+ New Blank Resume</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? 'Importing...' : '📤 Upload Resume'}
          </button>
          <button className="btn btn-secondary" onClick={handleSaveAsNewVersion} disabled={saving}>Save as New Version</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          {(activeId || resumes.length > 0) && (
            <button className="btn btn-primary" onClick={() => navigate('/search-jobs')}>Continue to Job Search →</button>
          )}
        </div>
      }
    >
      {message && <Alert type={message.type}>{message.text}</Alert>}

      {/* ---- Resume upload / import ---- */}
      <div
        className={`upload-area${dragOver ? ' drag-over' : ''}`}
        style={{ marginBottom: 20, padding: 24, cursor: importing ? 'wait' : 'pointer' }}
        onClick={() => !importing && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!importing) handleImport(e.dataTransfer.files[0]);
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>{importing ? '⏳' : '📄'}</div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {importing ? 'Reading your resume...' : 'Upload an existing resume'}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {importing
            ? 'Extracting your details — this takes a few seconds.'
            : 'Drag and drop a PDF, DOCX or TXT file here, or click to browse.'}
        </div>
        {!importing && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            We fill in the fields below automatically. Nothing is saved until you review and press Save.
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={(e) => handleImport(e.target.files[0])}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        {/* Resume list */}
        <Card title="Your Resumes">
          {resumes.length === 0 && <p className="page-subtitle">No resumes yet.</p>}
          {resumes.map((r) => (
            <div
              key={r.id}
              onClick={() => openResume(r.id)}
              style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                background: activeId === r.id ? 'var(--primary-light)' : 'transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
              }}
            >
              <span
                title={r.title}
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {r.title} <span style={{ color: 'var(--text-muted)' }}>v{r.version}</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                title="Delete this resume"
                style={{
                  flexShrink: 0, marginLeft: 8, background: '#fee2e2', color: '#b91c1c', border: 'none',
                  borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer',
                }}
              >🗑️</button>
            </div>
          ))}
        </Card>

        {/* Editing form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Design template picker + live preview */}
          <Card title="🎨 Design Template">
            <TemplatePicker
              value={form.template}
              onChange={(id) => update('template', id)}
            />
            <div style={{ fontWeight: 700, fontSize: 14, margin: '18px 0 10px' }}>🔤 Font</div>
            <FontPicker value={form.font} onChange={(id) => update('font', id)} />
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>👁️ Live Preview</span>
                <span className="form-hint" style={{ margin: 0 }}>
                  {activeId ? 'Reflects your last save. Press Save to refresh.' : 'Save to preview'}
                </span>
              </div>
              <div style={{ maxWidth: 440, margin: '0 auto' }}>
                <ResumePreview resumeId={activeId} template={form.template} font={form.font} refreshKey={previewKey} />
              </div>
            </div>
          </Card>

          <Card title="Resume Title & Personal Info">
            <div className="form-group">
              <label className="form-label">Resume Title (for your own reference)</label>
              <input className="form-input" value={form.title} onChange={(e) => update('title', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={(e) => update('location', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">LinkedIn / Portfolio URL</label>
              <input className="form-input" value={form.linkedin} onChange={(e) => update('linkedin', e.target.value)} />
            </div>
          </Card>

          <Card title="Professional Summary">
            <textarea
              className="form-textarea"
              value={form.summary}
              onChange={(e) => update('summary', e.target.value)}
              placeholder="2-4 sentences describing your experience and goals..."
            />
          </Card>

          <Card title="Work Experience">
            {form.experience.map((exp, i) => (
              <div className="repeater-item" key={i}>
                <button className="repeater-remove" onClick={() => removeItem('experience', i)}>Remove</button>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Job Title</label>
                    <input className="form-input" value={exp.title || ''} onChange={(e) => updateItem('experience', i, { ...exp, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input className="form-input" value={exp.company || ''} onChange={(e) => updateItem('experience', i, { ...exp, company: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input className="form-input" value={exp.startDate || ''} onChange={(e) => updateItem('experience', i, { ...exp, startDate: e.target.value })} placeholder="Jan 2023" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input className="form-input" value={exp.endDate || ''} onChange={(e) => updateItem('experience', i, { ...exp, endDate: e.target.value })} placeholder="Present" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Bullet Points (one per line)</label>
                  <textarea
                    className="form-textarea"
                    value={(exp.bullets || []).join('\n')}
                    onChange={(e) => updateItem('experience', i, { ...exp, bullets: e.target.value.split('\n') })}
                    placeholder="Developed a customer-facing dashboard used by 200+ staff..."
                  />
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => addItem('experience', { title: '', company: '', startDate: '', endDate: '', bullets: [''] })}>
              + Add Work Experience
            </button>
          </Card>

          <Card title="Education">
            {form.education.map((ed, i) => (
              <div className="repeater-item" key={i}>
                <button className="repeater-remove" onClick={() => removeItem('education', i)}>Remove</button>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Degree / Qualification</label>
                    <input className="form-input" value={ed.degree || ''} onChange={(e) => updateItem('education', i, { ...ed, degree: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Institution</label>
                    <input className="form-input" value={ed.institution || ''} onChange={(e) => updateItem('education', i, { ...ed, institution: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input className="form-input" value={ed.startDate || ''} onChange={(e) => updateItem('education', i, { ...ed, startDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input className="form-input" value={ed.endDate || ''} onChange={(e) => updateItem('education', i, { ...ed, endDate: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => addItem('education', { degree: '', institution: '', startDate: '', endDate: '' })}>
              + Add Education
            </button>
          </Card>

          <Card title="Skills">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="e.g. JavaScript, Project Management..."
              />
              <button className="btn btn-secondary" onClick={addSkill}>Add</button>
            </div>
            <div className="tag-list">
              {form.skills.map((s, i) => (
                <span className="tag" key={i}>
                  {typeof s === 'string' ? s : s.name}
                  <button onClick={() => removeItem('skills', i)}>✕</button>
                </span>
              ))}
            </div>
          </Card>

          <Card title="Projects">
            {form.projects.map((p, i) => (
              <div className="repeater-item" key={i}>
                <button className="repeater-remove" onClick={() => removeItem('projects', i)}>Remove</button>
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input className="form-input" value={p.name || ''} onChange={(e) => updateItem('projects', i, { ...p, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={p.description || ''} onChange={(e) => updateItem('projects', i, { ...p, description: e.target.value })} />
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => addItem('projects', { name: '', description: '' })}>
              + Add Project
            </button>
          </Card>

          <Card title="Certifications">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCert())}
                placeholder="e.g. AWS Certified Cloud Practitioner"
              />
              <button className="btn btn-secondary" onClick={addCert}>Add</button>
            </div>
            <div className="tag-list">
              {form.certifications.map((c, i) => (
                <span className="tag" key={i}>
                  {typeof c === 'string' ? c : c.name}
                  <button onClick={() => removeItem('certifications', i)}>✕</button>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function safeParse(field) {
  try {
    return typeof field === 'string' ? JSON.parse(field) : (field || []);
  } catch {
    return [];
  }
}
