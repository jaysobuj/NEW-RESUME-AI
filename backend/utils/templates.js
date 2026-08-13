// ==========================================================
// templates.js
// The resume-template registry — the SINGLE SOURCE OF TRUTH for
// every design the app can render. The PDF/HTML renderer
// (renderHtml.js), the export route, the create/update validation
// in routes/resume.js, and the frontend template picker (which
// fetches this list over the API) all read from here.
//
// Adding a new template = adding one entry here + one CSS branch in
// renderHtml.js. Nothing else needs to change.
//
// Two tiers:
//   - category 'ats'      → single-column, no columns/photos/tables.
//                           Safe for applicant-tracking systems.
//   - category 'designer' → richer multi-column / coloured layouts.
//                           Look great for humans, but may not parse
//                           cleanly in every ATS (flagged in the UI).
// ==========================================================

const TEMPLATES = {
  modern: {
    id: 'modern',
    name: 'Modern',
    category: 'ats',
    layout: 'single',
    font: 'sans',
    accent: '#6366f1',
    featured: true,
    atsSafe: true,
    description: 'Clean single column with indigo headings. Great for tech and startups.',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    category: 'ats',
    layout: 'single',
    font: 'sans',
    accent: '#1e3a5f',
    featured: true,
    atsSafe: true,
    description: 'Navy ruled dividers, corporate and no-nonsense.',
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    category: 'ats',
    layout: 'single',
    font: 'serif',
    accent: '#111111',
    featured: false,
    atsSafe: true,
    description: 'Traditional serif with a centred header. Academia and government.',
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    category: 'ats',
    layout: 'single',
    font: 'serif',
    accent: '#374151',
    featured: false,
    atsSafe: true,
    description: 'Serif with generous spacing and wide margins. Senior roles.',
  },
  sidebar: {
    id: 'sidebar',
    name: 'Sidebar',
    category: 'designer',
    layout: 'sidebar',
    font: 'sans',
    accent: '#0f766e',
    featured: true,
    atsSafe: false,
    supportsPhoto: true,
    description: 'Two-column with a coloured sidebar for contact and skills.',
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    category: 'designer',
    layout: 'creative',
    font: 'sans',
    accent: '#db2777',
    featured: false,
    atsSafe: false,
    description: 'Bold coloured header block with skills as pills. Marketing and design.',
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    category: 'ats',
    layout: 'compact',
    font: 'sans',
    accent: '#2563eb',
    featured: true,
    atsSafe: true,
    description: 'Dense single column with blue headings and a two-column skills grid. Fits more on one page.',
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    category: 'designer',
    layout: 'elegant',
    font: 'sans',
    accent: '#4b5563',
    featured: true,
    atsSafe: false,
    description: 'Refined monochrome two-column with a wide letter-spaced name. Understated and premium.',
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    category: 'designer',
    layout: 'amber',
    font: 'sans',
    accent: '#f5a524',
    featured: false,
    atsSafe: false,
    description: 'Warm accent blocks with a sidebar and rated skill bars. Friendly and eye-catching.',
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    category: 'designer',
    layout: 'slate',
    font: 'sans',
    accent: '#e5484d',
    featured: false,
    atsSafe: false,
    description: 'Dark header band with a right-hand sidebar. Strong contrast for healthcare and technical roles.',
  },
};

const DEFAULT_TEMPLATE = 'modern';
const TEMPLATE_IDS = Object.keys(TEMPLATES);

function isValidTemplate(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATES, id);
}

// Always returns a valid template object — falls back to the default
// so a bad/legacy value can never reach the renderer.
function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES[DEFAULT_TEMPLATE];
}

// Coerce any input into a safe stored value.
function coerceTemplate(id) {
  return isValidTemplate(id) ? id : DEFAULT_TEMPLATE;
}

// Metadata array for the frontend picker (featured ones first).
function listTemplates() {
  return TEMPLATE_IDS
    .map(id => TEMPLATES[id])
    .sort((a, b) => (b.featured === true) - (a.featured === true));
}

// ==========================================================
// Fonts — independent of template. Each template ships a sensible
// default body font (see TEMPLATES[x].font, 'sans'|'serif'), but a
// resume can override it with one of these. renderHtml.js prefers
// this over the template default when present.
// ==========================================================
const FONTS = {
  sans: {
    id: 'sans',
    name: 'Sans-serif',
    stack: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    description: 'Clean and modern. The safest default for most roles.',
  },
  serif: {
    id: 'serif',
    name: 'Serif',
    stack: "Georgia, 'Times New Roman', Times, serif",
    description: 'Traditional and editorial. Suits academic and government roles.',
  },
  classic: {
    id: 'classic',
    name: 'Classic Serif',
    stack: "'Times New Roman', Times, Georgia, serif",
    description: 'Formal and dense. A familiar, no-frills look.',
  },
  rounded: {
    id: 'rounded',
    name: 'Rounded Sans',
    stack: "'Trebuchet MS', Verdana, 'Segoe UI', sans-serif",
    description: 'Friendly and approachable. Good for creative and customer-facing roles.',
  },
};
const FONT_IDS = Object.keys(FONTS);
const DEFAULT_FONT = 'sans';

function isValidFont(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(FONTS, id);
}

function coerceFont(id) {
  return isValidFont(id) ? id : null; // null = "use the template's own font"
}

function getFontStack(id) {
  return (FONTS[id] || FONTS[DEFAULT_FONT]).stack;
}

function listFonts() {
  return FONT_IDS.map(id => FONTS[id]);
}

module.exports = {
  TEMPLATES,
  TEMPLATE_IDS,
  DEFAULT_TEMPLATE,
  isValidTemplate,
  getTemplate,
  coerceTemplate,
  listTemplates,
  FONTS,
  FONT_IDS,
  DEFAULT_FONT,
  isValidFont,
  coerceFont,
  getFontStack,
  listFonts,
};
