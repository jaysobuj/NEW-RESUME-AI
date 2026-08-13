// TemplatePicker.jsx - Professional template selector with live thumbnails + descriptions.

import React, { useEffect, useState } from 'react';
import api from '../services/api';

function Thumb({ t }) {
  const a = t.accent;
  const bar = (w, c = '#cbd5e1', mt = 3) => (
    <div style={{ height: 3, width: w, background: c, borderRadius: 2, marginTop: mt }} />
  );

  if (t.layout === 'sidebar') {
    return (
      <div style={{ display: 'flex', height: '100%', background: '#fff' }}>
        <div style={{ width: '34%', background: a, padding: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,.5)', margin: '0 auto 6px' }} />
          {bar('80%', 'rgba(255,255,255,.6)')}{bar('60%', 'rgba(255,255,255,.6)')}{bar('70%', 'rgba(255,255,255,.6)')}
          <div style={{ marginTop: 10 }}>{bar('90%', 'rgba(255,255,255,.4)')}{bar('75%', 'rgba(255,255,255,.4)')}</div>
        </div>
        <div style={{ flex: 1, padding: 6 }}>
          {bar('70%', '#334155')}{bar('90%')}{bar('85%')}{bar('60%')}{bar('88%')}{bar('70%')}
        </div>
      </div>
    );
  }
  if (t.layout === 'creative') {
    return (
      <div style={{ height: '100%', background: '#fff' }}>
        <div style={{ background: a, height: 28, padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {bar('55%', 'rgba(255,255,255,.9)', 0)}
          {bar('35%', 'rgba(255,255,255,.5)', 4)}
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {['80%','60%','70%'].map((w,i) => <div key={i} style={{ height: 12, width: w, background: a, borderRadius: 20, opacity: 0.7 }} />)}
          </div>
          {bar('40%', a)}{bar('92%')}{bar('85%')}{bar('70%')}
        </div>
      </div>
    );
  }
  if (t.layout === 'compact') {
    return (
      <div style={{ height: '100%', background: '#fff', padding: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
          <div style={{ flex: 1 }}>{bar('60%', a, 0)}{bar('45%', '#334155')}</div>
          <div style={{ width: '32%' }}>{bar('100%', '#e2e8f0', 0)}{bar('80%', '#e2e8f0', 2)}</div>
        </div>
        <div style={{ height: 2, background: a, margin: '5px 0 4px', borderRadius: 1 }} />
        {bar('92%')}{bar('86%')}
        <div style={{ height: 2, background: '#111', margin: '6px 0 3px', opacity: 0.12 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>{bar('100%', '#cbd5e1', 0)}{bar('100%')}</div>
          <div style={{ flex: 1 }}>{bar('100%', '#cbd5e1', 0)}{bar('100%')}</div>
        </div>
      </div>
    );
  }
  if (t.layout === 'elegant') {
    return (
      <div style={{ height: '100%', background: '#fff', padding: 7 }}>
        <div style={{ borderTop: '1px solid #9ca3af', borderBottom: '1px solid #9ca3af', padding: '6px 0', marginBottom: 6, textAlign: 'center' }}>
          <div style={{ height: 4, width: '65%', margin: '0 auto', background: '#6b7280', borderRadius: 2 }} />
          <div style={{ height: 2, width: '38%', margin: '4px auto 0', background: '#d1d5db', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: '36%', borderRight: '1px solid #d1d5db', paddingRight: 5 }}>
            {bar('80%', '#6b7280', 0)}{bar('95%')}{bar('70%')}{bar('85%')}
          </div>
          <div style={{ flex: 1 }}>{bar('60%', '#6b7280', 0)}{bar('100%')}{bar('92%')}{bar('80%')}</div>
        </div>
      </div>
    );
  }
  if (t.layout === 'amber') {
    return (
      <div style={{ height: '100%', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: a, padding: '8px 7px' }}>
          {bar('60%', 'rgba(0,0,0,.65)', 0)}{bar('38%', 'rgba(0,0,0,.4)', 3)}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: 7, flex: 1 }}>
          <div style={{ width: '38%', borderRight: '1px solid #e5e7eb', paddingRight: 5 }}>
            {bar('75%', a, 0)}{bar('95%')}{bar('85%')}{bar('70%')}
          </div>
          <div style={{ flex: 1 }}>{bar('55%', a, 0)}{bar('100%')}{bar('90%')}{bar('80%')}</div>
        </div>
        <div style={{ height: 5, background: a }} />
      </div>
    );
  }
  if (t.layout === 'slate') {
    return (
      <div style={{ height: '100%', background: '#fff' }}>
        <div style={{ background: '#1f2937', padding: '8px 7px' }}>
          {bar('55%', '#fff', 0)}{bar('35%', t.accent, 3)}
        </div>
        <div style={{ display: 'flex', height: 'calc(100% - 32px)' }}>
          <div style={{ flex: 1, padding: 7 }}>{bar('50%', '#334155', 0)}{bar('100%')}{bar('92%')}{bar('84%')}</div>
          <div style={{ width: '38%', padding: 7, background: '#f1f5f9' }}>
            {bar('80%', '#334155', 0)}{bar('90%')}{bar('70%')}{bar('85%')}
          </div>
        </div>
      </div>
    );
  }
  // single column (modern, professional, classic, executive)
  return (
    <div style={{ height: '100%', background: '#fff', padding: 7 }}>
      <div style={{ textAlign: t.id === 'classic' ? 'center' : 'left' }}>
        <div style={{ height: 5, width: t.id === 'classic' ? '55%' : '60%', background: a, borderRadius: 2, margin: t.id === 'classic' ? '0 auto' : 0 }} />
        <div style={{ height: 2, width: t.id === 'classic' ? '38%' : '42%', background: '#cbd5e1', borderRadius: 2, marginTop: 4, marginLeft: t.id === 'classic' ? 'auto' : 0, marginRight: t.id === 'classic' ? 'auto' : 0 }} />
      </div>
      <div style={{ borderBottom: `2px solid ${a}`, margin: '6px 0 5px' }} />
      {bar('88%')}{bar('82%')}
      <div style={{ height: 3, width: '38%', background: a, borderRadius: 2, marginTop: 8 }} />
      {bar('90%')}{bar('78%')}{bar('84%')}
      <div style={{ height: 3, width: '32%', background: a, borderRadius: 2, marginTop: 8 }} />
      {bar('85%')}
    </div>
  );
}

export default function TemplatePicker({ value, onChange }) {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  if (!templates.length) return null;

  const featured = templates.filter(t => t.featured);
  const others   = templates.filter(t => !t.featured);

  const renderCard = (t) => {
    const active = value === t.id;
    return (
      <div
        key={t.id}
        onClick={() => onChange(t.id)}
        title={t.description}
        style={{
          border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          background: 'var(--surface)',
          boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.18)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'all 0.15s',
          position: 'relative',
        }}
      >
        {/* Thumbnail */}
        <div style={{ height: 130, borderBottom: '1px solid var(--border)', position: 'relative' }}>
          <Thumb t={t} />
          {active && (
            <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              ✓
            </div>
          )}
        </div>
        {/* Info */}
        <div style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            {/* Accent swatch */}
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.accent, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.4 }}>{t.description}</p>
          <div>
            {t.atsSafe
              ? <span className="badge badge-green" style={{ fontSize: 10 }}>✓ ATS-safe</span>
              : <span className="badge badge-yellow" style={{ fontSize: 10 }}>⚠ Designer · ATS risk</span>}
          </div>
        </div>
      </div>
    );
  };

  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '4px 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        ⭐ Recommended
      </div>
      <div style={gridStyle}>{featured.map(renderCard)}</div>

      {others.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            All templates
          </div>
          <div style={gridStyle}>{others.map(renderCard)}</div>
        </>
      )}

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text)' }}>ATS-safe</strong> designs use single columns that parse cleanly in applicant-tracking systems.
        {' '}<strong style={{ color: 'var(--text)' }}>Designer</strong> designs look richer but may not parse perfectly — ideal for networking, referrals, or alongside a plain-text copy.
      </div>
    </div>
  );
}
