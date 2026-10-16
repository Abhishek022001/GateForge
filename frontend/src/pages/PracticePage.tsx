import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionCard } from '../components/QuestionCard';
import { api } from '../services/api';
import { IAnswerEvaluation, IQuestion } from '../types/question';

interface PracticePageProps {
  onBackToHome: () => void;
}

export const PracticePage: React.FC<PracticePageProps> = ({ onBackToHome }) => {
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, IAnswerEvaluation>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  // Fetch practice questions from API
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getQuestions();
      setQuestions(data);
      setCurrentIndex(0);
      setSelectedOption(null);
      setEvaluations({});
      setUserAnswers({});
      setShowSummary(false);
    } catch (err) {
      console.error('Failed to load questions:', err);
      setError(
        (err as Error).message ||
          'Could not connect to the backend server. Please verify backend is running.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] || null : null;

  // Handle option selection
  const handleSelectOption = (optionId: string) => {
    if (!currentEvaluation && !isSubmitting) {
      setSelectedOption(optionId);
      if (currentQuestion) {
        setUserAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: optionId,
        }));
      }
    }
  };

  // Submit answer for evaluation
  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !selectedOption || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await api.submitAnswer(currentQuestion.id, selectedOption);
      setEvaluations((prev) => ({
        ...prev,
        [currentQuestion.id]: result,
      }));
    } catch (err) {
      console.error('Answer submission failed:', err);
      alert(`Submission error: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation handlers
  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextQuestion = questions[nextIndex];
      setSelectedOption(userAnswers[nextQuestion.id] || null);
    } else {
      setShowSummary(true);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      const prevQuestion = questions[prevIndex];
      setSelectedOption(userAnswers[prevQuestion.id] || null);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      const targetQuestion = questions[index];
      setSelectedOption(userAnswers[targetQuestion.id] || null);
      setShowSummary(false);
    }
  };

  const handleResetCurrentSelection = () => {
    if (currentQuestion) {
      setSelectedOption(null);
      setEvaluations((prev) => {
        const next = { ...prev };
        delete next[currentQuestion.id];
        return next;
      });
      setUserAnswers((prev) => {
        const next = { ...prev };
        delete next[currentQuestion.id];
        return next;
      });
    }
  };

  // Metrics
  const answeredCount = Object.keys(evaluations).length;
  const correctCount = Object.values(evaluations).filter((e) => e.isCorrect).length;
  const incorrectCount = answeredCount - correctCount;

  // Render Loading State
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-4">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Loading GATE Questions</h3>
        <p className="text-xs text-slate-400 font-mono">
          Connecting to backend repository & initial evaluation engine...
        </p>
      </div>
    );
  }

  // Render Error State
  if (error || questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-800/80 shadow-2xl">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Practice Session Unavailable</h3>
          <p className="text-xs text-rose-300/80 mb-6 leading-relaxed">
            {error || 'No questions currently loaded in the database.'}
          </p>
          <div className="flex items-center justify-center space-x-3">
            <button
              type="button"
              onClick={loadQuestions}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Summary / Scorecard View
  if (showSummary) {
    const accuracy =
      answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    // Standard GATE marking: +1 for correct, -0.33 for incorrect MCQ
    const rawScore = (correctCount * 1.0 - incorrectCount * 0.33).toFixed(2);

    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-brand-950/80 border border-brand-800/80 mb-3 shadow-glow">
              <Award className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Practice Session Summary
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              GATE Computer Science • Performance Breakdown
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-xs font-mono uppercase text-slate-400 mb-1">Answered</div>
              <div className="text-2xl font-mono font-bold text-slate-200">
                {answeredCount}/{questions.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-900/40 text-center">
              <div className="text-xs font-mono uppercase text-emerald-400 mb-1">Correct</div>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                {correctCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/40 text-center">
              <div className="text-xs font-mono uppercase text-rose-400 mb-1">Incorrect</div>
              <div className="text-2xl font-mono font-bold text-rose-400">
                {incorrectCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-brand-900/40 text-center">
              <div className="text-xs font-mono uppercase text-brand-400 mb-1">Accuracy</div>
              <div className="text-2xl font-mono font-bold text-brand-400">
                {accuracy}%
              </div>
            </div>
          </div>

          {/* GATE Estimated Marks Card */}
          <div className="mb-8 p-4 rounded-xl bg-brand-950/30 border border-brand-800/40 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-brand-400 font-semibold">
                GATE Marking Equivalent
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Calculated with standard 1-mark MCQ scheme (+1.00 / -0.33 negative penalty)
              </div>
            </div>
            <div className="text-2xl font-mono font-bold text-brand-300">
              {rawScore} <span className="text-xs font-sans text-slate-400">Marks</span>
            </div>
          </div>

          {/* Question Review Strip */}
          <div className="mb-8">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-3">
              Question Navigator & Review
            </h4>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {questions.map((q, idx) => {
                const evalItem = evaluations[q.id];
                let itemStyles = 'bg-slate-800 text-slate-400 border-slate-700';
                if (evalItem) {
                  itemStyles = evalItem.isCorrect
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    : 'bg-rose-950 text-rose-400 border-rose-700';
                }
                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-10 rounded-lg border font-mono text-xs font-bold transition flex items-center justify-center cursor-pointer ${itemStyles}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={loadQuestions}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Practice Again</span>
            </button>

            <button
              type="button"
              onClick={onBackToHome}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white transition cursor-pointer"
            >
              <span>Back to Overview</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal Question View
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header bar with Back Button */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSummary(true)}
          className="text-xs font-mono text-brand-400 hover:text-brand-300 transition cursor-pointer"
        >
          View Summary ({answeredCount}/{questions.length})
        </button>
      </div>

      {/* Progress & Metric Header */}
      <ProgressBar
        current={currentIndex}
        total={questions.length}
        answeredCount={answeredCount}
        correctCount={correctCount}
      />

      {/* Question Palette Strip */}
      <div className="mb-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 overflow-x-auto">
        <div className="flex items-center space-x-2 min-w-max">
          <span className="text-[11px] font-mono text-slate-400 mr-2 uppercase font-semibold">
            Quick Jump:
          </span>
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const evalItem = evaluations[q.id];
            let itemStyles = 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700';

            if (evalItem) {
              itemStyles = evalItem.isCorrect
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-rose-950 text-rose-300 border-rose-700';
            } else if (userAnswers[q.id]) {
              itemStyles = 'bg-brand-950 text-brand-300 border-brand-700';
            }

            if (isCurrent) {
              itemStyles += ' ring-2 ring-brand-400 font-extrabold';
            }

            return (
              <button
                key={q.id}
                onClick={() => handleJumpToQuestion(idx)}
                className={`w-7 h-7 rounded-lg border font-mono text-xs transition flex items-center justify-center cursor-pointer ${itemStyles}`}
                title={`Question ${idx + 1}: ${q.subject} - ${q.topic}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Card */}
      {currentQuestion && (
        <QuestionCard
          question={currentQuestion}
          selectedOption={selectedOption}
          evaluation={currentEvaluation}
          isSubmitting={isSubmitting}
          onSelectOption={handleSelectOption}
          onSubmitAnswer={handleSubmitAnswer}
          onNextQuestion={handleNextQuestion}
          onPreviousQuestion={handlePreviousQuestion}
          onResetSelection={handleResetCurrentSelection}
          hasNext={currentIndex < questions.length - 1}
          hasPrevious={currentIndex > 0}
          totalQuestions={questions.length}
          currentIndex={currentIndex}
        />
      )}
    </div>
  );
};
