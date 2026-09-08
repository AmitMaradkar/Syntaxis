import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Lightbulb,
  Search,
  CheckCircle,
  ChevronRight,
  Sparkles,
  AlertOctagon,
  ArrowRight,
  HelpCircle,
  Code
} from 'lucide-react';

export default function HintPanel({
  currentTier = 0,
  hintsHistory = [],
  onNextHint,
  isLoadingHint,
  patternsInjected,
  recurringPatternDetected,
  onExplainWhy,
  latestErrors = [],
  isCodeModified = false
}) {
  const tierConfig = {
    1: {
      title: 'Tier 1: Conceptual Nudge',
      desc: 'High-level conceptual guiding question. No code revealed.',
      icon: Lightbulb,
      color: 'text-sky-400',
      border: 'border-sky-500/30',
      bg: 'bg-sky-500/10'
    },
    2: {
      title: 'Tier 2: Specific Pointer',
      desc: 'Pinpoints problematic logic area and variables.',
      icon: Search,
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10'
    },
    3: {
      title: 'Tier 3: Solution & Mental Model',
      desc: 'Full explanation with corrected code and deep mental model.',
      icon: CheckCircle,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10'
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Code Modified Indicator */}
      {isCodeModified && hintsHistory.length > 0 && (
        <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center gap-2 text-xs text-sky-200 animate-fade-in">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="flex-1 text-[11px]">
            <span className="font-semibold text-sky-300">Code updated:</span> Hints below are from your earlier attempt. Click <strong>Get Help</strong> or <strong>Next Hint</strong> to evaluate your current code!
          </div>
        </div>
      )}

      {/* Pattern Memory Alert Banner (Core USP) */}
      {(recurringPatternDetected || patternsInjected) && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-amber-300">Mistake Pattern Memory Active:</span>{' '}
            <span>
              {recurringPatternDetected
                ? 'Your AI Tutor detected one of your recurring mistake habits in this attempt. The guidance is tailored to break this habit.'
                : 'Prior mistake trends are injected into the tutor context to watch for recurring patterns.'}
            </span>
          </div>
        </div>
      )}

      {/* 3-Tier Escalation Stepper */}
      <div className="p-3 rounded-xl bg-[#131b2e] border border-surface-border">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Adaptive Hint Escalation
          </span>
          <span className="text-xs font-mono font-medium text-brand-300">
            {currentTier === 0 ? 'No hints unlocked' : `Tier ${currentTier} of 3`}
          </span>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((tier) => {
            const isUnlocked = currentTier >= tier;
            const isCurrent = currentTier === tier;
            const IconComponent = tierConfig[tier].icon;

            return (
              <div
                key={tier}
                className={`p-2 rounded-lg border text-xs transition-all flex flex-col items-center gap-1 text-center ${
                  isUnlocked
                    ? `${tierConfig[tier].bg} ${tierConfig[tier].border} ${tierConfig[tier].color}`
                    : 'bg-white/5 border-white/5 text-slate-500'
                } ${isCurrent ? 'ring-2 ring-brand-500/50 shadow-md' : ''}`}
              >
                <IconComponent className="w-4 h-4" />
                <span className="font-semibold text-[11px]">Tier {tier}</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">
                  {tier === 1 ? 'Nudge' : tier === 2 ? 'Pointer' : 'Solution'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Next Hint Action Button */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {currentTier === 0 && 'Submit code or click Next Hint for a Tier 1 conceptual nudge.'}
            {currentTier === 1 && 'Need more guidance? Escalate to Tier 2 pointer.'}
            {currentTier === 2 && 'Still stuck? Escalate to Tier 3 full explanation.'}
            {currentTier >= 3 && !isCodeModified && 'Maximum escalation reached. Full solution unlocked.'}
            {currentTier >= 3 && isCodeModified && 'Code changed! Click to get fresh hints for your new code.'}
          </div>

          <button
            onClick={onNextHint}
            disabled={isLoadingHint || (currentTier >= 3 && !isCodeModified)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-brand-600 shrink-0"
          >
            {isLoadingHint ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>
              {isCodeModified && currentTier >= 3
                ? 'Hint on New Code'
                : currentTier >= 3
                ? 'Max Tier'
                : currentTier === 0
                ? 'Start Hint'
                : 'Next Hint'}
            </span>
          </button>
        </div>
      </div>

      {/* Unlocked Hints List */}
      <div className="flex flex-col gap-2.5">
        {hintsHistory.map((item, idx) => {
          const cfg = tierConfig[item.tier] || tierConfig[1];
          const IconComponent = cfg.icon;

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition-all animate-fade-in ${cfg.bg} ${cfg.border}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`p-1 rounded-md bg-black/20 ${cfg.color}`}>
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-slate-200">{cfg.title}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="prose-tutor text-slate-200 leading-relaxed text-xs">
                <ReactMarkdown>{item.content}</ReactMarkdown>
              </div>

              {/* Explain-Why Button on Tier 2 / 3 */}
              {item.tier >= 2 && onExplainWhy && (
                <div className="mt-3 pt-2.5 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => onExplainWhy()}
                    className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200 font-medium px-2 py-1 rounded bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Explain Why: Mental Model Breakdown</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
