import React from 'react';
import { CheckCircle2, XCircle, BookOpen, Lightbulb } from 'lucide-react';
import { IAnswerEvaluation } from '../types/question';

interface ExplanationCardProps {
  evaluation: IAnswerEvaluation;
}

export const ExplanationCard: React.FC<ExplanationCardProps> = ({ evaluation }) => {
  const { isCorrect, userAnswer, correctAnswer, explanation } = evaluation;

  return (
    <div
      className={`mt-6 rounded-2xl border transition-all duration-300 overflow-hidden ${
        isCorrect
          ? 'bg-emerald-950/20 border-emerald-800/60 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
          : 'bg-rose-950/20 border-rose-800/60 shadow-[0_0_30px_rgba(244,63,94,0.1)]'
      }`}
    >
      {/* Header Banner */}
      <div
        className={`px-5 py-4 flex items-center justify-between border-b ${
          isCorrect
            ? 'bg-emerald-900/30 border-emerald-800/50 text-emerald-300'
            : 'bg-rose-900/30 border-rose-800/50 text-rose-300'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400 stroke-[2.5]" />
          )}
          <span className="font-semibold text-sm tracking-wide">
            {isCorrect ? 'Correct Answer' : 'Incorrect Answer'}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span>
            Your Answer: <strong className="text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">{userAnswer}</strong>
          </span>
          <span>
            Correct: <strong className="text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800">{correctAnswer}</strong>
          </span>
        </div>
      </div>

      {/* Explanation Body */}
      <div className="p-5 text-slate-200">
        <div className="flex items-center space-x-2 mb-3 text-slate-400">
          <BookOpen className="w-4 h-4 text-brand-400" />
          <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-300">
            Comprehensive Concept & Solution Breakdown
          </h4>
        </div>

        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal text-slate-200">
          {explanation}
        </div>

        <div className="mt-4 flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
          <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <strong>GATE Tip:</strong> Verify edge cases and formula boundary conditions to avoid negative markings in competitive tests.
          </span>
        </div>
      </div>
    </div>
  );
};
