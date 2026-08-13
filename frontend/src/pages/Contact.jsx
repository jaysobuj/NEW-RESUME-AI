// Contact.jsx - Public "Contact Us" page
// Note: there's no backend endpoint for this form yet, so submission is
// simulated on the frontend. Wire this up to a real /api/contact route
// (e.g. via backend/routes) once one exists.

import React, { useState } from 'react';
import PublicLayout from '../components/PublicLayout';
import { Alert } from '../components/UI';

const CONTACT_INFO = [
  { icon: '📧', label: 'Email', value: 'hello@resumeai.app' },
  { icon: '📍', label: 'Location', value: 'Melbourne, Australia' },
  { icon: '🎓', label: 'Project', value: 'NIT3004 Capstone — AI Resume Builder' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.message) {
      setError('Please fill in your name, email and message.');
      return;
    }
    // No backend contact endpoint exists yet — simulate a successful send.
    setSubmitted(true);
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <PublicLayout>
      <section className="page-hero">
        <span className="hero-badge">Contact Us</span>
        <h1>We'd love to hear from you.</h1>
        <p className="hero-sub">
          Questions, feedback or found a bug? Send us a message and our team will get back to you.
        </p>
      </section>

      <section className="section">
        <div className="contact-grid">
          <div className="contact-info-col">
            <h2>Get in touch</h2>
            <p>
              Whether it's a question about a feature, feedback on your experience, or a bug
              report — we want to hear it.
            </p>
            {CONTACT_INFO.map((c) => (
              <div className="contact-info-item" key={c.label}>
                <span className="contact-info-icon">{c.icon}</span>
                <div>
                  <div className="contact-info-label">{c.label}</div>
                  <div className="contact-info-value">{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="contact-form-col">
            <div className="card">
              {submitted && (
                <Alert type="success" style={{ marginBottom: 16 }}>
                  Thanks — your message has been sent. We'll get back to you soon.
                </Alert>
              )}
              {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Your name</label>
                  <input
                    className="form-input"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    className="form-input"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input
                    className="form-input"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="How can we help?"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-input"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Tell us more..."
                    rows={5}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <button className="btn btn-primary btn-block btn-lg" type="submit">
                  ✉️ Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
