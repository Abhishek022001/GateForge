import React, { useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { PracticePage } from './pages/PracticePage';
import { AIPracticePage } from './pages/AIPracticePage';
import { api } from './services/api';

export const App: React.FC = () => {
  const getInitialView = (): 'home' | 'practice' | 'ai-practice' => {
    const path = window.location.pathname;
    if (path === '/ai-practice') return 'ai-practice';
    if (path === '/practice') return 'practice';
    return 'home';
  };

  const [currentView, setCurrentView] = useState<'home' | 'practice' | 'ai-practice'>(getInitialView);
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  // Sync view navigation with browser history
  const handleNavigate = (view: 'home' | 'practice' | 'ai-practice') => {
    setCurrentView(view);
    const targetPath = view === 'ai-practice' ? '/ai-practice' : view === 'practice' ? '/practice' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/ai-practice') setCurrentView('ai-practice');
      else if (path === '/practice') setCurrentView('practice');
      else setCurrentView('home');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Periodic health check with backend and load visitor count
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.getHealth();
        setApiConnected(true);
      } catch (err) {
        setApiConnected(false);
      }
    };
    checkBackend();

    api
      .getStats()
      .then((data) => {
        setVisitorCount(data.peopleVisitedSoFar ?? data.uniqueVisitors ?? 1);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-brand-500/30 selection:text-brand-200">
      {/* Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        apiConnected={apiConnected}
        visitorCount={visitorCount ?? undefined}
      />

      {/* Main Content Area */}
      <main className="flex-grow">
        {currentView === 'home' ? (
          <HomePage
            onStartAIPractice={() => handleNavigate('ai-practice')}
            onExploreQuestionBank={() => handleNavigate('practice')}
          />
        ) : currentView === 'practice' ? (
          <PracticePage onBackToHome={() => handleNavigate('home')} />
        ) : (
          <AIPracticePage onBackToHome={() => handleNavigate('home')} />
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
