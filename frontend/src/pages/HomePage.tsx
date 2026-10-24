import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Database,
  Cpu,
  GitBranch,
  Network,
  Binary,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Search,
  FileCode2,
  CopyCheck,
  Activity,
  Server,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';

interface HomePageProps {
  onStartAIPractice: () => void;
  onExploreQuestionBank: () => void;
}

interface IStatsData {
  totalQuestions: number;
  officialPyqs: number;
  analyzedQuestions: number;
  subjectsCovered: number;
  practiceModes: number;
  uniqueVisitors?: number;
  peopleVisitedSoFar?: number;
  totalVisits?: number;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartAIPractice,
  onExploreQuestionBank,
}) => {
  const [stats, setStats] = useState<IStatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        setStatsError(false);
        const data = await api.getStats();
        if (isMounted) {
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load system statistics:', err);
        if (isMounted) {
          setStatsError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingStats(false);
        }
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const subjects = [
    {
      name: 'Data Structures',
      desc: 'AVL Trees, Heaps, Hashing, Graph Traversals, Asymptotic Growth',
      icon: Binary,
      color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30',
    },
    {
      name: 'Algorithms',
      desc: 'Master Theorem, Dynamic Programming, Greedy, Graph Algorithms',
      icon: GitBranch,
      color: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30',
    },
    {
      name: 'Operating Systems',
      desc: 'Process Synchronization, Semaphores, Page Replacement, CPU Scheduling',
      icon: Cpu,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    },
    {
      name: 'DBMS',
      desc: 'Relational Algebra, Normalization (3NF, BCNF), Serializability, SQL',
      icon: Database,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      name: 'Computer Networks',
      desc: 'Sliding Window (SR, GBN), Subnetting, TCP/IP, Congestion Control',
      icon: Network,
      color: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30',
    },
    {
      name: 'Theory of Computation',
      desc: 'DFA Minimization, Regular Languages, CFG, Turing Machines',
      icon: Layers,
      color: 'from-violet-500/20 to-fuchsia-500/20 text-violet-400 border-violet-500/30',
    },
  ];

  const pipelineSteps = [
    {
      step: '01',
      title: 'Official GATE PYQs',
      desc: 'Authoritative question papers ingested from official organizing institute archives.',
      icon: BookOpen,
      color: 'text-sky-400 border-sky-500/30 bg-sky-950/40',
    },
    {
      step: '02',
      title: 'Extraction & Key Mapping',
      desc: 'Automated parsing of questions, options, and official answer-key mapping (MCQ, MSQ, NAT).',
      icon: FileCode2,
      color: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/40',
    },
    {
      step: '03',
      title: 'Structured Question Bank',
      desc: 'Strict schema validation, normalized mathematical notation, and provenance tracking.',
      icon: Database,
      color: 'text-blue-400 border-blue-500/30 bg-blue-950/40',
    },
    {
      step: '04',
      title: 'AI Pattern Analysis',
      desc: 'Groq (Llama 3.3 70B) analyzes reasoning types, cognitive depth, distractor patterns, and common traps.',
      icon: Sparkles,
      color: 'text-amber-400 border-amber-500/30 bg-amber-950/40',
    },
    {
      step: '05',
      title: 'Context Retrieval',
      desc: 'Dynamically selects relevant analyzed official PYQs as few-shot conceptual anchors.',
      icon: Search,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
    },
    {
      step: '06',
      title: 'Groq Model Generation',
      desc: 'Generates candidate questions conditioned on official patterns with bounded retries.',
      icon: Cpu,
      color: 'text-violet-400 border-violet-500/30 bg-violet-950/40',
    },
    {
      step: '07',
      title: 'Correctness Verification',
      desc: 'Independent semantic verifier audits mathematical correctness, unambiguous keys, and logic.',
      icon: CheckCircle2,
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40',
    },
    {
      step: '08',
      title: 'Originality Check',
      desc: 'Deterministic similarity guard catches exact copies, trivial renamings, and near-duplicates.',
      icon: CopyCheck,
      color: 'text-rose-400 border-rose-500/30 bg-rose-950/40',
    },
    {
      step: '09',
      title: 'AI Practice & Server Scoring',
      desc: 'Interactive multi-question sessions with zero answer leakage and server-side evaluation.',
      icon: ShieldCheck,
      color: 'text-teal-400 border-teal-500/30 bg-teal-950/40',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-300 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Source-Grounded AI Question Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          GATEForge
        </h1>

        <p className="text-lg sm:text-xl text-slate-200 mb-4 font-medium leading-relaxed">
          AI-powered GATE CS practice built from official previous-year question patterns.
        </p>

        <p className="text-sm sm:text-base text-slate-400 mb-8 leading-relaxed font-normal max-w-2xl mx-auto">
          Analyzes historical question patterns, cognitive skills, and distractor traps from official
          GATE examinations to generate new, verified practice problems with zero answer leakage.
        </p>

        {/* Primary & Secondary Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={onStartAIPractice}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-8 py-4 rounded-xl text-base font-bold bg-brand-500 hover:bg-brand-400 text-white shadow-xl shadow-brand-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>Start AI Practice</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onExploreQuestionBank}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-7 py-4 rounded-xl text-base font-semibold bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-slate-400" />
            <span>Explore Question Bank</span>
          </button>
        </div>
      </div>

      {/* Real Dynamically Loaded Statistics (No Hardcoded Numbers) */}
      <div className="mb-16 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <Activity className="w-4 h-4 text-brand-400" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
              Live System Statistics
            </h2>
          </div>
          <span className="inline-flex items-center space-x-1 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Synchronized</span>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Stat 1: Official PYQs */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
              Official PYQs
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {isLoadingStats ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
              ) : statsError ? (
                <span className="text-slate-500 text-lg">--</span>
              ) : (
                stats?.officialPyqs ?? 0
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">Verified GATE archive</div>
          </div>

          {/* Stat 2: Analyzed Questions */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
              Analyzed Questions
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-brand-400 font-mono">
              {isLoadingStats ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
              ) : statsError ? (
                <span className="text-slate-500 text-lg">--</span>
              ) : (
                stats?.analyzedQuestions ?? 0
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">AI concept & pattern models</div>
          </div>

          {/* Stat 3: Subjects Covered */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
              Subjects Covered
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">
              {isLoadingStats ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
              ) : statsError ? (
                <span className="text-slate-500 text-lg">--</span>
              ) : (
                stats?.subjectsCovered ?? 0
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">Core GATE CS syllabus</div>
          </div>

          {/* Stat 4: AI Practice Modes */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
              AI Practice Modes
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">
              {isLoadingStats ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
              ) : statsError ? (
                <span className="text-slate-500 text-lg">--</span>
              ) : (
                stats?.practiceModes ?? 4
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">MCQ • MSQ • NAT • Mixed</div>
          </div>
        </div>
      </div>

      {/* How It Works Architecture Pipeline Section */}
      <div className="mb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-1.5 text-xs font-mono uppercase tracking-wider text-brand-400 font-semibold mb-2">
            <Server className="w-3.5 h-3.5" />
            <span>End-to-End System Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How It Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            A 9-stage verified pipeline transforming historical official exams into high-yield, verified practice.
          </p>
        </div>

        {/* 9-Stage Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pipelineSteps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 transition-all relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg border ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono text-slate-500 font-bold">
                      Stage {item.step}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </div>

                {idx < pipelineSteps.length - 1 && (
                  <div className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                    {/* Visual subtle connector indicator */}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Curriculum Coverage Cards */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Curriculum & Disciplines
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Comprehensive question patterns covering fundamental GATE CS disciplines
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.map((subj) => {
            const Icon = subj.icon;
            return (
              <div
                key={subj.name}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-5 transition-all group"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`p-2.5 rounded-lg border bg-gradient-to-br ${subj.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-200 group-hover:text-white transition">
                    {subj.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  {subj.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
