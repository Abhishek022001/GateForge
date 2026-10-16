import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 py-8 mt-16 text-center text-xs text-slate-500 font-mono">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-400">GATEForge</span>
          <span>—</span>
          <span>AI-Powered GATE Preparation Platform</span>
        </div>
        <div>
          <span>Phase 1 Architecture Foundation • Strict Separation of Concerns</span>
        </div>
      </div>
    </footer>
  );
};
