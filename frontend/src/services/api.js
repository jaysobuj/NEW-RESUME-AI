// api.js - Single shared axios instance used by every page
// Automatically attaches the JWT token to every request

import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE });

// Attach token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If token expires, log the user out automatically
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Generic file -> text helper (multipart/form-data)
api.uploadFile = async (file) => {
  const token = localStorage.getItem('token');
  const fd    = new FormData();
  fd.append('file', file);
  const res = await axios.post(`${BASE}/upload`, fd, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

// Resume import — uploads a PDF/DOCX/TXT resume, and the backend parses
// it into structured fields and saves it as a new resume record.
// Returns { resume, source, warnings }.
api.importResume = async (file) => {
  const token = localStorage.getItem('token');
  const fd    = new FormData();
  fd.append('file', file);
  const res = await axios.post(`${BASE}/resumes/import`, fd, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

// ---- Templates & export helpers ----

// List available resume design templates (the registry lives on the backend).
api.getTemplates = async () => {
  const res = await api.get('/export/templates');
  return res.data.templates;
};

// List available font overrides (independent of template).
api.getFonts = async () => {
  const res = await api.get('/export/fonts');
  return res.data.fonts;
};

// Fetch the rendered HTML for the live preview (auth handled by the
// axios interceptor, so we can safely inject it via <iframe srcDoc>).
api.getPreviewHtml = async (resumeId, template, font) => {
  const params = {};
  if (template) params.template = template;
  if (font) params.font = font;
  const res = await api.get(`/export/${resumeId}/preview`, {
    params,
    responseType: 'text',
    transformResponse: [(d) => d], // keep raw HTML string
  });
  return res.data;
};

// Download a resume in a given format/template/font and trigger a save dialog.
api.downloadResume = async (resumeId, format, template, font) => {
  const token = localStorage.getItem('token');
  const qs = new URLSearchParams();
  if (template) qs.set('template', template);
  if (font) qs.set('font', font);
  const query = qs.toString();
  const res = await fetch(`${BASE}/export/${resumeId}/${format}${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `resume.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default api;
