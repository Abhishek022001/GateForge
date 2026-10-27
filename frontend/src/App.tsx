import React, { useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { PracticePage } from './pages/PracticePage';
import { AIPracticePage } from './pages/AIPracticePage';
import { api } from './services/api';

const clientSessionId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'gf_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

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
  const [liveUsers, setLiveUsers] = useState<number | null>(null);

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

  // Periodic health check with backend, load visitor count & live presence
  useEffect(() => {
    let isMounted = true;
    let lastPing = Date.now();

    const checkBackend = async () => {
      try {
        await api.getHealth();
        if (isMounted) setApiConnected(true);
      } catch (err) {
        if (isMounted) setApiConnected(false);
      }
    };
    checkBackend();

    const fetchInitialStats = async () => {
      try {
        const data = await api.getStats(clientSessionId);
        if (isMounted) {
          setVisitorCount(data.peopleVisitedSoFar ?? data.uniqueVisitors ?? 1);
          setLiveUsers(data.liveUsers ?? 1);
        }
      } catch (_) {}
    };
    fetchInitialStats();

    // Heartbeat every 25 seconds
    const interval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        try {
          const stats = await api.sendHeartbeat(clientSessionId);
          if (isMounted) {
            if (stats.liveUsers !== undefined) setLiveUsers(stats.liveUsers);
            if (stats.peopleVisitedSoFar !== undefined) setVisitorCount(stats.peopleVisitedSoFar);
          }
          lastPing = Date.now();
        } catch (_) {}
      }
    }, 25000);

    // Refresh immediately when returning to tab if idle > 20s
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPing > 20000) {
        try {
          const stats = await api.sendHeartbeat(clientSessionId);
          if (isMounted) {
            if (stats.liveUsers !== undefined) setLiveUsers(stats.liveUsers);
            if (stats.peopleVisitedSoFar !== undefined) setVisitorCount(stats.peopleVisitedSoFar);
          }
          lastPing = Date.now();
        } catch (_) {}
      }
    };

    // Immediate unload deregistration beacon
    const handleUnload = () => {
      api.sendLeaveBeacon(clientSessionId);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      handleUnload();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-brand-500/30 selection:text-brand-200">
      {/* Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        apiConnected={apiConnected}
        visitorCount={visitorCount ?? undefined}
        liveUsersCount={liveUsers ?? undefined}
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
