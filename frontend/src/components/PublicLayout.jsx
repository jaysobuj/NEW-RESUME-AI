// PublicLayout.jsx - Shared navbar + footer wrapper for public marketing pages
// (Home, About, Services, Contact). Logged-in app pages use Sidebar/Layout instead.

import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Us' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact Us' },
];

export default function PublicLayout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="public-header-inner">
          <Link to="/" className="public-brand" onClick={() => setMenuOpen(false)}>
            <span className="public-brand-icon">✨</span> ResumeAI
          </Link>

          <nav className={`public-nav${menuOpen ? ' open' : ''}`}>
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="public-header-actions">
            {user ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
                Go to Dashboard →
              </button>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Sign Up Free</Link>
              </>
            )}
          </div>

          <button
            className="public-nav-toggle"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      <main className="public-main">{children}</main>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="public-footer-brand">
            <div className="public-brand" style={{ pointerEvents: 'none' }}>
              <span className="public-brand-icon">✨</span> ResumeAI
            </div>
            <p>Your AI-powered career companion — built to help you land the job you deserve.</p>
          </div>

          <div className="public-footer-col">
            <h4>Navigate</h4>
            <Link to="/">Home</Link>
            <Link to="/about">About Us</Link>
            <Link to="/services">Services</Link>
            <Link to="/contact">Contact Us</Link>
          </div>

          <div className="public-footer-col">
            <h4>Account</h4>
            <Link to="/login">Log In</Link>
            <Link to="/register">Create Account</Link>
          </div>

          <div className="public-footer-col">
            <h4>Get in touch</h4>
            <a href="mailto:hello@resumeai.app">hello@resumeai.app</a>
            <span className="public-footer-muted">Melbourne, Australia</span>
          </div>
        </div>
        <div className="public-footer-bottom">
          © {new Date().getFullYear()} ResumeAI — A student capstone project. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
