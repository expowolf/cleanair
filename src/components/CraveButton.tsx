import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Star, Flame, ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck, Play, Pause, ChevronRight, Wind, Heart, Brain, Zap, Volume2, VolumeX } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { handleFirestoreError, cleanObject } from '../lib/firestore';
import { OperationType, UserProfile, CravingEntry } from '../types';
import { LungsIcon } from './Branding';
import { unlockAchievement } from '../services/achievementService';
import { generateCravingSuggestion, isAIAvailable } from '../services/aiService';

const BREATHING_PHASES = [
  { text: 'Inhale', duration: 4, action: 'Focus on your nose' },
  { text: 'Hold', duration: 4, action: 'Fill your lungs' },
  { text: 'Exhale', duration: 4, action: 'Slowly let it go' },
  { text: 'Empty', duration: 3, action: 'Find the stillness' },
];

const STATIC_SUGGESTIONS = [
  { suggestion: "Do exactly 12 pushups right now", reason: "Physical exertion creates an immediate dopamine spike that mimics nicotine release." },
  { suggestion: "Drink a large glass of ice-cold water", reason: "Shocking your system with temperature change resets the trigeminal nerve and disrupts the urge." },
  { suggestion: "Read exactly one page of a physical book", reason: "Visual and tactile focus on text forces the brain to shift from subconscious craving to active processing." },
  { suggestion: "Step outside and count 5 different birds", reason: "Changing environment and focused observation breaks the routine cycle of a craving." },
  { suggestion: "Clean one small area of your desk or room", reason: "Minor accomplishment triggers a completion-reward cycle that replaces the craving loop." }
];

