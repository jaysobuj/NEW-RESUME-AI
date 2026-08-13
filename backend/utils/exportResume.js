// ==========================================================
// exportResume.js
// Generates a clean, ATS-friendly PDF (using pdfkit) and DOCX
// (using the "docx" npm library) from resume data.
//
// ATS-friendly formatting rules we follow:
// - Single column layout (no tables/columns that confuse ATS parsers)
// - Standard fonts, no images/icons
// - Clear section headings in plain text
// - No headers/footers containing important info
// ==========================================================

const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

function parseField(field) {
  try {
    return typeof field === 'string' ? JSON.parse(field) : (field || []);
  } catch {
    return [];
  }
}

// Returns a Node.js Readable stream (pipe this directly into the HTTP response)
function generatePDF(resume) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  const skills = parseField(resume.skills);
  const education = parseField(resume.education);
  const experience = parseField(resume.experience);
  const projects = parseField(resume.projects);
  const certifications = parseField(resume.certifications);

  // Header
  doc.font('Helvetica-Bold').fontSize(20).text(resume.full_name || 'Your Name');
  doc.font('Helvetica').fontSize(10).text(
    [resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean).join(' | ')
  );
  doc.moveDown();

  const sectionHeading = (text) => {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a1a1a').text(text.toUpperCase());
    doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10.5).fillColor('#000000');
  };

  if (resume.summary) {
    sectionHeading('Professional Summary');
    doc.text(resume.summary);
  }

  if (experience.length > 0) {
    sectionHeading('Work Experience');
    experience.forEach(exp => {
      doc.font('Helvetica-Bold').text(`${exp.title || ''}${exp.company ? ' — ' + exp.company : ''}`);
      doc.font('Helvetica-Oblique').fontSize(9.5).text(`${exp.startDate || ''} - ${exp.endDate || 'Present'}`);
      doc.font('Helvetica').fontSize(10.5);
      (exp.bullets || []).forEach(b => doc.text(`• ${b}`));
      doc.moveDown(0.4);
    });
  }

  if (education.length > 0) {
    sectionHeading('Education');
    education.forEach(ed => {
      doc.font('Helvetica-Bold').text(`${ed.degree || ''}${ed.institution ? ' — ' + ed.institution : ''}`);
      doc.font('Helvetica').fontSize(9.5).text(`${ed.startDate || ''} - ${ed.endDate || ''}`);
      doc.moveDown(0.2);
    });
  }

  if (skills.length > 0) {
    sectionHeading('Skills');
    const skillNames = skills.map(s => (typeof s === 'string' ? s : s.name)).join(', ');
    doc.fontSize(10.5).text(skillNames);
  }

  if (projects.length > 0) {
    sectionHeading('Projects');
    projects.forEach(p => {
      doc.font('Helvetica-Bold').text(p.name || '');
      doc.font('Helvetica').text(p.description || '');
      doc.moveDown(0.2);
    });
  }

  if (certifications.length > 0) {
    sectionHeading('Certifications');
    const certNames = certifications.map(c => (typeof c === 'string' ? c : c.name)).join(', ');
    doc.fontSize(10.5).text(certNames);
  }

  doc.end();
  return doc;
}

