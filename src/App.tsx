/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, onSnapshot, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
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
import { Toaster, toast } from 'sonner';
import { Loader2, AlertCircle, LogIn, Mail, Lock, User as UserIcon, ArrowLeft } from 'lucide-react';
import { BirdLogo } from './components/Branding';

import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Sync activeTab with route if needed, but for now we'll just keep it as is
    // except for explicit routes like /test-key
  }, [location]);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (loading && !user) {
        setLoading(false);
      }
    }, 15000);

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setError("Firebase connection failed. Please check your configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
      setError("Failed to sign in with Google. Please try again.");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create initial profile
        const initialProfile: Partial<UserProfile> = {
          uid: userCredential.user.uid,
          email: email,
          displayName: name,
          onboardingComplete: false
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), cleanObject(initialProfile));
      } else if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (authMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setAuthError("Password reset email sent!");
        setAuthMode('login');
      }
    } catch (err: any) {
      console.error("Auth failed", err);
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    } catch (err) {
      console.error("Fetch profile failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener for profile changes
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  const renderContent = () => {
    if (!profile) return null;
    switch (activeTab) {
      case 'home': return <Stats profile={profile} onNavigate={setActiveTab} />;
      case 'plan': return <QuitPlan profile={profile} />;
      case 'learn': return <Learn />;
      case 'community': return <Community profile={profile} />;
      case 'settings': return <Dashboard profile={profile} />;
      default: return <Stats profile={profile} onNavigate={setActiveTab} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
        <div className="w-[375px] h-[812px] bg-white rounded-[60px] ring-[12px] ring-[#333] shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-12 text-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 bg-sage/20 rounded-[40px] flex items-center justify-center text-sage mb-8 shadow-inner"
          >
            <BirdLogo className="w-12 h-12" />
          </motion.div>
          <h2 className="text-xl font-black text-charcoal uppercase tracking-tighter mb-2">CleanAIr</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.4em] animate-pulse">Initializing Protocol...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 md:p-8 text-charcoal">
      <Toaster position="top-center" richColors theme="light" />
      {/* Centered Mockup Container */}
      <div className="w-[375px] h-[812px] bg-background rounded-[60px] ring-[12px] ring-[#333] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col scale-90 sm:scale-100 origin-center">
        {/* Notch - Modern style */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-[#333] rounded-b-[20px] z-[60] flex items-center justify-center">
          <div className="w-10 h-1 bg-white/10 rounded-full" />
        </div>

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
                      className="w-full pt-10"
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
                            New operative? {' '}
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
      </div>
    </div>
  );
}

