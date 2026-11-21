import React, { useEffect, useState, useRef } from 'react';
import {
  Cpu,
  Terminal,
  Compass,
  Zap,
  Brain,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { api, IUserProfile, IAuthConfig } from '../services/api';

interface NavbarProps {
  currentView: 'home' | 'practice' | 'ai-practice' | 'ai-tutor';
  onNavigate: (view: 'home' | 'practice' | 'ai-practice' | 'ai-tutor') => void;
  apiConnected?: boolean;
  visitorCount?: number;
  liveUsersCount?: number;
}

interface PendingAuthData {
  type: 'google' | 'demo';
  credential?: string;
  email: string;
  picture: string;
  defaultGoogleName: string;
}

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
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

  // Authentication State
  const [user, setUser] = useState<IUserProfile | null>(() => api.getStoredUser());
  const [authConfig, setAuthConfig] = useState<IAuthConfig | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Custom Username Selection Flow
  const [authStep, setAuthStep] = useState<'prompt' | 'choose-username'>('prompt');
  const [pendingAuth, setPendingAuth] = useState<PendingAuthData | null>(null);
  const [chosenUsername, setChosenUsername] = useState<string>('');

  // In-dropdown username editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

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

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setIsEditingName(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validate session on mount & fetch auth config
  useEffect(() => {
    const initAuth = async () => {
      try {
        const config = await api.getAuthConfig();
        setAuthConfig(config);
      } catch (_) {}

      const token = api.getStoredAuthToken();
      if (token) {
        try {
          const res = await api.getAuthMe(token);
          if (res?.success && res.user) {
            setUser(res.user);
            api.setStoredAuth(token, res.user);
          } else {
            api.clearStoredAuth();
            setUser(null);
          }
        } catch (_) {}
      }
    };
    initAuth();
  }, []);

  // Reset modal step when modal closes
  const closeModal = () => {
    setIsAuthModalOpen(false);
    setAuthStep('prompt');
    setPendingAuth(null);
    setChosenUsername('');
    setAuthError(null);
  };

  // Initialize Google Identity Services when modal is in prompt step
  useEffect(() => {
    if (!isAuthModalOpen || authStep !== 'prompt' || !authConfig?.configured) return;

    const setupGoogle = () => {
      const google = (window as any).google;
      if (google?.accounts?.id && googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = '';
        google.accounts.id.initialize({
          client_id: authConfig.googleClientId,
          callback: async (response: any) => {
            if (response?.credential) {
              setAuthError(null);
              // Decode token payload to get their official Google name
              const payload = decodeJwt(response.credential);
              const defaultName = payload?.name || payload?.email?.split('@')[0] || 'GATE Student';
              setPendingAuth({
                type: 'google',
                credential: response.credential,
                email: payload?.email || '',
                picture: payload?.picture || '',
                defaultGoogleName: defaultName,
              });
              setChosenUsername(defaultName);
              setAuthStep('choose-username');
            }
          },
        });
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280,
        });
      }
    };

    const timer = setTimeout(setupGoogle, 100);
    return () => clearTimeout(timer);
  }, [isAuthModalOpen, authStep, authConfig]);

  const handleStartDemo = () => {
    setAuthError(null);
    const demoGoogleName = 'GATE CS Aspirant';
    setPendingAuth({
      type: 'demo',
      email: 'student@gateforge.ai',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      defaultGoogleName: demoGoogleName,
    });
    setChosenUsername(demoGoogleName);
    setAuthStep('choose-username');
  };

  const handleConfirmLogin = async (finalUsername: string) => {
    if (!pendingAuth) return;
    setIsLoadingAuth(true);
    setAuthError(null);
    const username = (finalUsername || chosenUsername || pendingAuth.defaultGoogleName).trim();

    try {
      let res;
      if (pendingAuth.type === 'google' && pendingAuth.credential) {
        res = await api.loginWithGoogle(pendingAuth.credential, username);
      } else {
        res = await api.loginWithDemo(
          { name: username, email: pendingAuth.email, picture: pendingAuth.picture },
          username
        );
      }

      if (res.success && res.user) {
        api.setStoredAuth(res.token, res.user);
        setUser(res.user);
        closeModal();
      } else {
        setAuthError('Sign in failed. Please try again.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSaveEditedName = async () => {
    const token = api.getStoredAuthToken();
    const newName = editedName.trim();
    if (!token || !user || !newName || newName.length < 2) return;

    try {
      const res = await api.updateProfile(token, { name: newName });
      if (res.success && res.user) {
        setUser(res.user);
        api.setStoredAuth(token, res.user);
        setIsEditingName(false);
      }
    } catch (_) {}
  };

  const handleLogout = async () => {
    const token = api.getStoredAuthToken();
    if (token) {
      await api.logout(token);
    }
    api.clearStoredAuth();
    setUser(null);
    setIsDropdownOpen(false);
  };

  return (
    <>
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

          {/* Navigation & Presence & Auth */}
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

            {/* Google Authentication Pill / User Capsule */}
            <div className="relative" ref={dropdownRef}>
              {user ? (
                <div>
                  <button
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="flex items-center space-x-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 hover:border-slate-600 transition-all text-xs font-medium text-slate-200 shadow-sm cursor-pointer"
                    title={user.name}
                  >
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-6 h-6 rounded-full object-cover border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-[10px]">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="max-w-[80px] sm:max-w-[110px] truncate hidden xs:inline font-sans font-semibold">
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-3.5 text-xs animate-in fade-in zoom-in-95 duration-100 backdrop-blur-lg">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
                        {user.picture ? (
                          <img
                            src={user.picture}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate text-sm">{user.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* Custom Username Inline Edit */}
                      <div className="pt-2 pb-1">
                        {isEditingName ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Edit Username
                            </label>
                            <div className="flex items-center space-x-1.5">
                              <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                maxLength={50}
                                className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-brand-500/60 text-white text-xs outline-none focus:border-brand-400"
                                autoFocus
                              />
                              <button
                                onClick={handleSaveEditedName}
                                className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition cursor-pointer"
                                title="Save username"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setIsEditingName(false)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditedName(user.name);
                              setIsEditingName(true);
                            }}
                            className="w-full py-1 text-[11px] text-brand-400 hover:text-brand-300 flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center space-x-1">
                              <Pencil className="w-3 h-3" />
                              <span>Custom Username: <strong>{user.name}</strong></span>
                            </span>
                            <span className="text-[10px] text-slate-500 underline">Change</span>
                          </button>
                        )}
                      </div>

                      {/* Verified Badge */}
                      <div className="my-2.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300">
                        <span className="flex items-center space-x-1.5 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Google Verified</span>
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>

                      {/* User Stats Snippet */}
                      <div className="grid grid-cols-2 gap-2 my-2.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center font-mono">
                        <div>
                          <p className="text-[10px] text-slate-400">Questions</p>
                          <p className="text-sm font-bold text-brand-300">
                            {user.stats?.questionsAttempted || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Sessions</p>
                          <p className="text-sm font-bold text-indigo-300">
                            {user.stats?.sessionsCompleted || 0}
                          </p>
                        </div>
                      </div>

                      {/* Logout Action */}
                      <button
                        onClick={handleLogout}
                        className="w-full mt-1 px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 border border-transparent transition-all flex items-center justify-center space-x-2 font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all text-xs font-semibold text-white shadow-sm cursor-pointer group"
                  title="Sign in with Google"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Google Authentication Modal Dialog */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {authStep === 'prompt' ? (
              <>
                {/* Step 1: Initial Sign In Prompt */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <Cpu className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight text-white font-sans">
                    Welcome to GATEForge
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
                    Sign in to save your practice history, synchronize progress across devices, and unlock AI diagnostic tracking.
                  </p>
                </div>

                {authError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {authError}
                  </div>
                )}

                {/* Google Sign In Container (when Google Client ID configured) */}
                {authConfig?.configured ? (
                  <div className="flex flex-col items-center justify-center my-4">
                    <div ref={googleBtnContainerRef} className="min-h-[44px] flex items-center justify-center" />
                    <div className="relative w-full my-5 flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800"></div>
                      </div>
                      <span className="relative px-3 bg-slate-900 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                        or continue with
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* 1-Click Demo / Offline Aspirant Login */}
                <button
                  onClick={handleStartDemo}
                  disabled={isLoadingAuth}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Continue as GATE Aspirant (Demo Account)</span>
                </button>

                <p className="mt-4 text-[11px] text-center text-slate-500">
                  By continuing, you acknowledge GATEForge's focus on focused, distraction-free GATE CS preparation.
                </p>
              </>
            ) : (
              <>
                {/* Step 2: Choose Custom Username */}
                <div className="text-center mb-5">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full overflow-hidden border-2 border-brand-500/40 p-0.5 bg-slate-800 shadow-lg shadow-brand-500/10">
                    {pendingAuth?.picture ? (
                      <img
                        src={pendingAuth.picture}
                        alt="Avatar"
                        className="w-full h-full rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-brand-600 flex items-center justify-center font-bold text-white text-lg">
                        {(pendingAuth?.defaultGoogleName || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight text-white font-sans">
                    Choose Your Username
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Your Google account name is pre-filled below. You can customize how your handle appears across GATEForge.
                  </p>
                </div>

                {authError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {authError}
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Choose Username
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={chosenUsername}
                        onChange={(e) => setChosenUsername(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && chosenUsername.trim()) {
                            handleConfirmLogin(chosenUsername);
                          }
                        }}
                        placeholder="e.g. Abhishek GATE, CS_Rank1"
                        maxLength={50}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white text-sm font-sans transition-all outline-none"
                        autoFocus
                      />
                      {pendingAuth && chosenUsername !== pendingAuth.defaultGoogleName && (
                        <button
                          type="button"
                          onClick={() => setChosenUsername(pendingAuth.defaultGoogleName)}
                          className="absolute right-2.5 top-2.5 text-[11px] text-brand-400 hover:text-brand-300 transition font-mono"
                          title="Reset to Google account name"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-0.5">
                      <span>Google Account: <strong className="text-slate-300">{pendingAuth?.defaultGoogleName}</strong></span>
                      <span>{chosenUsername.length}/50</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleConfirmLogin(chosenUsername)}
                    disabled={!chosenUsername.trim() || isLoadingAuth}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingAuth ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Confirm & Continue</span>
                      </>
                    )}
                  </button>

                  {pendingAuth && chosenUsername !== pendingAuth.defaultGoogleName && (
                    <button
                      onClick={() => handleConfirmLogin(pendingAuth.defaultGoogleName)}
                      disabled={isLoadingAuth}
                      className="w-full py-2 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition cursor-pointer"
                    >
                      Use Google Name ({pendingAuth.defaultGoogleName})
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