export default function CraveButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'trigger' | 'breathing' | 'suggestion' | 'feedback'>('trigger');
  const [intensity] = useState(3);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [totalDuration, setTotalDuration] = useState(30); // Fixed 30s
  const [currentSuggestion, setCurrentSuggestion] = useState<{ suggestion: string; reason: string } | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [breathingPhase, setBreathingPhase] = useState(0);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    // Initial fetch only for stability
    getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });
  }, []);

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Pick a warm-sounding voice once available. If none of the curated voices
  // are present on this device, we don't speak at all (better silence than robot).
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const PREFERRED = [
      'Samantha',                 // macOS / iOS — natural female
      'Google US English',        // Chrome desktop
      'Microsoft Aria Online',    // Edge / Win11
      'Microsoft Jenny Online',
      'Google UK English Female',
      'Karen',                    // macOS
      'Moira',                    // macOS
      'Serena',
    ];
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      for (const name of PREFERRED) {
        const v = voices.find((x) => x.name === name || x.name.startsWith(name));
        if (v) { voiceRef.current = v; return; }
      }
      // No curated match → leave null so we stay silent.
      voiceRef.current = null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => { window.speechSynthesis.onvoiceschanged = null as any; };
  }, []);

  const speak = useCallback((text: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    if (!voiceRef.current) return; // No warm voice on this device — stay silent.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voiceRef.current;
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    utterance.volume = 0.85;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const phaseRef = useRef(0);
  const totalCountdownRef = useRef(0);

  // Breathing logic
  useEffect(() => {
    if (view === 'breathing' && countdown > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          const next = prev - 1;
          totalCountdownRef.current = next;
          return next;
        });
        
        setPhaseTimeLeft((prev) => {
          if (prev <= 1) {
            const nextIdx = (phaseRef.current + 1) % BREATHING_PHASES.length;
            phaseRef.current = nextIdx;
            setBreathingPhase(nextIdx);
            const nextP = BREATHING_PHASES[nextIdx];
            speak(nextP.text);
            vibrate(40);
            return nextP.duration;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (view === 'breathing' && countdown === 0) {
      setView('suggestion');
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, countdown]);

  const triggerCraveMode = async () => {
    setTotalDuration(30);
    setCountdown(30);
    totalCountdownRef.current = 30;
    phaseRef.current = 0;
    setBreathingPhase(0);
    setPhaseTimeLeft(BREATHING_PHASES[0].duration);
    setView('breathing');
    speak("Prepare to breathe. Inhale.");

    // Get suggestion from AI; fall back to static if AI unavailable or fails.
    setIsLoadingSuggestion(true);
    setCurrentSuggestion(null);
    if (isAIAvailable()) {
      generateCravingSuggestion({
        intensity,
        trigger: selectedTrigger,
        nicotineType: profile?.nicotineType,
      })
        .then((s) => setCurrentSuggestion(s))
        .catch(() => {
          const idx = Math.floor(Math.random() * STATIC_SUGGESTIONS.length);
          setCurrentSuggestion(STATIC_SUGGESTIONS[idx]);
        })
        .finally(() => setIsLoadingSuggestion(false));
    } else {
      const idx = Math.floor(Math.random() * STATIC_SUGGESTIONS.length);
      setCurrentSuggestion(STATIC_SUGGESTIONS[idx]);
      setIsLoadingSuggestion(false);
    }
  };

  const logCrave = async (overcome: boolean) => {
    if (!auth.currentUser) {
      setIsOpen(false);
      resetState();
      return;
    }
    const uid = auth.currentUser.uid;
    const entry: CravingEntry = {
      timestamp: new Date().toISOString(),
      intensity,
      triggerType: selectedTrigger || 'Unknown',
      suggestedAction: currentSuggestion?.suggestion,
      feedback: feedback || undefined,
      isSaved,
      actionTaken: overcome ? 'overcome' : 'relapsed'
    };

    // Persist locally first so the log is never lost.
    try {
      const key = `cravings:${uid}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(entry);
      localStorage.setItem(key, JSON.stringify(existing));

      const progKey = `progress:${uid}`;
      const prog = JSON.parse(localStorage.getItem(progKey) || '{}');
      prog.cravingsTotal = (prog.cravingsTotal || 0) + 1;
      if (overcome) prog.cravingsResisted = (prog.cravingsResisted || 0) + 1;
      prog.lastUpdated = new Date().toISOString();
      localStorage.setItem(progKey, JSON.stringify(prog));
    } catch {}

    // Close UI immediately — Firestore writes are best-effort in background.
    setIsOpen(false);
    resetState();

    // Best-effort Firestore sync with timeout; never blocks UI.
    const timeout = (ms: number) => new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
    Promise.race([
      (async () => {
        await addDoc(collection(db, 'cravings', uid, 'entries'), cleanObject(entry));
        if (overcome) {
          await unlockAchievement('resist_1');
        }
        const progressRef = doc(db, 'progress', uid);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
          const data = progressSnap.data();
          await updateDoc(progressRef, {
            cravingsResisted: overcome ? (data.cravingsResisted || 0) + 1 : (data.cravingsResisted || 0),
            cravingsTotal: (data.cravingsTotal || 0) + 1,
            lastUpdated: new Date().toISOString()
          });
        } else {
          await setDoc(progressRef, {
            cravingsResisted: overcome ? 1 : 0,
            cravingsTotal: 1,
            lastUpdated: new Date().toISOString()
          });
        }
      })(),
      timeout(4000),
    ]).catch((err) => console.warn('Crave log Firestore sync skipped:', err?.message || err));
  };

  const toggleSave = async () => {
    if (!auth.currentUser || !currentSuggestion) return;
    const newSaved = !isSaved;
    setIsSaved(newSaved);
    vibrate([20, 50]);

    try {
      if (newSaved) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          favoriteStrategies: arrayUnion(currentSuggestion.suggestion)
        });
      } else {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          favoriteStrategies: arrayRemove(currentSuggestion.suggestion)
        });
      }
    } catch {
      setIsSaved(!newSaved); // revert optimistic update on failure
    }
  };

  const resetState = () => {
    setView('trigger');
    setSelectedTrigger(null);
    setFeedback(null);
    setIsSaved(false);
    setCurrentSuggestion(null);
    window.speechSynthesis.cancel();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-16 h-16 bg-orange rounded-full flex items-center justify-center text-white glow-hot transition-all active:scale-95 z-50 hover:scale-105 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Flame size={32} fill="currentColor" />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-background backdrop-blur-3xl flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            {/* Elegant Header */}
            <header className="absolute top-0 left-0 right-0 p-10 flex justify-between items-start">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-2 h-2 rounded-full bg-orange animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Focus Mode Active</span>
                </div>
                <h1 className="text-sm font-bold text-charcoal/40">CRAVING DISRUPTION PROTOCOL</h1>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-12 h-12 rounded-full bg-white card-shadow flex items-center justify-center text-gray-400 hover:text-charcoal transition-all active:scale-90"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-12 h-12 rounded-full bg-white card-shadow flex items-center justify-center text-gray-400 hover:text-red-500 transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            {/* Main Stage */}
            <div className="w-full max-w-lg flex flex-col items-center">
              
              {/* View: Intensity */}
              {/* Intensity step removed: open directly to trigger selection. */}

              {/* View: Trigger */}
              {view === 'trigger' && (
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex flex-col items-center w-full"
                >
                  <h2 className="text-4xl font-extrabold text-charcoal mb-4 text-center tracking-tight">The Root Cause</h2>
                  <p className="text-gray-400 text-center mb-12 max-w-xs font-medium">Identifying the trigger is the first step to neutralising it.</p>
                  
                  <div className="grid grid-cols-2 gap-4 w-full mb-16">
                    {['Stress', 'Boredom', 'Anxiety', 'Social', 'Habit', 'Routine'].map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setSelectedTrigger(t);
                          vibrate(20);
                        }}
                        className={`
                          py-8 px-4 rounded-3xl font-bold transition-all border-2 flex flex-col items-center gap-2
                          ${selectedTrigger === t ? 'bg-orange/5 border-orange text-orange' : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200'}
                        `}
                      >
                        <span className="text-sm font-black uppercase tracking-widest">{t}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={triggerCraveMode}
                    disabled={!selectedTrigger}
                    className="w-full py-6 bg-charcoal text-white rounded-3xl font-bold text-lg card-shadow disabled:opacity-20 active:scale-95 transition-all"
                  >
                    Start 30s Breathing
                  </button>
                </motion.div>
              )}

              {/* View: Breathing */}
              {view === 'breathing' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className="text-center mb-16 h-24">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={breathingPhase}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center"
                      >
                        <h3 className="text-6xl font-black text-sage mb-3">{BREATHING_PHASES[breathingPhase].text}</h3>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">{BREATHING_PHASES[breathingPhase].action}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="relative flex items-center justify-center w-80 h-80">
                    {/* Background Ring */}
                    <div className="absolute inset-0 rounded-full border-[10px] border-gray-50" />
                    
                    {/* Interactive Fluid Ring */}
                    <motion.div
                      animate={{ 
                        scale: breathingPhase === 0 ? [1, 1.3] : breathingPhase === 2 ? [1.3, 1] : 1.1,
                      }}
                      transition={{ duration: BREATHING_PHASES[breathingPhase].duration, ease: "easeInOut" }}
                      className="absolute inset-0 rounded-full bg-sage/5 border-2 border-sage/20"
                    />

                    {/* Progress Circle */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <motion.circle
                        cx="160" cy="160" r="150"
                        stroke="currentColor" strokeWidth="10" fill="transparent"
                        strokeDasharray={2 * Math.PI * 150}
                        animate={{ strokeDashoffset: (2 * Math.PI * 150) * (1 - countdown / 30) }}
                        transition={{ duration: 1, ease: 'linear' }}
                        className="text-sage"
                        strokeLinecap="round"
                      />
                    </svg>
                    
                    <div className="flex flex-col items-center">
                      <LungsIcon className="w-32 h-32 text-sage/40 mb-4" />
                      <span className="text-3xl font-black text-charcoal">{countdown}</span>
                    </div>
                  </div>

                  <div className="mt-20 flex gap-4">
                    {BREATHING_PHASES.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === breathingPhase ? 'w-10 bg-sage' : 'w-4 bg-gray-100'}`} 
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* View: Suggestion & Results */}
              {view === 'suggestion' && (
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className="mb-12 text-center">
                    <div className="w-20 h-20 bg-sage rounded-full flex items-center justify-center text-white mx-auto mb-6 card-shadow">
                      <Check size={40} />
                    </div>
                    <h2 className="text-4xl font-extrabold text-charcoal mb-2">Peak Overcome</h2>
                    <p className="text-gray-400 font-medium italic">You're back in control.</p>
                  </div>

                  {isLoadingSuggestion ? (
                    <div className="w-full bg-white p-12 rounded-[40px] card-shadow flex flex-col items-center gap-4 mb-10">
                      <div className="w-10 h-10 border-4 border-sage border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Syncing Personal Coach...</p>
                    </div>
                  ) : currentSuggestion && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-full bg-white p-10 rounded-[40px] card-shadow border border-sage/5 flex flex-col items-center text-center mb-10 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-sage/20" />
                      
                      <button 
                        onClick={toggleSave}
                        className={`absolute top-6 right-6 p-3 rounded-2xl transition-all ${isSaved ? 'text-sage bg-sage/10' : 'text-gray-300 hover:text-gray-500 bg-gray-50'}`}
                      >
                        {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                      </button>

                      <div className="flex items-center gap-2 mb-6">
                        <Zap size={14} className="text-sage" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sage">RECOVERY PROTOCOL</span>
                      </div>

                      <h4 className="text-2xl font-black text-charcoal mb-6 leading-tight whitespace-pre-wrap">
                        {currentSuggestion.suggestion}
                      </h4>
                      
                      <div className="bg-gray-50 p-6 rounded-3xl w-full mb-8">
                        <p className="text-xs text-gray-500 font-medium leading-relaxed italic">
                          "{currentSuggestion.reason}"
                        </p>
                      </div>
                      
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={() => {
                            setFeedback('helpful');
                            vibrate(20);
                          }}
                          className={`flex-1 py-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${feedback === 'helpful' ? 'bg-sage text-white' : 'bg-gray-100 text-gray-400'}`}
                        >
                          <ThumbsUp size={14} /> Helpful
                        </button>
                        <button 
                          onClick={() => {
                            setFeedback('not_helpful');
                            vibrate(20);
                          }}
                          className={`flex-1 py-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${feedback === 'not_helpful' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                        >
                          <ThumbsDown size={14} /> Skip
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="w-full flex flex-col gap-4">
                    <button
                      onClick={() => logCrave(true)}
                      className="w-full py-6 bg-charcoal text-white rounded-3xl font-black text-xl card-shadow hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      LOG VICTORY
                    </button>
                    <button
                      onClick={() => logCrave(false)}
                      className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 hover:text-red-400 transition-colors"
                    >
                      I lost this battle
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
