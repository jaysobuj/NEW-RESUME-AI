// UI.jsx - Reusable components used across all pages
// Keeping them here means changing the style once updates everywhere

import React from 'react';

// Card - white box with optional title
export function Card({ title, children, className = '', style = {} }) {
  return (
    <div className={`card animate-in ${className}`} style={style}>
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  );
}

// Coloured status badge
export function Badge({ status }) {
  const colours = {
    Saved: 'badge-gray', Applied: 'badge-blue',
    Interview: 'badge-yellow', Offer: 'badge-green', Rejected: 'badge-red',
  };
  return <span className={`badge ${colours[status] || 'badge-gray'}`}>{status}</span>;
}

// Alert box - error, success, info, warning
export function Alert({ type = 'info', children, style = {} }) {
  const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' };
  return (
    <div className={`alert alert-${type}`} style={style}>
      <span>{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

// Spinning loading indicator
export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

// Circular score display (e.g. 87/100)
export function ScoreRing({ score }) {
  const colour = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const deg = `${(score / 100) * 360}deg`;
  return (
    <div className="score-ring" style={{ '--score-color': colour, '--score-deg': deg }}>
      <div className="score-ring-inner">
        <span className="score-value">{score}</span>
        <span className="score-max">/100</span>
      </div>
    </div>
  );
}

// Horizontal progress bar
export function ProgressBar({ value, max = 100, colour }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${pct}%`, background: colour || undefined }}
      />
    </div>
  );
}

// Gradient top banner for pages
export function GradientBanner({ title, subtitle, icon }) {
  return (
    <div className="gradient-banner">
      <h2>{icon && <span style={{ marginRight: 8 }}>{icon}</span>}{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
