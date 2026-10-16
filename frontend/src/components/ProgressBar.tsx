import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  answeredCount: number;
  correctCount: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  answeredCount,
  correctCount,
}) => {
  const percentage = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-brand-400">
            Progress
          </span>
          <span className="text-slate-400 text-xs">/</span>
          <span className="text-sm font-semibold text-slate-200">
            Question <span className="text-brand-400 font-mono font-bold">{current + 1}</span> of{' '}
            <span className="font-mono">{total}</span>
          </span>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-500"></span>
            <span>Answered: {answeredCount}/{total}</span>
          </div>
          {answeredCount > 0 && (
            <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Score: {correctCount}/{answeredCount}</span>
            </div>
          )}
          <span className="text-slate-400 font-bold">{percentage}%</span>
        </div>
      </div>

      <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
