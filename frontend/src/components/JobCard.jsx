// JobCard.jsx - A single job recommendation card.
// Shared by the Job Matches page (and reusable by a future full job
// search page, per the provider-interface design in the backend).

import React from 'react';

function formatSalary(job) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const fmt = (n) => `$${Math.round(n / 1000)}k`;
  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)} ${job.currency}`;
  return `${fmt(job.salaryMin || job.salaryMax)} ${job.currency}`;
}

export default function JobCard({ recommendation, onApply, onSelect, onView, selected = false }) {
  const { job, matchScore, matchedSkills, missingSkills, reason } = recommendation;
  const scoreColour = matchScore == null ? '#94a3b8' : matchScore >= 75 ? '#10b981' : matchScore >= 50 ? '#f59e0b' : '#94a3b8';
  const salary = formatSalary(job);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: selected ? '2px solid #10b981' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            🏢 {job.company} &nbsp;·&nbsp; 📍 {job.location} &nbsp;·&nbsp; {job.workMode}
          </div>
        </div>
        {matchScore != null && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: scoreColour, lineHeight: 1 }}>{matchScore}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>match</div>
          </div>
        )}
      </div>

      {salary && (
        <div style={{ fontSize: 13, fontWeight: 600 }}>💰 {salary} &nbsp;·&nbsp; {job.jobType}{job.experienceLevel ? ` · ${job.experienceLevel}` : ''}</div>
      )}

      {reason && <div style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>💡 {reason}</div>}

      {matchedSkills.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>MATCHED SKILLS</div>
          <div className="tag-list">
            {matchedSkills.map(s => <span className="tag" key={s}>{s}</span>)}
          </div>
        </div>
      )}

      {missingSkills.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>WORTH LEARNING</div>
          <div className="tag-list">
            {missingSkills.map(s => (
              <span key={s} className="badge badge-gray" style={{ fontSize: 11 }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        {onView && <button className="btn btn-secondary btn-sm" onClick={() => onView(job)}>👁️ View</button>}
        {onApply && <button className="btn btn-secondary btn-sm" onClick={() => onApply(job)}>➕ Save / Track</button>}
        {onSelect && (
          <button className="btn btn-primary btn-sm" onClick={() => onSelect(job)} disabled={selected}>
            {selected ? '✓ Selected' : '🎯 Select Job'}
          </button>
        )}
      </div>
    </div>
  );
}
