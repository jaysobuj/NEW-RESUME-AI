// Home.jsx - Public landing / homepage

import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';

const FEATURES = [
  { icon: '📝', title: 'Resume Builder', text: 'Build a polished, professional resume in minutes with guided sections and live preview.' },
  { icon: '🎯', title: 'ATS Scan', text: 'Check how well your resume scores against Applicant Tracking Systems before you apply.' },
  { icon: '💡', title: 'AI Suggestions', text: 'Get smart, actionable suggestions to strengthen your bullet points and summary.' },
  { icon: '✂️', title: 'AI Tailoring', text: 'Tailor your resume to a specific job description in one click.' },
  { icon: '🧭', title: 'Job Matches', text: 'Discover roles that fit your skills and experience.' },
  { icon: '📋', title: 'Application Tracker', text: 'Keep every application organised, from Saved to Offer.' },
];

const STEPS = [
  { n: '1', title: 'Create your resume', text: 'Fill in your details or import an existing resume to get started.' },
  { n: '2', title: 'Let AI refine it', text: 'Run an ATS scan and apply AI suggestions to sharpen your content.' },
  { n: '3', title: 'Apply with confidence', text: 'Export, tailor to each job, and track every application in one place.' },
];

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-badge">✨ AI-Powered Resume Builder</span>
          <h1>Build a resume that gets you hired — faster.</h1>
          <p className="hero-sub">
            ResumeAI helps you write, scan, tailor and track your job applications with the
            help of AI, so you can spend less time formatting and more time landing interviews.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">🚀 Get Started Free</Link>
            <Link to="/services" className="btn btn-secondary btn-lg">See how it works</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="section-head">
          <h2>Everything you need to land your next role</h2>
          <p>One platform for building, scoring, tailoring and tracking your resume.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section section-alt">
        <div className="section-head">
          <h2>How it works</h2>
          <p>Three simple steps from blank page to job offer.</p>
        </div>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <div className="step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <h2>Ready to build a resume that stands out?</h2>
        <p>It's free to get started — no credit card required.</p>
        <Link to="/register" className="btn btn-primary btn-lg">Create your resume now →</Link>
      </section>
    </PublicLayout>
  );
}
