import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/global.css';

import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ResumeBuilder from './pages/ResumeBuilder';
import ATSScan from './pages/ATSScan';
import AISuggestions from './pages/AISuggestions';
import AITailoring from './pages/AITailoring';
import ApplicationTracker from './pages/ApplicationTracker';
import JobRecommendations from './pages/JobRecommendations';
import SearchJobs from './pages/SearchJobs';
import ExportResume from './pages/ExportResume';
import Settings from './pages/Settings';
import { Spinner } from './components/UI';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-page-center"><Spinner label="Loading..." /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/about"    element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact"  element={<Contact />} />
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/resume-builder" element={<ProtectedRoute><ResumeBuilder /></ProtectedRoute>} />
          <Route path="/ats-scan"       element={<ProtectedRoute><ATSScan /></ProtectedRoute>} />
          <Route path="/ai-suggestions" element={<ProtectedRoute><AISuggestions /></ProtectedRoute>} />
          <Route path="/ai-tailoring"   element={<ProtectedRoute><AITailoring /></ProtectedRoute>} />
          <Route path="/job-matches"    element={<ProtectedRoute><JobRecommendations /></ProtectedRoute>} />
          <Route path="/search-jobs"    element={<ProtectedRoute><SearchJobs /></ProtectedRoute>} />
          <Route path="/applications"   element={<ProtectedRoute><ApplicationTracker /></ProtectedRoute>} />
          <Route path="/export"         element={<ProtectedRoute><ExportResume /></ProtectedRoute>} />
          <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
