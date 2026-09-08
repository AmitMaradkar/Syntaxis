import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Trophy,
  TrendingUp,
  Brain,
  Lightbulb,
  CheckCircle2,
  AlertOctagon,
  Target,
  Zap
} from 'lucide-react';

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1'];

export default function ProgressChart({ progressData }) {
  const {
    fluencyScore = 65,
    problemsSolved = 0,
    totalSessions = 0,
    successRate = 0,
    currentDifficulty = 'beginner',
    difficultyMetrics = {},
    mistakeTrends = [],
    hintsUsedTrend = [],
    categoryDistribution = []
  } = progressData || {};

  // Color for fluency score badge
  const fluencyColor =
    fluencyScore >= 75 ? 'text-emerald-400' : fluencyScore >= 50 ? 'text-amber-400' : 'text-sky-400';

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fluency Score Card */}
        <div className="p-4 rounded-2xl glass-card border border-brand-500/20 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fluency Score
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${fluencyColor}`}>{fluencyScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Weighted composite: Success rate, declining hints & mistake reduction
          </p>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-indigo-400 rounded-full transition-all duration-700"
              style={{ width: `${fluencyScore}%` }}
            />
          </div>
        </div>

        {/* Problems Solved */}
        <div className="p-4 rounded-2xl glass-card border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Problems Solved
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{problemsSolved}</span>
            <span className="text-xs text-slate-400">of {totalSessions} attempted</span>
          </div>
          <p className="text-[11px] text-emerald-400/80 mt-2">
            {successRate}% overall solve rate
          </p>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, successRate)}%` }}
            />
          </div>
        </div>

        {/* Adaptive Difficulty Level */}
        <div className="p-4 rounded-2xl glass-card border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Inferred Difficulty
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold capitalize text-white">
              {currentDifficulty}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Rolling avg hints used: {difficultyMetrics?.avgHintsUsed ?? 0}
          </p>
          <div className="flex items-center gap-1 mt-3">
            {['beginner', 'intermediate', 'advanced'].map((lvl, i) => (
              <div
                key={lvl}
                className={`flex-1 h-1.5 rounded-full ${
                  lvl === currentDifficulty
                    ? 'bg-amber-400'
                    : i < ['beginner', 'intermediate', 'advanced'].indexOf(currentDifficulty)
                    ? 'bg-amber-400/40'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Mistake Habits Tracked */}
        <div className="p-4 rounded-2xl glass-card border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Recurring Habits
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {categoryDistribution.length}
            </span>
            <span className="text-xs text-slate-400">patterns identified</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Top habit: <span className="text-rose-300 font-semibold">{categoryDistribution[0]?.errorType || 'None yet'}</span>
          </p>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-rose-400 rounded-full"
              style={{ width: `${Math.min(100, categoryDistribution.length * 20)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chart Row 1: Mistake Frequency Trend & Recurring Patterns Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mistake Frequency Trend (Area Chart) */}
        <div className="lg:col-span-2 p-5 rounded-2xl glass-panel border border-surface-border flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-400" />
                Mistake Frequency Trend (30 Days)
              </h3>
              <p className="text-xs text-slate-400">
                Number of categorized coding mistakes encountered over time
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            {mistakeTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mistakeTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mistakeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111726',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Mistakes"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#mistakeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Brain className="w-8 h-8 opacity-30" />
                <span>No mistake logs recorded yet. Solve problems to populate trends!</span>
              </div>
            )}
          </div>
        </div>

        {/* Pattern Distribution Breakdown (Pie Chart) */}
        <div className="p-5 rounded-2xl glass-panel border border-surface-border flex flex-col">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-rose-400" />
            Error Pattern Breakdown
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Most frequent error categories logged by LLM
          </p>

          <div className="h-52 w-full flex-1">
            {categoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    dataKey="count"
                    nameKey="errorType"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={38}
                    paddingAngle={3}
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111726',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem',
                      fontSize: '11px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
                <span>No pattern data yet.</span>
              </div>
            )}
          </div>

          {/* List of top categories */}
          <div className="space-y-1.5 mt-2 overflow-y-auto max-h-32">
            {categoryDistribution.slice(0, 4).map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="font-mono text-[11px]">{cat.errorType}</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">{cat.count}x</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Row 2: Hints Used Trend per Session */}
      <div className="p-5 rounded-2xl glass-panel border border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Hint Escalation Trend (Recent Sessions)
            </h3>
            <p className="text-xs text-slate-400">
              Number of hint tiers escalated per session (lower indicates growing mastery)
            </p>
          </div>
        </div>

        <div className="h-56 w-full">
          {hintsUsedTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hintsUsedTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="title" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 3]} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111726',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '0.75rem',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="hintsUsed" name="Hints Escalated" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
              <Lightbulb className="w-8 h-8 opacity-30" />
              <span>Hint usage data will appear as you request progressive hints.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
