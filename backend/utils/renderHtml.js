// ==========================================================
// renderHtml.js
// Turns a resume record + a template id into a complete, self-contained
// HTML document (inline CSS, no external assets).
//
// This ONE function is the shared source of truth for:
//   - the PDF export      (renderResumeHtml -> htmlToPdf)
//   - the HTML export      (downloaded .html file)
//   - the live preview      (served inline into an <iframe> in the builder)
//
// Because the preview and the PDF come from the exact same HTML, what
// the user sees in the builder is what they download — no drift.
//
// The JSON fields (education/experience/...) are stored as strings, so
// we reuse the same tolerant parse the rest of the app uses.
// ==========================================================

const { getTemplate, getFontStack } = require('./templates');

function parseField(field) {
  try {
    return typeof field === 'string' ? JSON.parse(field) : (field || []);
  } catch {
    return [];
  }
}

// Escape everything that comes from user data before it hits the HTML.
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Normalise a resume record into a plain, escaped, render-ready shape.
function prepare(resume) {
  const skills = parseField(resume.skills).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  const certifications = parseField(resume.certifications).map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean);
  const education = parseField(resume.education);
  const experience = parseField(resume.experience);
  const projects = parseField(resume.projects);

  const contact = [resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean);

  return {
    name: resume.full_name || 'Your Name',
    // Several designs show a professional title under the name. There is no
    // dedicated title field, so we use the most recent job title from the
    // user's own experience — derived, never invented.
    role: experience[0]?.title || '',
    email: resume.email || '',
    phone: resume.phone || '',
    location: resume.location || '',
    linkedin: resume.linkedin || '',
    contact,
    summary: resume.summary || '',
    skills,
    certifications,
    education,
    experience,
    projects,
    initials: (resume.full_name || 'Y N').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
  };
}

// ---- Section builders (return HTML strings) ----

