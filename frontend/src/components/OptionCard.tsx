import React from 'react';
import { Check, X } from 'lucide-react';
import { IOption } from '../types/question';

interface OptionCardProps {
  option: IOption;
  isSelected: boolean;
  isSubmitted: boolean;
  isCorrectOption: boolean | null; // True if this option is the correct answer
  isUserSelection: boolean; // True if user selected this option
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  option,
  isSelected,
  isSubmitted,
  isCorrectOption,
  isUserSelection,
  onSelect,
  disabled = false,
}) => {
  // Determine styling state
  let containerStyles =
    'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850/80 text-slate-200';
  let badgeStyles = 'bg-slate-800 text-slate-300 border-slate-700';

  if (!isSubmitted) {
    if (isSelected) {
      containerStyles =
        'bg-brand-950/40 border-brand-500 shadow-glow text-white ring-1 ring-brand-500';
      badgeStyles = 'bg-brand-500 text-white font-bold border-brand-400';
    }
  } else {
    // When submitted & evaluated:
    if (isCorrectOption) {
      containerStyles =
        'bg-emerald-950/30 border-emerald-500 text-emerald-100 shadow-glow-success ring-1 ring-emerald-500';
      badgeStyles = 'bg-emerald-600 text-white font-bold border-emerald-400';
    } else if (isUserSelection && !isCorrectOption) {
      containerStyles =
        'bg-rose-950/30 border-rose-500 text-rose-100 shadow-glow-error ring-1 ring-rose-500';
      badgeStyles = 'bg-rose-600 text-white font-bold border-rose-400';
    } else {
      containerStyles = 'bg-slate-900/30 border-slate-850 opacity-60 text-slate-400';
      badgeStyles = 'bg-slate-850 text-slate-500 border-slate-800';
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || isSubmitted}
      onClick={() => onSelect(option.id)}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start space-x-3.5 group cursor-pointer disabled:cursor-default ${containerStyles}`}
    >
      {/* Option Key Badge */}
      <div
        className={`w-8 h-8 flex-shrink-0 rounded-lg border flex items-center justify-center font-mono text-sm transition-all duration-200 ${badgeStyles}`}
      >
        {isSubmitted && isCorrectOption ? (
          <Check className="w-4 h-4 stroke-[3]" />
        ) : isSubmitted && isUserSelection && !isCorrectOption ? (
          <X className="w-4 h-4 stroke-[3]" />
        ) : (
          option.id
        )}
      </div>

      {/* Option Text */}
      <div className="flex-1 pt-0.5 font-medium leading-relaxed tracking-normal">
        {option.text}
      </div>
    </button>
  );
};
