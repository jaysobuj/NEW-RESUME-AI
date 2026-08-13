// FontPicker.jsx - Choose a body font, independent of the chosen template.
// value = null means "use the template's own default font".

import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function FontPicker({ value, onChange }) {
  const [fonts, setFonts] = useState([]);

  useEffect(() => {
    api.getFonts().then(setFonts).catch(() => setFonts([]));
  }, []);

  if (!fonts.length) return null;

  const card = (id, name, description, stack) => {
    const active = value === id;
    return (
      <div
        key={id || 'default'}
        onClick={() => onChange(id)}
        title={description}
        style={{
          border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '10px 12px',
          cursor: 'pointer',
          background: 'var(--surface)',
          boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.18)' : 'none',
          minWidth: 130,
        }}
      >
        <div style={{ fontFamily: stack, fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Aa</div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {card(null, 'Template Default', "Uses each template's own designed font.", "'Segoe UI', Roboto, Helvetica, Arial, sans-serif")}
      {fonts.map(f => card(f.id, f.name, f.description, f.stack))}
    </div>
  );
}