function experienceHtml(items) {
  if (!items.length) return '';
  const rows = items.map(exp => `
    <div class="entry">
      <div class="entry-head">
        <span class="entry-title">${esc(exp.title || '')}${exp.company ? ` <span class="entry-org">— ${esc(exp.company)}</span>` : ''}</span>
        <span class="entry-dates">${esc(exp.startDate || '')}${exp.startDate || exp.endDate ? ' – ' : ''}${esc(exp.endDate || 'Present')}</span>
      </div>
      ${(exp.bullets || []).filter(Boolean).length
        ? `<ul>${(exp.bullets || []).filter(Boolean).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
        : ''}
    </div>`).join('');
  return section('Experience', rows);
}

function educationHtml(items) {
  if (!items.length) return '';
  const rows = items.map(ed => `
    <div class="entry">
      <div class="entry-head">
        <span class="entry-title">${esc(ed.degree || '')}${ed.institution ? ` <span class="entry-org">— ${esc(ed.institution)}</span>` : ''}</span>
        <span class="entry-dates">${esc(ed.startDate || '')}${ed.startDate || ed.endDate ? ' – ' : ''}${esc(ed.endDate || '')}</span>
      </div>
    </div>`).join('');
  return section('Education', rows);
}

function projectsHtml(items) {
  if (!items.length) return '';
  const rows = items.map(p => `
    <div class="entry">
      <div class="entry-title">${esc(p.name || '')}</div>
      ${p.description ? `<div class="entry-desc">${esc(p.description)}</div>` : ''}
    </div>`).join('');
  return section('Projects', rows);
}

function summaryHtml(summary) {
  if (!summary) return '';
  return section('Summary', `<p class="summary">${esc(summary)}</p>`);
}

// Skills rendered inline (ATS templates) or as pills (designer templates).
function skillsHtml(skills, { pills = false } = {}) {
  if (!skills.length) return '';
  const body = pills
    ? `<div class="pills">${skills.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>`
    : `<p class="inline-list">${skills.map(esc).join(' &nbsp;•&nbsp; ')}</p>`;
  return section('Skills', body);
}

function certsHtml(certs) {
  if (!certs.length) return '';
  return section('Certifications', `<p class="inline-list">${certs.map(esc).join(' &nbsp;•&nbsp; ')}</p>`);
}

// The empty <i class="hb"> is the "header badge" the Elegant template draws a
// circle behind. Every other template leaves .hb unstyled, so it collapses to
// nothing — one markup shape works for all designs.
function section(title, inner) {
  return `<section><h2><i class="hb"></i>${esc(title)}</h2>${inner}</section>`;
}

// Contact details as icon-prefixed lines (used by the sidebar-style designs).
function contactLinesHtml(d) {
  return [
    d.email && `<div>✉ ${esc(d.email)}</div>`,
    d.phone && `<div>☎ ${esc(d.phone)}</div>`,
    d.location && `<div>⚲ ${esc(d.location)}</div>`,
    d.linkedin && `<div>🔗 ${esc(d.linkedin)}</div>`,
  ].filter(Boolean).join('');
}

// Splits a full name so the first word can be styled separately.
function splitName(name) {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return { first: name, last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// ==========================================================
// Per-template CSS. Only typography, colour and layout vary — the
// content markup is identical, which is what keeps every template
// truthful to the same data.
// ==========================================================
function css(t, fontOverride) {
  const serif = "Georgia, 'Times New Roman', Times, serif";
  const sans = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const bodyFont = fontOverride ? getFontStack(fontOverride) : (t.font === 'serif' ? serif : sans);
  const accent = t.accent;

  const base = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ${bodyFont}; color: #1a1a1a; font-size: 10.6pt; line-height: 1.5; }
    .page { padding: 40px 46px; }
    h1 { font-size: 23pt; margin: 0 0 2px; letter-spacing: .2px; }
    h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 8px; }
    section { margin-bottom: 16px; }
    p { margin: 0 0 6px; }
    ul { margin: 4px 0 0; padding-left: 18px; }
    li { margin-bottom: 3px; }
    .contact { font-size: 9.6pt; color: #444; margin-bottom: 4px; }
    .entry { margin-bottom: 10px; }
    .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .entry-title { font-weight: 700; }
    .entry-org { font-weight: 600; color: ${accent}; }
    .entry-dates { font-size: 9pt; color: #666; white-space: nowrap; }
    .entry-desc { font-size: 10pt; }
    .inline-list { font-size: 10pt; }
    .summary { text-align: left; }
    /* In a narrow sidebar there isn't room to float dates opposite a title —
       stack them instead, or long degree names wrap into a ragged column. */
    .narrow .entry-head { display: block; }
    .narrow .entry-dates { display: block; margin-top: 1px; }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { background: ${hexA(accent, 0.12)}; color: ${accent}; border-radius: 20px; padding: 3px 11px; font-size: 9pt; font-weight: 600; }
    @page { size: A4; margin: 0; }
  `;

  // Layout-specific styling
  if (t.layout === 'sidebar') {
    return base + `
      .page { display: flex; padding: 0; min-height: 100vh; }
      .side { width: 33%; background: ${accent}; color: #fff; padding: 34px 24px; }
      .side .avatar { width: 92px; height: 92px; border-radius: 50%; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 30pt; font-weight: 700; margin: 0 auto 18px; }
      .side h2 { color: #fff; border-bottom: 1px solid rgba(255,255,255,.35); padding-bottom: 5px; }
      .side .contact, .side .inline-list, .side li { color: rgba(255,255,255,.92); font-size: 9.4pt; }
      .side .contact div { margin-bottom: 5px; word-break: break-word; }
      .side .pill { background: rgba(255,255,255,.18); color: #fff; }
      .main { width: 67%; padding: 36px 34px; }
      .main h1 { color: #1a1a1a; }
      .main h2 { color: ${accent}; border-bottom: 2px solid ${hexA(accent, 0.35)}; padding-bottom: 4px; }
      .role { font-size: 11pt; color: ${accent}; font-weight: 600; margin-bottom: 14px; }
    `;
  }

  if (t.layout === 'creative') {
    return base + `
      .page { padding: 0; }
      .banner { background: ${accent}; color: #fff; padding: 34px 46px; }
      .banner h1 { color: #fff; }
      .banner .contact { color: rgba(255,255,255,.9); }
      .body { padding: 28px 46px; }
      h2 { color: ${accent}; display: flex; align-items: center; gap: 8px; }
      h2::before { content: ''; width: 16px; height: 3px; background: ${accent}; display: inline-block; }
      .entry-org { color: ${accent}; }
    `;
  }

  // Dense single column, blue headings, two-column skills grid (ATS-safe).
  if (t.layout === 'compact') {
    return base + `
      .page { padding: 34px 42px; }
      body { font-size: 10.2pt; line-height: 1.42; }
      header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 14px; }
      h1 { font-size: 21pt; line-height: 1.1; }
      h1 .fn { color: ${accent}; display: block; font-weight: 400; }
      h1 .ln { display: block; font-weight: 800; }
      .role-sub { font-size: 9.5pt; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; margin-top: 3px; }
      .contact-right { text-align: right; font-size: 9.2pt; color: #444; line-height: 1.6; }
      h2 { color: ${accent}; font-size: 11.5pt; border-bottom: 2px solid #111; padding-bottom: 3px; margin-bottom: 7px; }
      .entry-org { color: #111; font-weight: 600; }
      .skill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; font-size: 10pt; }
    `;
  }

  // Refined monochrome, centred letter-spaced name, two-column body.
  if (t.layout === 'elegant') {
    return base + `
      .page { padding: 40px 46px; }
      body { color: #333; }
      header { text-align: center; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; padding: 22px 0 18px; margin-bottom: 20px; }
      h1 { font-size: 27pt; font-weight: 300; letter-spacing: .22em; text-transform: uppercase; color: #374151; }
      .role-sub { font-size: 12pt; letter-spacing: .3em; text-transform: uppercase; color: #6b7280; margin-top: 8px; }
      .cols { display: flex; gap: 26px; }
      .col-l { width: 34%; border-right: 1px solid #d1d5db; padding-right: 22px; }
      .col-r { width: 66%; }
      h2 {
        position: relative; z-index: 0;
        font-size: 12.5pt; font-weight: 700; letter-spacing: .18em;
        color: #374151; padding-left: 9px; margin-bottom: 10px;
      }
      h2 .hb {
        position: absolute; z-index: -1; left: 0; top: 50%; transform: translateY(-50%);
        width: 21px; height: 21px; border-radius: 50%; background: #e5e7eb;
      }
      .entry-org { color: #4b5563; }
      .entry-title { font-weight: 600; }
      .contact-lines div { margin-bottom: 6px; font-size: 9.6pt; word-break: break-word; }
      .col-l li, .col-l .inline-list { font-size: 9.8pt; }
      ul { padding-left: 15px; }
    `;
  }

  // Warm accent blocks with a left sidebar.
  if (t.layout === 'amber') {
    return base + `
      .page { padding: 0; }
      .banner { background: ${accent}; padding: 26px 40px; }
      .banner h1 { font-size: 24pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #1f2937; }
      .banner .role-sub { font-size: 10.5pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #422006; margin-top: 4px; }
      .cols { display: flex; gap: 0; }
      .col-l { width: 36%; padding: 24px 20px 24px 40px; border-right: 1px solid #e5e7eb; }
      .col-r { width: 64%; padding: 24px 40px 24px 24px; }
      h2 {
        font-size: 11.5pt; color: #1f2937; display: flex; align-items: center; gap: 8px;
        letter-spacing: .1em; margin-bottom: 9px;
      }
      h2::before { content: ''; width: 13px; height: 13px; border-radius: 50%; background: ${accent}; flex-shrink: 0; }
      .entry-org { color: #92400e; }
      .contact-lines div { margin-bottom: 6px; font-size: 9.6pt; word-break: break-word; }
      .skill-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 9.8pt; }
      .skill-row::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: ${accent}; flex-shrink: 0; }
      .footbar { height: 22px; background: ${accent}; margin-top: 26px; }
      .col-l li { font-size: 9.8pt; }
    `;
  }

  // Dark header band, main column left, sidebar right.
  if (t.layout === 'slate') {
    return base + `
      .page { padding: 0; }
      .banner { background: #1f2937; padding: 26px 40px; }
      .banner h1 { font-size: 25pt; font-weight: 800; color: #fff; }
      .banner .role-sub { font-size: 13pt; font-weight: 700; color: ${accent}; margin-top: 3px; }
      .banner .contact { color: rgba(255,255,255,.8); font-size: 9.4pt; margin-top: 10px; }
      .cols { display: flex; gap: 0; }
      .col-l { width: 62%; padding: 24px 22px 24px 40px; }
      .col-r { width: 38%; padding: 24px 40px 24px 22px; background: #f8f9fb; }
      h2 { font-size: 11.5pt; color: #1f2937; border-bottom: 2px solid #1f2937; padding-bottom: 3px; margin-bottom: 9px; }
      .entry-org { color: ${accent}; }
      .col-r li, .col-r .inline-list { font-size: 9.8pt; }
      ul { padding-left: 16px; }
    `;
  }

  // Single-column variants (modern / professional / classic / executive)
  const centeredHeader = (t.id === 'classic');
  const ruled = (t.id === 'professional');
  const wide = (t.id === 'executive');

  return base + `
    ${wide ? '.page { padding: 52px 66px; line-height: 1.6; }' : ''}
    header { ${centeredHeader ? 'text-align: center;' : ''} margin-bottom: 14px; ${ruled ? `border-bottom: 3px solid ${accent}; padding-bottom: 10px;` : ''} }
    h1 { color: ${t.id === 'classic' ? '#111' : accent}; }
    h2 {
      color: ${accent};
      ${ruled ? `border-bottom: 1.5px solid ${accent};` : `border-bottom: 1px solid #d9d9d9;`}
      padding-bottom: 4px;
    }
    ${centeredHeader ? 'h2 { text-align: center; border-bottom: none; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 4px 0; }' : ''}
  `;
}

// Blend a hex colour with white at the given alpha (for tints without rgba parsing surprises in print).
function hexA(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================================
// Layout assemblers
// ==========================================================
function singleColumn(d) {
  return `
    <div class="page">
      <header>
        <h1>${esc(d.name)}</h1>
        <div class="contact">${d.contact.map(esc).join(' &nbsp;|&nbsp; ')}</div>
      </header>
      ${summaryHtml(d.summary)}
      ${experienceHtml(d.experience)}
      ${educationHtml(d.education)}
      ${skillsHtml(d.skills)}
      ${projectsHtml(d.projects)}
      ${certsHtml(d.certifications)}
    </div>`;
}

function sidebarLayout(d) {
  return `
    <div class="page">
      <aside class="side">
        <div class="avatar">${esc(d.initials)}</div>
        ${section('Contact', `<div class="contact">${contactLinesHtml(d)}</div>`)}
        ${d.skills.length ? section('Skills', `<div class="pills">${d.skills.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>`) : ''}
        ${d.certifications.length ? section('Certifications', `<ul>${d.certifications.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`) : ''}
      </aside>
      <main class="main">
        <h1>${esc(d.name)}</h1>
        ${d.role ? `<div class="role">${esc(d.role)}</div>` : ''}
        ${summaryHtml(d.summary)}
        ${experienceHtml(d.experience)}
        ${educationHtml(d.education)}
        ${projectsHtml(d.projects)}
      </main>
    </div>`;
}

// Dense single column: name split across two lines, contact right-aligned,
// skills in a two-column text grid. Stays linear, so it remains ATS-safe.
function compactLayout(d) {
  const { first, last } = splitName(d.name);
  return `
    <div class="page">
      <header>
        <div>
          <h1><span class="fn">${esc(first)}</span><span class="ln">${esc(last)}</span></h1>
          ${d.role ? `<div class="role-sub">${esc(d.role)}</div>` : ''}
        </div>
        <div class="contact-right">
          ${[d.email, d.phone, d.linkedin, d.location].filter(Boolean).map(x => `<div>${esc(x)}</div>`).join('')}
        </div>
      </header>
      ${summaryHtml(d.summary)}
      ${experienceHtml(d.experience)}
      ${educationHtml(d.education)}
      ${d.skills.length ? section('Skills', `<div class="skill-grid">${d.skills.map(s => `<div>${esc(s)}</div>`).join('')}</div>`) : ''}
      ${projectsHtml(d.projects)}
      ${certsHtml(d.certifications)}
    </div>`;
}

function elegantLayout(d) {
  return `
    <div class="page">
      <header>
        <h1>${esc(d.name)}</h1>
        ${d.role ? `<div class="role-sub">${esc(d.role)}</div>` : ''}
      </header>
      <div class="cols">
        <div class="col-l narrow">
          ${section('Contact', `<div class="contact-lines">${contactLinesHtml(d)}</div>`)}
          ${educationHtml(d.education)}
          ${d.skills.length ? section('Skills', `<ul>${d.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`) : ''}
          ${certsHtml(d.certifications)}
        </div>
        <div class="col-r">
          ${d.summary ? section('Profile Summary', `<p class="summary">${esc(d.summary)}</p>`) : ''}
          ${experienceHtml(d.experience)}
          ${projectsHtml(d.projects)}
        </div>
      </div>
    </div>`;
}

function amberLayout(d) {
  return `
    <div class="page">
      <div class="banner">
        <h1>${esc(d.name)}</h1>
        ${d.role ? `<div class="role-sub">${esc(d.role)}</div>` : ''}
      </div>
      <div class="cols">
        <div class="col-l narrow">
          ${d.summary ? section('About Me', `<p class="summary">${esc(d.summary)}</p>`) : ''}
          ${section('Contact', `<div class="contact-lines">${contactLinesHtml(d)}</div>`)}
          ${d.skills.length ? section('Skills', d.skills.map(s => `<div class="skill-row">${esc(s)}</div>`).join('')) : ''}
          ${educationHtml(d.education)}
        </div>
        <div class="col-r">
          ${experienceHtml(d.experience)}
          ${projectsHtml(d.projects)}
          ${certsHtml(d.certifications)}
        </div>
      </div>
      <div class="footbar"></div>
    </div>`;
}

function slateLayout(d) {
  return `
    <div class="page">
      <div class="banner">
        <h1>${esc(d.name)}</h1>
        ${d.role ? `<div class="role-sub">${esc(d.role)}</div>` : ''}
        <div class="contact">${d.contact.map(esc).join(' &nbsp;·&nbsp; ')}</div>
      </div>
      <div class="cols">
        <div class="col-l">
          ${d.summary ? section('Summary', `<p class="summary">${esc(d.summary)}</p>`) : ''}
          ${experienceHtml(d.experience)}
          ${projectsHtml(d.projects)}
        </div>
        <div class="col-r narrow">
          ${educationHtml(d.education)}
          ${d.skills.length ? section('Skills', `<ul>${d.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`) : ''}
          ${certsHtml(d.certifications)}
        </div>
      </div>
    </div>`;
}

function creativeLayout(d) {
  return `
    <div class="page">
      <div class="banner">
        <h1>${esc(d.name)}</h1>
        <div class="contact">${d.contact.map(esc).join(' &nbsp;|&nbsp; ')}</div>
      </div>
      <div class="body">
        ${summaryHtml(d.summary)}
        ${experienceHtml(d.experience)}
        ${skillsHtml(d.skills, { pills: true })}
        ${educationHtml(d.education)}
        ${projectsHtml(d.projects)}
        ${certsHtml(d.certifications)}
      </div>
    </div>`;
}

// ==========================================================
// Public entry point
// ==========================================================
function renderResumeHtml(resume, templateId, fontOverride) {
  const t = getTemplate(templateId);
  const d = prepare(resume);

  let bodyHtml;
  if (t.layout === 'sidebar') bodyHtml = sidebarLayout(d);
  else if (t.layout === 'creative') bodyHtml = creativeLayout(d);
  else if (t.layout === 'compact') bodyHtml = compactLayout(d);
  else if (t.layout === 'elegant') bodyHtml = elegantLayout(d);
  else if (t.layout === 'amber') bodyHtml = amberLayout(d);
  else if (t.layout === 'slate') bodyHtml = slateLayout(d);
  else bodyHtml = singleColumn(d);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)} — Resume</title>
<style>${css(t, fontOverride)}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

module.exports = { renderResumeHtml, prepare, esc };
