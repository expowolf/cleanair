/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, getDocFromServer, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { UserProfile, OperationType } from './types';
import { handleFirestoreError, cleanObject } from './lib/firestore';
import Onboarding from './components/Onboarding';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Stats from './components/Stats';
import QuitPlan from './components/QuitPlan';
import Community from './components/Community';
import Learn from './components/Learn';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { Mail, Lock, User as UserIcon, ArrowLeft } from 'lucide-react';
import { BirdLogo } from './components/Branding';

import { Routes, Route, useLocation } from 'react-router-dom';

// Defined outside App so React never remounts it between renders (would reset input focus).
function Shell({ children, centered }: { children: React.ReactNode; centered?: boolean }) {
  return (
    <div className={`h-[100dvh] w-full bg-[#111] text-charcoal md:flex md:items-center md:justify-center md:p-8 ${centered ? 'flex items-center justify-center p-4' : ''}`}>
      <Toaster position="top-center" richColors theme="light" />
      <div className="relative bg-background w-full h-[100dvh] flex flex-col overflow-hidden md:w-[390px] md:h-[844px] md:rounded-[60px] md:ring-[12px] md:ring-[#333] md:shadow-[0_0_100px_rgba(0,0,0,0.5)]">
        <div className="hidden md:flex absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-[#333] rounded-b-[20px] z-[60] items-center justify-center">
          <div className="w-10 h-1 bg-white/10 rounded-full" />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Sync activeTab with route if needed
  }, [location]);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (loading && !user) setLoading(false);
    }, 15000);

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err) {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          setError('Firebase connection failed. Please check your configuration.');
        }
      }
    }
    testConnection();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Login failed', err);
      setError('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAuthError('Check your email to confirm your account, then sign in.');
        }
        // Note: profile is created by Onboarding once the user is authenticated.
        // We don't write to Firestore here because the Supabase session does not
        // satisfy Firestore security rules.
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setAuthError('Password reset email sent!');
        setAuthMode('login');
      }
    } catch (err: any) {
      console.error('Auth failed', err);
      setAuthError(err.message ?? 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (u: User) => {
    // Read localStorage first so users get into the app immediately even when
    // Firestore reads/writes are blocked by rules.
    try {
      const cached = localStorage.getItem(`profile:${u.id}`);
      if (cached) setProfile(JSON.parse(cached) as UserProfile);
    } catch {}

    try {
      const docRef = doc(db, 'users', u.id);
      const docSnap = await Promise.race([
        getDoc(docRef),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      if (docSnap && (docSnap as any).exists?.()) {
        const data = (docSnap as any).data() as UserProfile;
        setProfile(data);
        try { localStorage.setItem(`profile:${u.id}`, JSON.stringify(data)); } catch {}
      }
    } catch (err) {
      console.error('Fetch profile failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.id),
      (d) => {
        if (d.exists()) setProfile(d.data() as UserProfile);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.id}`)
    );
    return () => unsubscribe();
  }, [user]);

  const renderContent = () => {
    if (!profile) return null;
    const patchProfile = (patch: Partial<UserProfile>) =>
      setProfile((p) => (p ? { ...p, ...patch } : p));
    switch (activeTab) {
      case 'home': return <Stats profile={profile} onNavigate={setActiveTab} />;
      case 'plan': return <QuitPlan profile={profile} />;
      case 'learn': return <Dashboard profile={profile} onProfileUpdate={patchProfile} />;
      case 'community': return <Community profile={profile} onProfileUpdate={patchProfile} />;
      case 'settings': return <Dashboard profile={profile} onProfileUpdate={patchProfile} />;
      default: return <Stats profile={profile} onNavigate={setActiveTab} />;
    }
  };

  if (loading) {
    return (
      <Shell centered>
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 bg-sage/20 rounded-[40px] flex items-center justify-center text-sage mb-8 shadow-inner"
          >
            <BirdLogo className="w-12 h-12" />
          </motion.div>
          <h2 className="text-xl font-black text-charcoal uppercase tracking-tighter mb-2">CleanAIr</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.4em] animate-pulse">Initializing Protocol...</p>
          {error && <p className="mt-6 text-[10px] text-red-500 font-black uppercase tracking-widest">{error}</p>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="*" element={
          <div className="flex-1 flex flex-col h-full">
            {!user ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white overflow-y-auto no-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={authMode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full max-w-sm pt-10"
                  >
                    <div className="mb-10">
                      <div className="text-sage drop-shadow-md">
                        <BirdLogo className="w-24 h-24 mx-auto mb-6" />
                      </div>
                      <h1 className="text-3xl font-black text-charcoal mb-2 tracking-tight uppercase">
                        {authMode === 'login' ? 'Auth Required' : authMode === 'signup' ? 'Initialization' : 'Recovery'}
                      </h1>
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">
                        {authMode === 'login' ? 'Protocol Delta-9 Authentication' : authMode === 'signup' ? 'Establish Secure Node' : 'Transmission Reset'}
                      </p>
                    </div>

                    <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 mb-8">
                      {authMode === 'signup' && (
                        <div className="relative">
                          <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="text"
                            placeholder="FULL NAME"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full pl-14 pr-6 py-5 bg-gray-50 rounded-[24px] border-none text-xs font-bold focus:ring-2 focus:ring-sage transition-all placeholder:text-gray-300"
                          />
                        </div>
                      )}
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="email"
                          placeholder="EMAIL ADDRESS"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full pl-14 pr-6 py-5 bg-gray-50 rounded-[24px] border-none text-xs font-bold focus:ring-2 focus:ring-sage transition-all placeholder:text-gray-300"
                        />
                      </div>
                      {authMode !== 'forgot' && (
                        <div className="relative">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="password"
                            placeholder="SECURITY KEY"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full pl-14 pr-6 py-5 bg-gray-50 rounded-[24px] border-none text-xs font-bold focus:ring-2 focus:ring-sage transition-all placeholder:text-gray-300"
                          />
                        </div>
                      )}

                      {authError && <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-2">{authError}</p>}

                      <button
                        type="submit"
                        className="w-full py-5 bg-charcoal text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-charcoal/20 active:scale-95 transition-all mt-4"
                      >
                        {authMode === 'login' ? 'Access Portal' : authMode === 'signup' ? 'Finalize Profile' : 'Send Link'}
                      </button>
                    </form>

                    {authMode === 'login' && (
                      <div className="flex flex-col gap-6">
                        <button
                          onClick={handleGoogleLogin}
                          className="w-full py-5 bg-white border border-gray-100 text-charcoal rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all"
                        >
                          <BirdLogo className="w-5 h-5 text-sage" />
                          Google Sync
                        </button>

                        <button
                          onClick={() => setAuthMode('forgot')}
                          className="text-[10px] text-gray-300 font-black uppercase tracking-widest hover:text-sage transition-colors"
                        >
                          Reset Permissions?
                        </button>
                      </div>
                    )}

                    <div className="mt-12 pt-8 border-t border-gray-50">
                      {authMode === 'login' ? (
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                          New operative?{' '}
                          <button onClick={() => setAuthMode('signup')} className="text-sage font-black">Register</button>
                        </p>
                      ) : (
                        <button onClick={() => setAuthMode('login')} className="flex items-center justify-center gap-2 text-xs text-gray-400 font-black uppercase tracking-widest mx-auto">
                          <ArrowLeft size={16} /> Identity Verification
                        </button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : !profile || !profile.onboardingComplete ? (
              <div className="flex-1 bg-white overflow-hidden pt-10">
                <Onboarding onComplete={(newProfile) => setProfile(newProfile)} />
              </div>
            ) : (
              <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    {renderContent()}
                  </motion.div>
                </AnimatePresence>
              </Layout>
            )}
          </div>
        } />
      </Routes>
    </Shell>
  );
}
