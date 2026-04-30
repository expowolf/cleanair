import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cigarette, Wind, Zap, Plus, ArrowRight, Check, Calendar as CalendarIcon, DollarSign, Shield, Activity, Users, Target } from 'lucide-react';
import { NicotineType, UsageHabits, Trigger, QuitMethod, UserProfile, OperationType } from '../types';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, cleanObject } from '../lib/firestore';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    triggers: [],
    quitMethod: 'Cold Turkey',
    quitDate: new Date().toISOString(),
    weeklySpend: 0,
    whyIQuit: '',
    nicotineReplacement: 'No',
    otherProducts: 'No',
    motivationLevel: 10,
    routineStyle: 'Flexible',
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleComplete = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);

    const finalProfile: UserProfile = {
      ...profile,
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || '',
      onboardingComplete: true,
    } as UserProfile;

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), cleanObject(finalProfile));
      onComplete(finalProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      setError('Failed to save profile. Check your internet connection and try again.');
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <StepWrapper title="IDENTITY" subtitle="Select your primary protocol" currentStep={step} totalSteps={9}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { id: 'Vape', icon: Wind, label: 'Vape' },
                { id: 'Cigarettes', icon: Cigarette, label: 'Cigarettes' },
                { id: 'Both', icon: Zap, label: 'Both' },
                { id: 'Other', icon: Plus, label: 'Other' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setProfile({ ...profile, nicotineType: item.id as NicotineType }); nextStep(); }}
                  className={`p-8 rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all active:scale-95 ${
                    profile.nicotineType === item.id ? 'bg-charcoal text-white shadow-2xl scale-[1.02]' : 'bg-white card-shadow text-gray-400 hover:text-charcoal border border-gray-50'
                  }`}
                >
                  <item.icon size={36} strokeWidth={profile.nicotineType === item.id ? 2.5 : 2} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                </button>
              ))}
            </motion.div>
          </StepWrapper>
        );
      case 2:
        return (
          <StepWrapper title="SUPPORT" subtitle="Current Therapy Status" currentStep={step} totalSteps={9}>
            <div className="flex flex-col gap-3">
              {['No', 'Patch', 'Gum', 'Lozenges', 'Inhaler', 'Prescription'].map((option) => (
                <button
                  key={option}
                  onClick={() => { setProfile({ ...profile, nicotineReplacement: option }); nextStep(); }}
                  className={`py-5 px-8 rounded-3xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                    profile.nicotineReplacement === option ? 'bg-sage text-white shadow-xl' : 'bg-white card-shadow border border-gray-50 text-gray-400 hover:text-charcoal'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </StepWrapper>
        );
      case 3:
        return (
          <StepWrapper title="SUPPLEMENTS" subtitle="Other Assets in Use" currentStep={step} totalSteps={9}>
            <div className="flex flex-col gap-4">
              {['No', 'Zyn / Pouches', 'Snus', 'Heat-not-burn', 'Other'].map((option) => (
                <button
                  key={option}
                  onClick={() => { setProfile({ ...profile, otherProducts: option }); nextStep(); }}
                  className={`py-5 px-8 rounded-[28px] text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                    profile.otherProducts === option ? 'bg-sage text-white shadow-xl' : 'bg-white card-shadow border border-gray-50 text-gray-400 hover:text-charcoal'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </StepWrapper>
        );
      case 4:
        return (
          <StepWrapper title="INTENSITY" subtitle="Daily Usage Frequency" currentStep={step} totalSteps={9}>
            <div className="flex flex-col gap-3">
              {[
                { id: 'Multiple times a day', label: 'Chronic', sub: 'High Frequency' },
                { id: 'Once a day', label: 'Tactical', sub: 'Calculated' },
                { id: 'A few times a week', label: 'Casual', sub: 'Intermittent' }
              ].map((habit) => (
                <button
                  key={habit.id}
                  onClick={() => { setProfile({ ...profile, usageHabits: habit.id as UsageHabits }); nextStep(); }}
                  className={`flex flex-col items-center justify-center p-6 rounded-[32px] transition-all active:scale-[0.98] ${
                    profile.usageHabits === habit.id ? 'bg-charcoal text-white shadow-2xl scale-[1.02]' : 'bg-white card-shadow border border-gray-50 text-gray-400 hover:text-charcoal'
                  }`}
                >
                  <div className="font-black text-[10px] uppercase tracking-[0.2em] mb-1">{habit.label}</div>
                  <div className="font-bold text-[8px] uppercase tracking-widest opacity-40">{habit.sub}</div>
                </button>
              ))}
            </div>
          </StepWrapper>
        );
      case 5:
        return (
          <StepWrapper title="TRIGGERS" subtitle="Identify Vulnerabilities" currentStep={step} totalSteps={9}>
            <div className="grid grid-cols-2 gap-3">
              {['Stress', 'Boredom', 'Social', 'Meals', 'Morning', 'Anxiety'].map((trigger) => (
                <button
                  key={trigger}
                  onClick={() => {
                    const triggers = profile.triggers || [];
                    if (triggers.includes(trigger as Trigger)) {
                      setProfile({ ...profile, triggers: triggers.filter(t => t !== trigger) });
                    } else {
                      setProfile({ ...profile, triggers: [...triggers, trigger as Trigger] });
                    }
                  }}
                  className={`p-5 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${
                    profile.triggers?.includes(trigger as Trigger) ? 'bg-sage text-white shadow-lg' : 'bg-white card-shadow border border-gray-50 text-gray-300 hover:text-gray-400'
                  }`}
                >
                  {trigger}
                </button>
              ))}
            </div>
            <button
              onClick={nextStep}
              disabled={!profile.triggers?.length}
              className="mt-8 w-full py-5 bg-charcoal text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 disabled:opacity-20 shadow-xl shadow-charcoal/20 active:scale-95 transition-all"
            >
              Continue Integration <ArrowRight size={16} />
            </button>
          </StepWrapper>
        );
      case 6:
        return (
          <StepWrapper title="PATHWAY" subtitle="Strategic Initiation" currentStep={step} totalSteps={9}>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setProfile({ ...profile, quitMethod: 'Cold Turkey', quitDate: new Date().toISOString() })}
                className={`p-6 rounded-[32px] flex items-center gap-5 transition-all active:scale-[0.98] ${
                  profile.quitMethod === 'Cold Turkey' ? 'bg-charcoal text-white shadow-2xl' : 'bg-white card-shadow border border-gray-50 text-gray-400'
                }`}
              >
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">💪</div>
                <div className="text-left">
                  <div className="font-black uppercase tracking-widest text-[11px] mb-0.5">Absolute Cut</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">Immediate Termination</div>
                </div>
              </button>
              <button
                onClick={() => setProfile({ ...profile, quitMethod: 'Gradual Reduction' })}
                className={`p-6 rounded-[32px] flex items-center gap-5 transition-all active:scale-[0.98] ${
                  profile.quitMethod === 'Gradual Reduction' ? 'bg-charcoal text-white shadow-2xl' : 'bg-white card-shadow border border-gray-50 text-gray-400'
                }`}
              >
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">📅</div>
                <div className="text-left">
                  <div className="font-black uppercase tracking-widest text-[11px] mb-0.5">Controlled Decay</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">Linear Reduction</div>
                </div>
              </button>

              {profile.quitMethod === 'Gradual Reduction' && (
                <div className="mt-4 p-6 bg-white rounded-[32px] card-shadow border border-gray-50">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Target Date</label>
                  <DatePicker
                    selected={new Date(profile.quitDate || Date.now())}
                    onChange={(date) => setProfile({ ...profile, quitDate: date?.toISOString() })}
                    className="w-full pb-2 border-b-2 border-sage outline-none font-bold text-charcoal bg-transparent"
                    minDate={new Date()}
                  />
                </div>
              )}

              <div className="mt-4 p-6 bg-white rounded-[32px] card-shadow border border-gray-50">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Weekly Burn (USD)</label>
                <div className="flex items-center gap-3">
                  <DollarSign size={20} className="text-sage" />
                  <input
                    type="number"
                    value={profile.weeklySpend || ''}
                    onChange={(e) => setProfile({ ...profile, weeklySpend: Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full text-2xl font-black tracking-tighter text-charcoal outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={nextStep}
              className="mt-8 w-full py-5 bg-charcoal text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-xl shadow-charcoal/20 active:scale-95 transition-all"
            >
              Analyze Configuration <ArrowRight size={16} />
            </button>
          </StepWrapper>
        );
      case 7:
        return (
          <StepWrapper title="DETERMINATION" subtitle="Core Motivation Magnitude" currentStep={step} totalSteps={9}>
            <div className="flex flex-col gap-10">
              <div className="flex justify-between items-end h-40 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                  <button
                    key={val}
                    onClick={() => setProfile({ ...profile, motivationLevel: val })}
                    className={`flex-1 rounded-[12px] transition-all relative group ${
                      profile.motivationLevel === val ? 'bg-sage shadow-[0_0_20px_#7DB87A]' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    style={{ height: `${val * 10}%` }}
                  >
                    {profile.motivationLevel === val && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-sage">{val}</div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={nextStep}
                className="w-full py-5 bg-charcoal text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-xl shadow-charcoal/20 active:scale-95 transition-all"
              >
                Confirm Priority <ArrowRight size={16} />
              </button>
            </div>
          </StepWrapper>
        );
      case 8:
        return (
          <StepWrapper title="MODUS OPERANDI" subtitle="Operational Routine Preference" currentStep={step} totalSteps={9}>
            <div className="flex flex-col gap-4">
              {[
                { id: 'Strict', label: 'Absolute', desc: 'Rigid hourly protocol and structure' },
                { id: 'Flexible', label: 'Adaptive', desc: 'Situational goals and dynamic timing' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => { setProfile({ ...profile, routineStyle: style.id as 'Strict' | 'Flexible' }); nextStep(); }}
                  className={`p-8 rounded-[40px] text-left transition-all active:scale-[0.98] ${
                    profile.routineStyle === style.id ? 'bg-charcoal text-white shadow-2xl' : 'bg-white card-shadow border border-gray-50 text-gray-400'
                  }`}
                >
                  <div className="font-black uppercase tracking-widest text-[12px] mb-1">{style.label}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest leading-relaxed ${profile.routineStyle === style.id ? 'text-white/60' : 'text-gray-400'}`}>
                    {style.desc}
                  </div>
                </button>
              ))}
            </div>
          </StepWrapper>
        );
      case 9:
        return (
          <StepWrapper title="THE CORE" subtitle="ESTABLISH YOUR ANCHOR" currentStep={step} totalSteps={9}>
            <div className="p-8 bg-charcoal rounded-[48px] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sage/20 blur-[50px] rounded-full -mr-16 -mt-16 opacity-50" />
              <textarea
                value={profile.whyIQuit}
                autoFocus
                onChange={(e) => setProfile({ ...profile, whyIQuit: e.target.value })}
                placeholder="Declare your purpose..."
                className="w-full h-40 bg-transparent border-none outline-none text-white text-xl font-black italic placeholder:text-white/20 resize-none font-mono"
              />
              <div className="flex items-center gap-2 mt-4 text-white/40">
                <Shield size={12} />
                <span className="text-[8px] font-black uppercase tracking-widest">Protocol Anchor Registered</span>
              </div>
            </div>
            {error && <p className="text-[10px] text-red-500 font-black uppercase mt-4 mb-4">{error}</p>}
            <button
              onClick={handleComplete}
              disabled={!profile.whyIQuit || loading}
              className="mt-8 w-full py-6 bg-sage text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-sage/20 active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              {loading ? <span className="animate-spin">⟳</span> : <Check size={20} strokeWidth={3} />}
              {loading ? 'Initializing...' : 'Initialize Journey'}
            </button>
          </StepWrapper>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-y-auto">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col pt-8">
        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-100 rounded-full mb-16 overflow-hidden">
          <motion.div
            className="h-full bg-charcoal"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / 9) * 100}%` }}
            transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {step > 1 && (
          <button onClick={prevStep} className="mt-4 text-gray-500 font-bold self-center">
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}

function StepWrapper({ title, subtitle, children, currentStep, totalSteps }: { title: string, subtitle: string, children: React.ReactNode, currentStep: number, totalSteps: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="px-2 py-1 bg-sage/10 rounded-md">
          <span className="text-[10px] font-black text-sage uppercase tracking-widest leading-none">Step {currentStep} of {totalSteps}</span>
        </div>
      </div>
      <h1 className="text-3xl font-black text-charcoal leading-none tracking-tight uppercase mb-2">{title}</h1>
      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">{subtitle}</p>
      {children}
    </div>
  );
}
