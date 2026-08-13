// Services.jsx - Public "Services" page

import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';

const SERVICES = [
  {
    icon: '📝',
    title: 'Resume Builder',
    text: 'Create a clean, professional resume with guided sections, multiple templates and a live preview as you type.',
    points: ['Multiple ATS-friendly templates', 'Live preview while editing', 'Save and edit anytime'],
  },
  {
    icon: '🎯',
    title: 'ATS Scan',
    text: 'Instantly see how your resume performs against Applicant Tracking Systems, with a clear score out of 100.',
    points: ['Overall ATS score', 'Keyword & formatting checks', 'Section-by-section breakdown'],
  },
  {
    icon: '💡',
    title: 'AI Suggestions',
    text: 'Get AI-generated suggestions to improve your summary, bullet points and overall wording.',
    points: ['Stronger action verbs', 'Clearer, more concise phrasing', 'Impact-focused rewrites'],
  },
  {
    icon: '✂️',
    title: 'AI Tailoring',
    text: 'Paste a job description and let AI tailor your resume to match what that specific role is looking for.',
    points: ['Match resume to job description', 'Highlight relevant skills', 'One-click tailored copy'],
  },
  {
    icon: '🧭',
    title: 'Job Recommendations',
    text: 'Discover job listings that fit your skills, experience and preferences.',
    points: ['Personalised matches', 'Skill-based recommendations', 'Save roles you like'],
  },
  {
    icon: '📋',
    title: 'Application Tracker',
    text: 'Track every application from Saved through Applied, Interview, Offer or Rejected — all in one dashboard.',
    points: ['Status pipeline view', 'Notes per application', 'Never lose track of a job'],
  },
  {
    icon: '📤',
    title: 'Export Resume',
    text: 'Export your finished resume as a polished, ready-to-send document whenever you need it.',
    points: ['Clean, print-ready formatting', 'Fast export', 'Multiple template options'],
  },
];

export default function Services() {
  return (
    <PublicLayout>
      <section className="page-hero">
        <span className="hero-badge">Our Services</span>
        <h1>Everything you need, from first draft to job offer.</h1>
        <p className="hero-sub">
          ResumeAI brings together resume building, AI writing help, ATS scoring, job matching
          and application tracking — all in one connected workflow.
        </p>
      </section>

      <section className="section">
        <div className="services-grid">
          {SERVICES.map((s) => (
            <div className="service-card" key={s.title}>
              <div className="feature-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <ul className="service-points">
                {s.points.map((p) => (
                  <li key={p}>✓ {p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to try it for yourself?</h2>
        <p>Create a free account and build your first resume in minutes.</p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link to="/register" className="btn btn-primary btn-lg">Get Started Free</Link>
          <Link to="/contact" className="btn btn-secondary btn-lg">Have questions? Contact us</Link>
        </div>
      </section>
    </PublicLayout>
  );
}
