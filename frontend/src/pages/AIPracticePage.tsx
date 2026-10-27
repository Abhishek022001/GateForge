import React, { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
  Zap,
  Check,
  X,
  BookOpen,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import {
  DifficultyLevel,
  IAIPracticeSessionConfig,
  IAIPracticeSessionSubmitData,
  IQuestion,
  QuestionType,
} from '../types/question';

const TECHNICAL_GATE_SUBJECTS = [
  'Databases',
  'Operating Systems',
  'Algorithms',
  'Data Structures',
  'Programming',
  'Theory of Computation',
  'Computer Networks',
  'Computer Organization and Architecture',
  'Digital Logic',
  'Compiler Design',
  'Discrete Mathematics',
  'Engineering Mathematics',
];

const LOADING_STAGES = [
  'Preparing your AI practice set...',
  'Analyzing relevant GATE patterns...',
  'Generating verified questions with bounded retries...',
  'Checking correctness & originality safeguards...',
];

interface AIPracticePageProps {
  onBackToHome?: () => void;
}

export const AIPracticePage: React.FC<AIPracticePageProps> = () => {
  // Configuration State
  const [subject, setSubject] = useState<string>('Databases');
  const [topic, setTopic] = useState<string>('Any Topic');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Medium');
  const [questionType, setQuestionType] = useState<QuestionType | 'Mixed'>('Mixed');
  const [questionCount, setQuestionCount] = useState<3 | 5>(3);

  // Practice Session State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingStageIndex, setLoadingStageIndex] = useState<number>(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Submission & Results State
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<IAIPracticeSessionSubmitData | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Server-Side Session Cache & Recovery State (Zero LocalStorage)
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(false);
  const [restorationMessage, setRestorationMessage] = useState<string | null>(null);
  const progressSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transparency State
  const [showTransparency, setShowTransparency] = useState<boolean>(false);

  // Loading animation timer
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL Session Pointer Helpers (Zero Local Storage - Pointer Only in URL)
  const getSessionIdFromUrl = (): string | null => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let id = urlParams.get('session');
      if (!id && window.location.hash.includes('session=')) {
        const hashPart = window.location.hash.split('?')[1] || '';
        const hashParams = new URLSearchParams(hashPart);
        id = hashParams.get('session');
      }
      return id ? id.trim() : null;
    } catch (_) {
      return null;
    }
  };

  const updateUrlSessionId = (id: string | null) => {
    try {
      const newUrl = new URL(window.location.href);
      if (id) {
        newUrl.searchParams.set('session', id);
      } else {
        newUrl.searchParams.delete('session');
      }
      window.history.replaceState({}, '', newUrl.toString());
    } catch (_) {}
  };

  // Restore Active Session from Server-Side Cache on Page Load / Refresh
  useEffect(() => {
    let isMounted = true;
    const urlSessionId = getSessionIdFromUrl();
    if (!urlSessionId) return;

    const restoreSession = async () => {
      setIsRestoringSession(true);
      try {
        const res = await api.getPracticeSession(urlSessionId);
        if (isMounted && res.success && res.data) {
          const sData = res.data;
          setSessionId(sData.sessionId);
          setQuestions(sData.questions || []);
          if (sData.config) {
            if (sData.config.subject) setSubject(sData.config.subject);
            if (sData.config.topic) setTopic(sData.config.topic);
            if (sData.config.difficulty) setDifficulty(sData.config.difficulty);
            if (sData.config.questionType) setQuestionType(sData.config.questionType);
            if (sData.config.questionCount) setQuestionCount(sData.config.questionCount);
          }
          setAnswers(sData.answers || {});
          setCurrentIndex(typeof sData.currentIndex === 'number' ? sData.currentIndex : 0);
          if (sData.submitted && sData.submissionResult) {
            setSubmissionResult(sData.submissionResult);
          }
          setRestorationMessage('Active practice session restored from server cache.');
          setTimeout(() => {
            if (isMounted) setRestorationMessage(null);
          }, 4000);
        } else {
          updateUrlSessionId(null);
        }
      } catch (err: any) {
        if (isMounted) {
          updateUrlSessionId(null);
          setGenerationError('Previous session expired or was not found. You can configure and start a fresh session.');
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Live Progress Caching Sync: Auto-sync answers and current index to Server Cache (350ms debounce)
  useEffect(() => {
    if (!sessionId || submissionResult || isSubmittingQuiz || isRestoringSession) return;

    if (progressSyncTimeoutRef.current) {
      clearTimeout(progressSyncTimeoutRef.current);
    }

    progressSyncTimeoutRef.current = setTimeout(() => {
      api.updatePracticeSessionProgress(sessionId, {
        answers,
        currentIndex,
      }).catch((err) => {
        console.warn('Live progress cache sync notice:', err?.message);
      });
    }, 350);

    return () => {
      if (progressSyncTimeoutRef.current) {
        clearTimeout(progressSyncTimeoutRef.current);
      }
    };
  }, [sessionId, answers, currentIndex, submissionResult, isSubmittingQuiz, isRestoringSession]);

  // Load topics whenever selected subject changes
  useEffect(() => {
    let isMounted = true;
    const loadTopics = async () => {
      try {
        const topics = await api.getTopics(subject);
        if (isMounted) {
          setAvailableTopics(topics);
          setTopic('Any Topic');
        }
      } catch (err) {
        console.error('Failed to load topics for subject:', err);
      }
    };
    loadTopics();
    return () => {
      isMounted = false;
    };
  }, [subject]);

  // Sequential loading status updates
  useEffect(() => {
    if (isGenerating) {
      setLoadingStageIndex(0);
      const stageIntervals = [3000, 4000, 5000];
      let currentStage = 0;

      const scheduleNextStage = () => {
        if (currentStage < LOADING_STAGES.length - 1) {
          const timeout = stageIntervals[currentStage] || 3500;
          loadingTimerRef.current = setTimeout(() => {
            currentStage++;
            setLoadingStageIndex(currentStage);
            scheduleNextStage();
          }, timeout);
        }
      };

      scheduleNextStage();
    } else {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    }

    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, [isGenerating]);

  // Generate Multi-Question Session
  const handleGenerateSession = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);
    setSessionId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setSubmissionResult(null);
    setSubmissionError(null);
    setShowConfirmModal(false);

    const config: IAIPracticeSessionConfig = {
      subject,
      topic,
      difficulty,
      questionType,
      questionCount,
    };

    try {
      const response = await api.createPracticeSession(config);

      if (response.success && response.sessionId && Array.isArray(response.questions) && response.questions.length > 0) {
        setSessionId(response.sessionId);
        setQuestions(response.questions);
        setCurrentIndex(0);
        updateUrlSessionId(response.sessionId);
      } else {
        setGenerationError(
          response.error || "We couldn't generate a complete reliable set. Try again or adjust your settings."
        );
      }
    } catch (err: any) {
      console.error('AI Practice Session Generation Error:', err);
      setGenerationError(
        err.message || 'Unable to connect to AI practice service. Please check backend status.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Record student answer for current question
  const handleAnswerSelect = (questionId: string, value: any) => {
    if (submissionResult || isSubmittingQuiz) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // Toggle MSQ Option
  const handleToggleMSQOption = (questionId: string, optionId: string) => {
    if (submissionResult || isSubmittingQuiz) return;
    const currentList: string[] = Array.isArray(answers[questionId]) ? answers[questionId] : [];
    const updated = currentList.includes(optionId)
      ? currentList.filter((id) => id !== optionId)
      : [...currentList, optionId].sort();
    handleAnswerSelect(questionId, updated);
  };

  // Check if a question is answered
  const isQuestionAnswered = (qId: string) => {
    const val = answers[qId];
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  // Submit Session Quiz
  const handleSubmitQuiz = async (forceSubmit = false) => {
    if (!sessionId || isSubmittingQuiz || submissionResult) return;

    // Check for unanswered questions
    const unansweredCount = questions.filter((q) => !isQuestionAnswered(q.id)).length;
    if (unansweredCount > 0 && !forceSubmit) {
      setShowConfirmModal(true);
      return;
    }

    setShowConfirmModal(false);
    setIsSubmittingQuiz(true);
    setSubmissionError(null);

    try {
      const response = await api.submitPracticeSession(sessionId, answers);
      if (response.success && response.data) {
        setSubmissionResult(response.data);
      } else {
        setSubmissionError(response.error || 'Failed to evaluate practice session.');
      }
    } catch (err: any) {
      console.error('Submission failed:', err);
      setSubmissionError(err.message || 'Failed to submit practice session. Please try again.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Reset to create another session
  const handleStartNewSession = () => {
    updateUrlSessionId(null);
    setSessionId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setSubmissionResult(null);
    setSubmissionError(null);
    setGenerationError(null);
    setShowConfirmModal(false);
  };

  const currentQ = questions[currentIndex] || null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-brand-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              AI Practice Session
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-violet-950/80 text-violet-300 border border-violet-700/60 rounded-full">
                Checkpoint 4B
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Multi-question practice sessions authored on-demand by Groq (Llama 3.3 70B) & verified against official GATE patterns
            </p>
          </div>
        </div>
      </div>

      {/* Restoring Session from Server Cache Indicator */}
      {isRestoringSession && (
        <div className="bg-slate-900/90 border border-violet-500/30 rounded-2xl p-8 mb-8 text-center shadow-xl backdrop-blur-sm animate-pulse">
          <div className="w-12 h-12 mx-auto mb-3.5 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Restoring Practice Session...</h3>
          <p className="text-xs text-slate-400 font-mono">
            Retrieving active test questions and live progress from server cache
          </p>
        </div>
      )}

      {/* Restoration Success Notice */}
      {restorationMessage && (
        <div className="mb-6 p-3.5 bg-violet-950/60 border border-violet-700/50 rounded-xl flex items-center justify-between text-xs text-violet-200 shadow-md">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
            <span>{restorationMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestorationMessage(null)}
            className="text-violet-400 hover:text-white transition p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. CONFIGURATION SCREEN (shown when no active session)         */}
      {/* ------------------------------------------------------------- */}
      {!sessionId && !submissionResult && !isRestoringSession && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center space-x-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
              <Sliders className="w-4 h-4 text-violet-400" />
              <span>Session Specifications</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Bounded Retries • Ephemeral Session • Anti-Leak Safeguard
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Subject */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-medium">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition cursor-pointer"
              >
                {TECHNICAL_GATE_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-medium">Topic</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition cursor-pointer"
              >
                <option value="Any Topic">Any Topic</option>
                {availableTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-medium">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition cursor-pointer"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-medium">Question Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition cursor-pointer"
              >
                <option value="Mixed">Mixed (MCQ + MSQ + NAT)</option>
                <option value="MCQ">MCQ (Single Choice)</option>
                <option value="MSQ">MSQ (Multiple Select)</option>
                <option value="NAT">NAT (Numerical Answer)</option>
              </select>
            </div>

            {/* Number of Questions */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 font-medium">Question Count</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value) as 3 | 5)}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition cursor-pointer"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
              </select>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Controlled concurrency (max 2) • In-session duplicate protection</span>
            </div>

            <button
              type="button"
              onClick={handleGenerateSession}
              disabled={isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer font-sans"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Set...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Practice Set</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading Progress State */}
      {isGenerating && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 mb-8 text-center shadow-xl backdrop-blur-sm animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-violet-950/60 border border-violet-800/80 mx-auto mb-4 flex items-center justify-center">
            <Zap className="w-6 h-6 text-violet-400 animate-bounce" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">
            Authoring & Verifying Practice Set
          </h3>
          <p className="text-xs font-mono text-violet-300 min-h-[20px] transition-all">
            {LOADING_STAGES[loadingStageIndex]}
          </p>
          <div className="max-w-xs mx-auto mt-6 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full transition-all duration-700 ease-out"
              style={{
                width: `${((loadingStageIndex + 1) / LOADING_STAGES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Generation Error State */}
      {generationError && !isGenerating && (
        <div className="bg-rose-950/30 border border-rose-800/80 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-start space-x-3.5">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-200 mb-1">
                Session Generation Notice
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                {generationError}
              </p>
              <button
                type="button"
                onClick={handleGenerateSession}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-900/50 hover:bg-rose-900/80 text-rose-200 border border-rose-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. ACTIVE PRACTICE SCREEN (Questions 1..N with navigation)    */}
      {/* ------------------------------------------------------------- */}
      {sessionId && !submissionResult && currentQ && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm mb-8">
          {/* Top Session Bar: Question Navigator & Submit Quiz */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono font-bold text-white">
                Question {currentIndex + 1} of {questions.length}
              </span>

              {/* Compact Question Navigator */}
              <div className="flex items-center space-x-1.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = isQuestionAnswered(q.id);

                  let btnStyle = 'bg-slate-850 text-slate-400 border-slate-700 hover:border-slate-500';
                  if (isAnswered) {
                    btnStyle = 'bg-indigo-950 text-indigo-300 border-indigo-600 font-semibold';
                  }
                  if (isCurrent) {
                    btnStyle = 'bg-violet-600 text-white border-violet-400 font-bold ring-2 ring-violet-500/50';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                      title={`Jump to Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unanswered)'}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Always Visible Submit Quiz Button */}
            <button
              type="button"
              onClick={() => handleSubmitQuiz(false)}
              disabled={isSubmittingQuiz}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmittingQuiz ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Quiz</span>
                </>
              )}
            </button>
          </div>

          {/* Badges Bar */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase bg-violet-950/80 text-violet-300 border border-violet-700/60 shadow-sm">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span>AI Generated Practice Question</span>
              </span>

              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                {currentQ.subject}
              </span>

              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                  currentQ.difficulty === 'Easy'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : currentQ.difficulty === 'Hard'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                    : 'bg-amber-950/60 text-amber-300 border-amber-800'
                }`}
              >
                {currentQ.difficulty}
              </span>

              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
                {currentQ.questionType}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-700/50" title="Your test progress is automatically cached and synchronized to the server">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Server Synced</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60">
                {currentQ.topic}
              </span>
            </div>
          </div>

          {/* Question Text Body */}
          <div className="p-6 md:p-8">
            <div className="text-base md:text-lg leading-relaxed text-slate-100 font-normal mb-6 whitespace-pre-line tracking-wide">
              {currentQ.question}
            </div>

            {/* Official Figure / Schematic Diagram */}
            {currentQ.imageUrl && (
              <div className="my-6 flex flex-col items-center justify-center p-4 bg-slate-950/70 rounded-xl border border-slate-800">
                <img
                  src={currentQ.imageUrl}
                  alt={`Figure for Question ${currentQ.questionNumber || ''}`}
                  className="max-h-[400px] max-w-full rounded-lg object-contain shadow-md border border-slate-700/60 bg-white p-2"
                  loading="lazy"
                />
                <span className="text-[11px] font-mono text-slate-400 mt-2">
                  Official Examination Figure • GATE {currentQ.year || ''}
                </span>
              </div>
            )}

            {/* Interactions by Question Type */}
            {currentQ.questionType === 'MCQ' && (
              <div className="space-y-3 mb-8">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  Select one option:
                </div>
                {(currentQ.options || []).map((opt) => {
                  const isSelected = answers[currentQ.id] === opt.id;
                  let containerStyles =
                    'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850/80 text-slate-200';
                  let badgeStyles = 'bg-slate-800 text-slate-300 border-slate-700';

                  if (isSelected) {
                    containerStyles =
                      'bg-violet-950/40 border-violet-500 shadow-glow text-white ring-1 ring-violet-500';
                    badgeStyles = 'bg-violet-600 text-white font-bold border-violet-400';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleAnswerSelect(currentQ.id, opt.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start space-x-3.5 cursor-pointer ${containerStyles}`}
                    >
                      <div
                        className={`w-8 h-8 flex-shrink-0 rounded-lg border flex items-center justify-center font-mono text-sm transition-all duration-200 ${badgeStyles}`}
                      >
                        {opt.id}
                      </div>
                      <div className="flex-1 pt-0.5 font-medium leading-relaxed tracking-normal">
                        {opt.text}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQ.questionType === 'MSQ' && (
              <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Select all correct options:
                  </div>
                  <span className="text-[11px] font-mono text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/40">
                    Exact complete set required (No partial credit)
                  </span>
                </div>

                {(currentQ.options || []).map((opt) => {
                  const currentList: string[] = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : [];
                  const isSelected = currentList.includes(opt.id);

                  let containerStyles =
                    'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850/80 text-slate-200';
                  let badgeStyles = 'bg-slate-800 text-slate-300 border-slate-700';

                  if (isSelected) {
                    containerStyles =
                      'bg-violet-950/40 border-violet-500 shadow-glow text-white ring-1 ring-violet-500';
                    badgeStyles = 'bg-violet-600 text-white font-bold border-violet-400';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleMSQOption(currentQ.id, opt.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start space-x-3.5 cursor-pointer ${containerStyles}`}
                    >
                      <div
                        className={`w-8 h-8 flex-shrink-0 rounded-lg border flex items-center justify-center font-mono text-sm transition-all duration-200 ${badgeStyles}`}
                      >
                        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : opt.id}
                      </div>
                      <div className="flex-1 pt-0.5 font-medium leading-relaxed tracking-normal">
                        {opt.text}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQ.questionType === 'NAT' && (
              <div className="mb-8 max-w-md">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  Enter Numerical Answer (Integer or Decimal):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 42 or 3.14"
                    value={answers[currentQ.id] ?? ''}
                    onChange={(e) => handleAnswerSelect(currentQ.id, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base text-slate-100 font-mono focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                  />
                </div>
                <p className="text-[11px] font-mono text-slate-500 mt-2">
                  Accepted with numerical tolerance. Rounding evaluated server-side.
                </p>
              </div>
            )}

            {/* Submission Error Alert */}
            {submissionError && (
              <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-between text-rose-200 text-xs">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{submissionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubmitQuiz(true)}
                  disabled={isSubmittingQuiz}
                  className="ml-3 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-100 font-semibold transition cursor-pointer"
                >
                  Retry Submit
                </button>
              </div>
            )}

            {/* Bottom Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="text-xs font-mono text-slate-400">
                {isQuestionAnswered(currentQ.id) ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Answer saved
                  </span>
                ) : (
                  <span className="text-slate-500">Unanswered (can be skipped)</span>
                )}
              </div>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmitQuiz(false)}
                  disabled={isSubmittingQuiz}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Finish & Submit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal when Submitting with Unanswered Questions */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start space-x-3.5 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  Unanswered Questions Remaining
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  You have{' '}
                  <strong className="text-amber-400">
                    {questions.filter((q) => !isQuestionAnswered(q.id)).length}
                  </strong>{' '}
                  unanswered question(s). Are you sure you want to submit your quiz now?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Keep Practicing
              </button>
              <button
                type="button"
                onClick={() => handleSubmitQuiz(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. RESULT & REVIEW SCREEN (shown after quiz submission)       */}
      {/* ------------------------------------------------------------- */}
      {submissionResult && (
        <div className="space-y-8">
          {/* Summary Banner Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-2xl shadow-lg ${
                    submissionResult.percentage >= 60
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60 shadow-emerald-900/30'
                      : 'bg-amber-950 text-amber-400 border border-amber-700/60 shadow-amber-900/30'
                  }`}
                >
                  {submissionResult.percentage}%
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Practice Set Results
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    {submissionResult.correct} of {submissionResult.total} questions answered correctly
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartNewSession}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Start New Session</span>
              </button>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-center">
                <div className="text-xl sm:text-2xl font-black text-emerald-400">
                  {submissionResult.correct}
                </div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mt-1">
                  Correct
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-center">
                <div className="text-xl sm:text-2xl font-black text-rose-400">
                  {submissionResult.incorrect}
                </div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mt-1">
                  Incorrect
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-center">
                <div className="text-xl sm:text-2xl font-black text-amber-400">
                  {submissionResult.unanswered}
                </div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mt-1">
                  Unanswered
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-center">
                <div className="text-xl sm:text-2xl font-black text-brand-400">
                  {submissionResult.attempted > 0
                    ? Math.round((submissionResult.correct / submissionResult.attempted) * 100)
                    : 0}
                  %
                </div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mt-1">
                  Attempt Accuracy
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Question Review Cards */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-violet-400" />
              <span>Detailed Question Review</span>
            </h3>

            {submissionResult.results.map((item, idx) => {
              const isCorrect = item.isCorrect;
              const isAttempted = item.isAttempted;

              return (
                <div
                  key={item.questionId}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm"
                >
                  {/* Review Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono font-bold text-white">
                        Q.{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {item.questionType}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800/60 text-slate-400 border border-slate-700/60">
                        {item.subject} • {item.topic}
                      </span>
                    </div>

                    {/* Status Banner */}
                    <div>
                      {isAttempted && isCorrect && (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/70">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Correct</span>
                        </span>
                      )}
                      {isAttempted && !isCorrect && (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-700/70">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Incorrect</span>
                        </span>
                      )}
                      {!isAttempted && (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-700/70">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Unanswered</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Stem */}
                  <div className="text-base text-slate-100 font-normal mb-6 whitespace-pre-line leading-relaxed">
                    {item.question}
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[11px] font-mono uppercase text-slate-400 mb-1">
                        Your Answer:
                      </div>
                      <div className="text-sm font-semibold text-slate-200">
                        {!isAttempted ? (
                          <span className="text-slate-500 italic">Not Attempted</span>
                        ) : Array.isArray(item.userAnswer) ? (
                          item.userAnswer.join(', ')
                        ) : (
                          String(item.userAnswer)
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[11px] font-mono uppercase text-slate-400 mb-1">
                        Correct Answer:
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 font-mono">
                        {Array.isArray(item.correctAnswer)
                          ? item.correctAnswer.join(', ')
                          : String(item.correctAnswer)}
                      </div>
                    </div>
                  </div>

                  {/* Step-by-Step Explanation */}
                  <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-900/40">
                    <div className="flex items-center space-x-2 text-xs font-mono font-semibold text-violet-300 uppercase tracking-wider mb-2">
                      <Lightbulb className="w-4 h-4 text-violet-400" />
                      <span>Verified Step-by-Step Solution</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {item.explanation}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Verification Transparency Panel */}
      <div className="mt-8 bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setShowTransparency((prev) => !prev)}
          className="w-full p-4 flex items-center justify-between text-left text-xs font-mono text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold uppercase tracking-wider">
              Verification & Originality Architecture
            </span>
          </div>
          {showTransparency ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTransparency && (
          <div className="p-4 pt-0 border-t border-slate-800/60 text-xs text-slate-300 space-y-2 leading-relaxed">
            <p>
              • <strong>Official PYQ Grounding:</strong> Questions are conditioned on real, enriched GATE questions retrieved from the official corpus.
            </p>
            <p>
              • <strong>Multi-Question Concurrency:</strong> Generation runs with bounded concurrency (max 2 parallel requests) to protect API resources.
            </p>
            <p>
              • <strong>Same-Session Duplicate Protection:</strong> Questions within the same session are checked against both reference PYQs and earlier accepted session questions.
            </p>
            <p>
              • <strong>Zero Client Answer Leakage:</strong> Answers and explanations are evaluated strictly server-side and never transmitted until quiz submission.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
