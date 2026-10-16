import React from 'react';

interface ExamBadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'difficulty' | 'subject' | 'year' | 'neutral';
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export const ExamBadge: React.FC<ExamBadgeProps> = ({
  label,
  variant = 'neutral',
  difficulty,
}) => {
  let styleClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  if (variant === 'difficulty' && difficulty) {
    if (difficulty === 'Easy') {
      styleClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-[0_0_10px_rgba(16,185,129,0.15)]';
    } else if (difficulty === 'Medium') {
      styleClasses = 'bg-amber-950/80 text-amber-300 border-amber-700/60 shadow-[0_0_10px_rgba(245,158,11,0.15)]';
    } else {
      styleClasses = 'bg-rose-950/80 text-rose-300 border-rose-700/60 shadow-[0_0_10px_rgba(244,63,94,0.15)]';
    }
  } else if (variant === 'primary') {
    styleClasses = 'bg-brand-950 text-brand-300 border-brand-700/60';
  } else if (variant === 'subject') {
    styleClasses = 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60';
  } else if (variant === 'year') {
    styleClasses = 'bg-purple-950/80 text-purple-300 border-purple-700/60 font-mono';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border tracking-wide uppercase ${styleClasses}`}
    >
      {label}
    </span>
  );
};
