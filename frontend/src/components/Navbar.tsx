import React, { useEffect, useState } from 'react';
import { Cpu, Terminal, Compass, CheckCircle2, Sparkles, Users, Activity } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  currentView: 'home' | 'practice' | 'ai-practice';
  onNavigate: (view: 'home' | 'practice' | 'ai-practice') => void;
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
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
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

        {/* Navigation & Visitor Component */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Live Users Highlight Badge */}
          <div
            className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 shadow-sm shadow-emerald-500/10 text-xs font-mono transition-all hover:border-emerald-500/60"
            title="Current active live users on GateForge"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity className="w-3.5 h-3.5 text-emerald-400 hidden xs:inline" />
            <span className="text-slate-300 font-sans text-xs hidden sm:inline">
              Live:
            </span>
            <span className="text-slate-300 font-sans text-xs sm:hidden">
              Live:
            </span>
            <span className="font-extrabold text-emerald-400 font-mono tracking-tight text-xs sm:text-sm">
              {liveUsersCount !== null && liveUsersCount !== undefined ? (
                Math.max(1, liveUsersCount).toLocaleString()
              ) : (
                <span className="animate-pulse">--</span>
              )}
            </span>
          </div>

          {/* People Visited So Far Highlight Badge */}
          <div
            className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/70 shadow-sm text-xs font-mono transition-all hover:border-slate-600"
            title="Total number of people visited this website so far"
          >
            <Users className="w-3.5 h-3.5 text-slate-400 hidden xs:inline" />
            <span className="text-slate-300 font-sans text-xs hidden lg:inline">
              People visited so far:
            </span>
            <span className="text-slate-300 font-sans text-xs hidden sm:inline lg:hidden">
              Visited:
            </span>
            <span className="text-slate-300 font-sans text-xs sm:hidden">
              Visited:
            </span>
            <span className="font-extrabold text-slate-200 font-mono tracking-tight text-xs sm:text-sm">
              {visitorCount !== null && visitorCount !== undefined ? (
                Math.max(1, visitorCount).toLocaleString()
              ) : (
                <span className="animate-pulse">--</span>
              )}
            </span>
          </div>

          <nav className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onNavigate('home')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'home'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => onNavigate('practice')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'practice'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Practice</span>
            </button>

            <button
              onClick={() => onNavigate('ai-practice')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                currentView === 'ai-practice'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              <span>AI Practice</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
