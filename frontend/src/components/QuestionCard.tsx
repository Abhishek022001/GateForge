import React from 'react';
import { ChevronLeft, ChevronRight, Send, RefreshCw } from 'lucide-react';
import { IAnswerEvaluation, IQuestion } from '../types/question';
import { ExamBadge } from './ExamBadge';
import { OptionCard } from './OptionCard';
import { ExplanationCard } from './ExplanationCard';

interface QuestionCardProps {
  question: IQuestion;
  selectedOption: string | null;
  evaluation: IAnswerEvaluation | null;
  isSubmitting: boolean;
  onSelectOption: (optionId: string) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  onResetSelection: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  totalQuestions: number;
  currentIndex: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedOption,
  evaluation,
  isSubmitting,
  onSelectOption,
  onSubmitAnswer,
  onNextQuestion,
  onPreviousQuestion,
  onResetSelection,
  hasNext,
  hasPrevious,
}) => {
  const isSubmitted = evaluation !== null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
      {/* Question Metadata Header */}
      <div className="p-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {question.source?.type === 'PYQ' || (question as any).source?.type === 'OFFICIAL_PYQ' || (question as any).sourceType === 'OFFICIAL_PYQ' || Boolean((question as any).provenance) || Boolean(question.year) ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 tracking-wide uppercase">
              Official GATE PYQ • {question.year || question.source?.year || '2024'}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-violet-950 text-violet-300 border border-violet-700/60 tracking-wide uppercase">
              AI Generated Practice Question
            </span>
          )}
          <ExamBadge label={question.subject} variant="subject" />
          <ExamBadge label={question.difficulty} variant="difficulty" difficulty={question.difficulty} />
          <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {question.questionType || 'MCQ'}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/60">
            {question.topic}
          </span>
        </div>
      </div>

      {/* Question Content Body */}
      <div className="p-6 md:p-8">
        <div className="text-base md:text-lg leading-relaxed text-slate-100 font-normal mb-6 whitespace-pre-line tracking-wide">
          {question.question}
        </div>

        {/* Official Figure / Schematic Diagram */}
        {question.imageUrl && (
          <div className="my-6 flex flex-col items-center justify-center p-4 bg-slate-950/70 rounded-xl border border-slate-800">
            <img
              src={question.imageUrl}
              alt={`Figure for Question ${question.questionNumber || ''}`}
              className="max-h-[400px] max-w-full rounded-lg object-contain shadow-md border border-slate-700/60 bg-white p-2"
              loading="lazy"
            />
            <span className="text-[11px] font-mono text-slate-400 mt-2">
              Official Examination Figure • GATE {question.year || question.source?.year || ''}
            </span>
          </div>
        )}

        {/* Options List */}
        <div className="space-y-3 mb-8">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Select one of the following options:
          </div>
          {question.options && question.options.map((option) => {
            const isSelected = selectedOption === option.id;
            const isUserSelection = evaluation?.userAnswer === option.id;
            const isCorrectOption =
              evaluation !== null ? evaluation.correctAnswer === option.id : null;

            return (
              <OptionCard
                key={option.id}
                option={option}
                isSelected={isSelected}
                isSubmitted={isSubmitted}
                isCorrectOption={isCorrectOption}
                isUserSelection={isUserSelection}
                onSelect={onSelectOption}
                disabled={isSubmitting}
              />
            );
          })}
        </div>

        {/* Explanation Card when evaluated */}
        {evaluation && <ExplanationCard evaluation={evaluation} />}

        {/* Controls & Action Bar */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onPreviousQuestion}
              disabled={!hasPrevious || isSubmitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 border border-slate-700 transition cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {isSubmitted && (
              <button
                type="button"
                onClick={onResetSelection}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
                title="Retry question"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {!isSubmitted ? (
              <button
                type="button"
                onClick={onSubmitAnswer}
                disabled={!selectedOption || isSubmitting}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 disabled:opacity-40 disabled:hover:bg-brand-500 disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Answer</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onNextQuestion}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 transition-all cursor-pointer"
              >
                <span>{hasNext ? 'Next Question' : 'View Summary'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