async function generateDOCX(resume) {
  const skills = parseField(resume.skills);
  const education = parseField(resume.education);
  const experience = parseField(resume.experience);
  const projects = parseField(resume.projects);
  const certifications = parseField(resume.certifications);

  const children = [];

  children.push(new Paragraph({ text: resume.full_name || 'Your Name', heading: HeadingLevel.TITLE }));
  children.push(new Paragraph({
    children: [new TextRun([resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean).join(' | '))],
  }));

  const addHeading = (text) => children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));

  if (resume.summary) {
    addHeading('Professional Summary');
    children.push(new Paragraph(resume.summary));
  }

  if (experience.length > 0) {
    addHeading('Work Experience');
    experience.forEach(exp => {
      children.push(new Paragraph({ children: [new TextRun({ text: `${exp.title || ''} — ${exp.company || ''}`, bold: true })] }));
      children.push(new Paragraph({ text: `${exp.startDate || ''} - ${exp.endDate || 'Present'}`, italics: true }));
      (exp.bullets || []).forEach(b => children.push(new Paragraph({ text: `• ${b}` })));
    });
  }

  if (education.length > 0) {
    addHeading('Education');
    education.forEach(ed => {
      children.push(new Paragraph({ children: [new TextRun({ text: `${ed.degree || ''} — ${ed.institution || ''}`, bold: true })] }));
      children.push(new Paragraph(`${ed.startDate || ''} - ${ed.endDate || ''}`));
    });
  }

  if (skills.length > 0) {
    addHeading('Skills');
    children.push(new Paragraph(skills.map(s => (typeof s === 'string' ? s : s.name)).join(', ')));
  }

  if (projects.length > 0) {
    addHeading('Projects');
    projects.forEach(p => {
      children.push(new Paragraph({ children: [new TextRun({ text: p.name || '', bold: true })] }));
      children.push(new Paragraph(p.description || ''));
    });
  }

  if (certifications.length > 0) {
    addHeading('Certifications');
    children.push(new Paragraph(certifications.map(c => (typeof c === 'string' ? c : c.name)).join(', ')));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// ==========================================================
// Plain-text export (.txt)
// The most ATS-safe format there is: linear, no styling, no columns.
// Some job boards specifically ask you to paste plain text.
// ==========================================================
function generateTXT(resume) {
  const skills = parseField(resume.skills).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  const certifications = parseField(resume.certifications).map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean);
  const education = parseField(resume.education);
  const experience = parseField(resume.experience);
  const projects = parseField(resume.projects);

  const lines = [];
  const rule = () => lines.push('='.repeat(60));
  const heading = (t) => { lines.push('', t.toUpperCase(), '-'.repeat(t.length)); };

  lines.push(resume.full_name || 'Your Name');
  const contact = [resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean);
  if (contact.length) lines.push(contact.join(' | '));
  rule();

  if (resume.summary) { heading('Professional Summary'); lines.push(resume.summary); }

  if (experience.length) {
    heading('Work Experience');
    experience.forEach(exp => {
      lines.push(`${exp.title || ''}${exp.company ? ' — ' + exp.company : ''}`);
      lines.push(`${exp.startDate || ''} - ${exp.endDate || 'Present'}`);
      (exp.bullets || []).filter(Boolean).forEach(b => lines.push(`  * ${b}`));
      lines.push('');
    });
  }

  if (education.length) {
    heading('Education');
    education.forEach(ed => {
      lines.push(`${ed.degree || ''}${ed.institution ? ' — ' + ed.institution : ''}`);
      lines.push(`${ed.startDate || ''} - ${ed.endDate || ''}`);
    });
  }

  if (skills.length) { heading('Skills'); lines.push(skills.join(', ')); }

  if (projects.length) {
    heading('Projects');
    projects.forEach(p => {
      lines.push(p.name || '');
      if (p.description) lines.push(p.description);
      lines.push('');
    });
  }

  if (certifications.length) { heading('Certifications'); lines.push(certifications.join(', ')); }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ==========================================================
// JSON export (.json)
// A structured, re-importable dump loosely following the JSON Resume
// schema (jsonresume.org). Useful for backups and interop.
// ==========================================================
function generateJSON(resume) {
  const skills = parseField(resume.skills).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  const certifications = parseField(resume.certifications).map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean);

  const data = {
    basics: {
      name: resume.full_name || '',
      email: resume.email || '',
      phone: resume.phone || '',
      location: { address: resume.location || '' },
      profiles: resume.linkedin ? [{ network: 'LinkedIn/Portfolio', url: resume.linkedin }] : [],
      summary: resume.summary || '',
    },
    work: parseField(resume.experience).map(exp => ({
      position: exp.title || '',
      name: exp.company || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      highlights: (exp.bullets || []).filter(Boolean),
    })),
    education: parseField(resume.education).map(ed => ({
      studyType: ed.degree || '',
      institution: ed.institution || '',
      startDate: ed.startDate || '',
      endDate: ed.endDate || '',
    })),
    projects: parseField(resume.projects).map(p => ({
      name: p.name || '',
      description: p.description || '',
    })),
    skills: skills.map(name => ({ name })),
    certificates: certifications.map(name => ({ name })),
    meta: { template: resume.template || 'modern', generatedAt: new Date().toISOString() },
  };

  return JSON.stringify(data, null, 2);
}

module.exports = { generatePDF, generateDOCX, generateTXT, generateJSON };
