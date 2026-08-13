// WorkflowProgress.jsx - compact step tracker for the guided workflow:
// Resume -> Job Selected -> Tailored -> ATS -> Exported -> Tracking.
// Self-fetching so it can be dropped into any page (Dashboard, Tailor,
// ATS, Export) without prop drilling.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export function useWorkflowStatus() {
  const [status, setStatus] = useState(null);

  const load = () => {
    Promise.all([
      api.get('/resumes'),
      api.get('/workflow'),
      api.get('/applications').catch(() => ({ data: { applications: [] } })),
    ]).then(([resumesRes, workflowRes, appsRes]) => {
      const resumes = resumesRes.data.resumes;
      const workflow = workflowRes.data;
      const tailoredResume = workflow.tailored_resume_id
        ? resumes.find(r => r.id === workflow.tailored_resume_id)
        : null;
      const tracked = workflow.selected_job
        ? appsRes.data.applications.find(a => a.job_id === workflow.selected_job.id)
        : null;
      setStatus({
        hasResume: resumes.length > 0,
        resumeCount: resumes.length,
        selectedJob: workflow.selected_job,
        tailoredResume,
        exported: !!workflow.exported,
        tracked: !!tracked,
        trackedApp: tracked,
      });
    });
  };

  useEffect(load, []);
  return [status, load];
}

const STEPS = [
  { key: 'resume',   label: 'Resume',   to: '/resume-builder' },
  { key: 'job',       label: 'Job Selected', to: '/search-jobs' },
  { key: 'tailored',  label: 'Tailored', to: '/ai-tailoring' },
  { key: 'ats',       label: 'ATS',      to: '/ats-scan' },
  { key: 'exported',  label: 'Exported', to: '/export' },
  { key: 'tracking',  label: 'Tracking', to: '/applications' },
];

export default function WorkflowProgress({ status, atsScored }) {
  if (!status) return null;
  const done = {
    resume: status.hasResume,
    job: !!status.selectedJob,
    tailored: !!status.tailoredResume,
    ats: !!atsScored,
    exported: status.exported,
    tracking: status.tracked,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <Link to={step.to} style={{ textDecoration: 'none' }}>
            <span
              className="chip"
              style={{
                background: done[step.key] ? '#10b98122' : 'var(--bg)',
                color: done[step.key] ? '#10b981' : 'var(--text-muted)',
                border: `1px solid ${done[step.key] ? '#10b98155' : 'var(--border)'}`,
                fontWeight: done[step.key] ? 700 : 500,
              }}
            >
              {done[step.key] ? '✓ ' : ''}{step.label}
            </span>
          </Link>
          {i < STEPS.length - 1 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
