// ResumePreview.jsx - Live A4 preview of the resume in the chosen template.
//
// It renders the SAME HTML the backend uses to produce the PDF (fetched
// from /export/:id/preview), injected into a sandboxed <iframe> via
// srcDoc. So the preview is a faithful representation of the download —
// no separate client-side renderer to drift out of sync.
//
// `refreshKey` lets the parent force a re-fetch (e.g. after saving edits).

import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Spinner } from './UI';

export default function ResumePreview({ resumeId, template, font, refreshKey }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resumeId) { setHtml(''); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getPreviewHtml(resumeId, template, font)
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch(() => { if (!cancelled) setError('Could not load preview.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resumeId, template, font, refreshKey]);

  if (!resumeId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>👁️</div>
        Save this resume to see a live preview.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', zIndex: 2 }}><Spinner label="Rendering preview..." /></div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{
        // A4 aspect ratio, scaled to fit the panel width.
        width: '100%',
        aspectRatio: '210 / 297',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: 'var(--shadow)',
      }}>
        <iframe
          title="Resume preview"
          srcDoc={html}
          sandbox=""
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
        />
      </div>
    </div>
  );
}
