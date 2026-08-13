// About.jsx - Public "About Us" page

import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';

const TEAM = [
  { name: 'Adnan Sami', role: 'Frontend Developer / UI Developer', icon: '🎨' },
  { name: 'MD Jahirul Sobuj', role: 'Backend Developer / API & Security Developer', icon: '🛠️' },
  { name: 'MD Shadman Hasan', role: 'Testing & Documentation Lead', icon: '🧪' },
  { name: 'Kaniz Fatema', role: 'Quality Assurance & Documentation Reviewer', icon: '✅' },
];

const VALUES = [
  { icon: '🎯', title: 'Purpose-built', text: 'Every feature is designed around one goal: helping job seekers get more interviews.' },
  { icon: '🔒', title: 'Privacy-minded', text: 'Your resume and personal data are handled securely and never shared without consent.' },
  { icon: '🤝', title: 'Student-driven', text: 'Built as a capstone project, with real care for solving a real problem students face.' },
];

export default function About() {
  return (
    <PublicLayout>
      <section className="page-hero">
        <span className="hero-badge">About Us</span>
        <h1>We're building a smarter way to job hunt.</h1>
        <p className="hero-sub">
          ResumeAI is a capstone project created to make resume writing and job applications
          less stressful — using AI to handle the busywork so you can focus on your career.
        </p>
      </section>

      <section className="section">
        <div className="about-grid">
          <div>
            <h2>Our story</h2>
            <p>
              ResumeAI started as a university capstone project (NIT3004) built by a team of
              four students who noticed how much time job seekers lose reformatting resumes,
              guessing what recruiters and ATS software want to see, and manually tracking every
              application in spreadsheets.
            </p>
            <p>
              We set out to combine a clean resume builder, AI-assisted writing, ATS scoring,
              job matching and application tracking into a single, easy-to-use platform —
              so anyone can put their best resume forward, faster.
            </p>
          </div>
          <div className="about-values">
            {VALUES.map((v) => (
              <div className="value-card" key={v.title}>
                <div className="feature-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="section-head">
          <h2>Meet the team</h2>
          <p>The people behind ResumeAI.</p>
        </div>
        <div className="team-grid">
          {TEAM.map((m) => (
            <div className="team-card" key={m.name}>
              <div className="team-avatar">{m.icon}</div>
              <h3>{m.name}</h3>
              <p>{m.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Want to see what we've built?</h2>
        <p>Explore our services or create a free account to try it yourself.</p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link to="/services" className="btn btn-secondary btn-lg">Our Services</Link>
          <Link to="/register" className="btn btn-primary btn-lg">Get Started Free</Link>
        </div>
      </section>
    </PublicLayout>
  );
}
