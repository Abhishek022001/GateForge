import React from 'react';
import { Cpu, Terminal, Compass, CheckCircle2, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentView: 'home' | 'practice' | 'ai-practice';
  onNavigate: (view: 'home' | 'practice' | 'ai-practice') => void;
  apiConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  apiConnected = true,
}) => {
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

        {/* Navigation & Status */}
        <div className="flex items-center space-x-3 sm:space-x-4">
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

          {/* Engine Status indicator */}
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            {apiConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-400">Core Engine:</span>
                <span className="text-emerald-400 font-medium">Ready</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-400">Core Engine:</span>
                <span className="text-amber-400 font-medium">Connecting</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
