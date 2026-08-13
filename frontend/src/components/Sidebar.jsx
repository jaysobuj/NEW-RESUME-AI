// Sidebar.jsx - Left navigation menu shown on all logged-in pages

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// All nav items in one place - easy to add more pages later
const NAV_ITEMS = [
  { to: '/dashboard',      label: 'Dashboard',          icon: '🏠' },
  { to: '/resume-builder', label: 'Resume',              icon: '📝' },
  { to: '/search-jobs',    label: 'Search Jobs',         icon: '🔍' },
  { to: '/ai-tailoring',   label: 'Tailor Resume',       icon: '✂️' },
  { to: '/ats-scan',       label: 'ATS Scan',            icon: '🎯' },
  { to: '/export',         label: 'Export Resume',       icon: '📤' },
  { to: '/applications',   label: 'Application Tracker', icon: '📋' },
  { to: '/settings',       label: 'Settings',            icon: '⚙️' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // First letter of name for the avatar circle
  const initials = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <aside className="sidebar">

      {/* Brand logo at the top */}
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">✨</span>
        <span>ResumeAI</span>
      </div>

      {/* Navigation links */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info and logout at the bottom */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div>
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-plan">
              {user?.plan === 'pro' ? '⭐ Pro Plan' : '🆓 Free Plan'}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-block" onClick={handleLogout}
          style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}>
          🚪 Log out
        </button>
      </div>
    </aside>
  );
}
