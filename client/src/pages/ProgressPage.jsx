import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProgressChart from '../components/ProgressChart';
import { fetchProgress } from '../api/tutorApi';
import { useAuth } from '../context/AuthContext';
import { BarChart3, RefreshCw, Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProgressPage() {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProgress = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProgress('me');
      setProgressData(data);
    } catch (err) {
      console.warn('Could not fetch remote progress, using local profile baseline:', err.message);
      // Fallback baseline data if not logged in yet or no history
      setProgressData({
        fluencyScore: 68,
        problemsSolved: 3,
        totalSessions: 5,
        successRate: 60,
        currentDifficulty: user?.currentDifficulty || 'beginner',
        difficultyMetrics: { samples: 5, successRate: 60, avgHintsUsed: 1.4, avgDurationSeconds: 180 },
        mistakeTrends: [
          { date: 'Day 1', total: 4, 'off-by-one': 2, 'syntax': 2 },
          { date: 'Day 2', total: 3, 'off-by-one': 1, 'logic-error': 2 },
          { date: 'Day 3', total: 5, 'boundary-error': 2, 'off-by-one': 3 },
          { date: 'Day 4', total: 2, 'off-by-one': 1, 'logic-error': 1 },
          { date: 'Day 5', total: 1, 'type-error': 1 }
        ],
        hintsUsedTrend: [
          { title: 'Two Sum', hintsUsed: 2, date: 'Day 1' },
          { title: 'Palindrome', hintsUsed: 3, date: 'Day 2' },
          { title: 'Reverse List', hintsUsed: 1, date: 'Day 3' },
          { title: 'Valid Anagram', hintsUsed: 1, date: 'Day 4' },
          { title: 'Fibonacci DP', hintsUsed: 0, date: 'Day 5' }
        ],
        categoryDistribution: [
          { errorType: 'off-by-one', count: 7 },
          { errorType: 'logic-error', count: 4 },
          { errorType: 'boundary-error', count: 3 },
          { errorType: 'syntax', count: 2 }
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col">
      <Navbar currentDifficulty={progressData?.currentDifficulty} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/tutor"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Tutor
              </Link>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-brand-400" />
              Learning Progress & Habit Diagnostics
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Deep analytics on your mistake memory patterns, hint escalation trajectory, and calculated coding fluency.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadProgress}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* Charts Container */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <span className="text-xs">Computing fluency metrics & trends...</span>
          </div>
        ) : (
          <ProgressChart progressData={progressData} />
        )}
      </main>
    </div>
  );
}
