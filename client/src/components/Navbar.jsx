import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code2, BarChart2, Sparkles, LogOut, User, Zap } from 'lucide-react';

export default function Navbar({ currentDifficulty }) {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  const difficulty = currentDifficulty || user?.currentDifficulty || 'beginner';

  const difficultyBadgeConfig = {
    beginner: {
      label: 'Beginner Inferred',
      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      dot: 'bg-emerald-400'
    },
    intermediate: {
      label: 'Intermediate Inferred',
      color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      dot: 'bg-amber-400'
    },
    advanced: {
      label: 'Advanced Inferred',
      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      dot: 'bg-purple-400'
    }
  }[difficulty] || {
    label: 'Beginner',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400'
  };

  return (
    <header className="h-14 border-b border-surface-border bg-[#0b0f19]/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
              Syntaxis <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">AI Tutor</span>
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/tutor"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              location.pathname === '/tutor' || location.pathname === '/'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Tutor Workspace
          </Link>
          <Link
            to="/progress"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              location.pathname === '/progress'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
            Progress & Patterns
          </Link>
        </nav>
      </div>

      {/* Right side status & user */}
      <div className="flex items-center gap-3">
        {/* Adaptive Difficulty Pill (Subtle Badge, Not Manual Selector) */}
        <div
          title={`Adaptive Difficulty automatically set to ${difficulty} based on rolling performance.`}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all shadow-sm ${difficultyBadgeConfig.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${difficultyBadgeConfig.dot} animate-pulse`} />
          <span className="hidden sm:inline text-[11px] font-semibold">{difficultyBadgeConfig.label}</span>
          <span className="sm:hidden text-[11px] capitalize">{difficulty}</span>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium max-w-[100px] truncate">{user?.username}</span>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
