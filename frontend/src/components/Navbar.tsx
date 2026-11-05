import React, { useEffect, useState } from 'react';
import { Cpu, Terminal, Compass, Zap, Brain, Activity } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  currentView: 'home' | 'practice' | 'ai-practice' | 'ai-tutor';
  onNavigate: (view: 'home' | 'practice' | 'ai-practice' | 'ai-tutor') => void;
  apiConnected?: boolean;
  visitorCount?: number;
  liveUsersCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  apiConnected = true,
  visitorCount: initialVisitorCount,
  liveUsersCount: initialLiveUsersCount,
}) => {
  const [visitorCount, setVisitorCount] = useState<number | null>(
    initialVisitorCount ?? null
  );
  const [liveUsersCount, setLiveUsersCount] = useState<number | null>(
    initialLiveUsersCount ?? null
  );

  useEffect(() => {
    if (initialVisitorCount !== undefined && initialVisitorCount !== null) {
      setVisitorCount(initialVisitorCount);
    }
  }, [initialVisitorCount]);

  useEffect(() => {
    if (initialLiveUsersCount !== undefined && initialLiveUsersCount !== null) {
      setLiveUsersCount(initialLiveUsersCount);
    }
  }, [initialLiveUsersCount]);
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                GATE<span className="text-brand-400">Forge</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase bg-slate-800 text-brand-300 border border-slate-700 rounded">
                Phase 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight hidden sm:block">
              Competitive GATE CS Prep Platform
            </p>
          </div>
        </div>

        {/* Navigation & Presence */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Live Active Presence Badge */}
          <div
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono shadow-sm transition-all hover:bg-emerald-500/15"
            title="Current active live users on GateForge"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="font-bold text-emerald-400 font-mono tracking-tight text-xs">
              {liveUsersCount !== null && liveUsersCount !== undefined ? Math.max(1, liveUsersCount) : 1}
            </span>
            <span className="text-slate-400 font-sans text-[11px] hidden sm:inline">online</span>
          </div>

          <nav className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/90">
            <button
              onClick={() => onNavigate('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'home'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => onNavigate('practice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'practice'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Practice</span>
            </button>

            <button
              onClick={() => onNavigate('ai-practice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'ai-practice'
                  ? 'bg-indigo-600/30 text-indigo-200 shadow-sm border border-indigo-500/40 font-semibold'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Practice</span>
            </button>

            <button
              onClick={() => onNavigate('ai-tutor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'ai-tutor'
                  ? 'bg-violet-600/30 text-violet-200 shadow-sm border border-violet-500/40 font-semibold'
                  : 'text-slate-400 hover:text-violet-300 hover:bg-slate-800/50'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-violet-400" />
              <span>AI Tutor</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
