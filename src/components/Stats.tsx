import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Unlock, TrendingUp, Activity, DollarSign, Clock, Wind, Zap, Target, Trophy, Brain, Settings } from 'lucide-react';
import { UserProfile, ProgressSnapshot, CravingEntry, OperationType } from '../types';
import { differenceInMinutes, differenceInHours, differenceInDays, format, subDays, isSameDay } from 'date-fns';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError } from '../lib/firestore';

import { ACHIEVEMENTS } from '../constants/achievements';
import { checkAchievements } from '../services/achievementService';

interface StatsProps {
  profile: UserProfile;
  onNavigate: (tab: string) => void;
}

export default function Stats({ profile, onNavigate }: StatsProps) {
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [cravings, setCravings] = useState<CravingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const quitDate = new Date(profile.quitDate);
  const totalSecs = Math.max(0, Math.floor((now.getTime() - quitDate.getTime()) / 1000));
  const days = Math.floor(totalSecs / 86400);
  const liveHours = Math.floor((totalSecs % 86400) / 3600);
  const liveMins = Math.floor((totalSecs % 3600) / 60);
  const liveSecs = totalSecs % 60;
  const mins = Math.max(0, differenceInMinutes(now, quitDate));
  const hours = Math.max(0, differenceInHours(now, quitDate));

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubProgress = onSnapshot(doc(db, 'progress', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ProgressSnapshot;
        setProgress(data);
        // Check for new achievements
        checkAchievements(data).then(newIds => {
          if (newIds.length > 0) {
             setNewlyUnlocked(prev => [...prev, ...newIds]);
          }
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `progress/${auth.currentUser?.uid}`));

    const unsubCravings = onSnapshot(collection(db, `cravings/${auth.currentUser.uid}/entries`), (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CravingEntry));
      setCravings(entries);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `cravings/${auth.currentUser?.uid}/entries`));

    return () => {
      unsubProgress();
      unsubCravings();
    };
  }, []);

  // Real-life impact calculations
  const moneySaved = (profile.weeklySpend / 7) * (mins / (24 * 60));
  const podsAvoided = (profile.usageHabits === 'Multiple times a day' ? 1 : 0.5) * days;
  const timeSavedMinutes = 15 * days; // Estimate 15 mins/day not spent vaping

  // Health milestones
  const healthMilestones = [
    { id: 1, label: '20 Minutes', desc: 'Heart rate drops to normal', target: 20, unit: 'mins', icon: <Activity size={20} /> },
    { id: 2, label: '8 Hours', desc: 'Oxygen levels normalize', target: 8, unit: 'hours', icon: <Wind size={20} /> },
    { id: 3, label: '24 Hours', desc: 'Carbon monoxide eliminated', target: 24, unit: 'hours', icon: <Zap size={20} /> },
    { id: 4, label: '48 Hours', desc: 'Nicotine eliminated; taste improves', target: 48, unit: 'hours', icon: <Target size={20} /> },
    { id: 5, label: '72 Hours', desc: 'Bronchial tubes relax', target: 72, unit: 'hours', icon: <Wind size={20} /> },
    { id: 6, label: '1 Week', desc: 'Cravings intensity begins to drop', target: 7, unit: 'days', icon: <Brain size={20} /> },
    { id: 7, label: '1 Month', desc: 'Lung function increases by 30%', target: 30, unit: 'days', icon: <Activity size={20} /> },
  ];

  const getMilestoneProgress = (target: number, unit: string) => {
    let current = 0;
    if (unit === 'mins') current = mins;
    if (unit === 'hours') current = hours;
    if (unit === 'days') current = days;
    return Math.min(100, (current / target) * 100);
  };

  // Craving Intelligence
  const resistedCount = cravings.filter(c => c.actionTaken !== 'relapse').length;
  const successRate = cravings.length > 0 ? Math.round((resistedCount / cravings.length) * 100) : 100;
  
  const triggerCounts: Record<string, number> = {};
  cravings.forEach(c => {
    if (c.triggerType) {
      triggerCounts[c.triggerType] = (triggerCounts[c.triggerType] || 0) + 1;
    }
  });
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';

  return (
    <div className="flex flex-col gap-10 pb-32">
      <header className="px-6 pt-10 pb-4 flex flex-col items-center text-center relative">
        <button 
          onClick={() => onNavigate('settings')}
          className="absolute top-10 right-6 p-2.5 bg-white rounded-2xl card-shadow text-gray-300 hover:text-charcoal transition-all active:scale-90"
        >
          <Settings size={20} />
        </button>
        <div className="w-12 h-12 bg-charcoal rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
          <Activity size={24} />
        </div>
        <h1 className="text-3xl font-black text-charcoal tracking-tight">OPERATIONAL METRICS</h1>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Confirmed Progress Monitoring</p>
      </header>

      {/* Primary Stat: Days Vape-Free */}
      <div className="px-6">
        <div className="bg-charcoal p-10 rounded-[48px] text-white text-center shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sage/20 blur-[100px] rounded-full -mr-32 -mt-32 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
          
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-4 block">Deployment Uptime</span>
            <div className="text-6xl font-black tracking-tighter mb-2 font-mono">{days}<span className="text-2xl text-white/50">d</span> {String(liveHours).padStart(2,'0')}<span className="text-2xl text-white/50">h</span> {String(liveMins).padStart(2,'0')}<span className="text-2xl text-white/50">m</span> {String(liveSecs).padStart(2,'0')}<span className="text-2xl text-white/50">s</span></div>
            <div className="text-[10px] font-black uppercase tracking-[0.5em] text-sage">Status: Stable</div>
            
            <div className="grid grid-cols-2 gap-8 mt-12 pt-10 border-t border-white/10">
              <div>
                <div className="text-2xl font-black tracking-tighter font-mono">{progress?.longestStreak || days}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">Delta-Max</div>
              </div>
              <div>
                <div className="text-2xl font-black tracking-tighter font-mono">{resistedCount}</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">Suppressed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Life Impact */}
      <section className="px-6">
        <div className="flex items-center gap-2 mb-6 px-2">
          <TrendingUp size={14} className="text-sage" />
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">External Impact</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <ImpactCard icon={<DollarSign size={18} />} label="Capital" value={`$${moneySaved.toFixed(0)}`} color="bg-white border border-gray-50 text-charcoal" />
          <ImpactCard icon={<Zap size={18} />} label="Vials" value={podsAvoided.toFixed(0)} color="bg-white border border-gray-50 text-charcoal" />
          <ImpactCard icon={<Clock size={18} />} label="Cycles" value={`${(timeSavedMinutes / 60).toFixed(1)}h`} color="bg-white border border-gray-50 text-charcoal" />
        </div>
      </section>

      {/* Health Recovery */}
      <section className="px-6">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Health Recovery</h3>
        <div className="grid grid-cols-3 gap-4">
          <RecoveryGauge label="Lungs" percent={Math.min(100, days * 3.3)} color="#7DB87A" />
          <RecoveryGauge label="Circulation" percent={Math.min(100, days * 2.5)} color="#E8916A" />
          <RecoveryGauge label="Oxygen" percent={Math.min(100, hours * 12.5)} color="#A8C8E8" />
        </div>
      </section>

      {/* Craving Intelligence */}
      <section className="px-6">
        <div className="bg-white p-6 rounded-[32px] card-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-50 text-orange rounded-2xl">
              <Brain size={24} />
            </div>
            <h3 className="font-bold text-charcoal">Craving Analysis</h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Top Trigger</p>
              <p className="font-bold text-charcoal">{topTrigger}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Success Rate</p>
              <p className="font-bold text-charcoal">{successRate}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* Health Milestones */}
      <section className="px-6">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Health Milestones</h3>
        <div className="flex flex-col gap-3">
          {healthMilestones.map((ach) => {
            const isUnlocked = getMilestoneProgress(ach.target, ach.unit) >= 100;
            return (
              <motion.div
                key={ach.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-[24px] card-shadow flex items-center gap-4 transition-all ${
                  isUnlocked ? 'bg-white' : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className={`p-3 rounded-2xl ${isUnlocked ? 'bg-sage/10 text-sage' : 'bg-gray-200 text-gray-400'}`}>
                  {ach.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-charcoal text-sm">{ach.label}</h4>
                  <p className="text-[11px] text-gray-500">{ach.desc}</p>
                </div>
                {isUnlocked ? (
                  <div className="bg-sage/10 text-sage text-[10px] font-black px-2 py-1 rounded-md">UNLOCKED</div>
                ) : (
                  <div className="text-gray-300"><Lock size={14} /></div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Achievements */}
      <section className="px-6">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Achievements</h3>
          <span className="text-[10px] font-black text-sage uppercase tracking-widest">{progress?.unlockedAchievements?.length || 0} / {ACHIEVEMENTS.length}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ACHIEVEMENTS.slice(0, 9).map((ach) => {
            const isUnlocked = progress?.unlockedAchievements?.includes(ach.id);
            return (
              <motion.div 
                key={ach.id} 
                whileHover={isUnlocked ? { scale: 1.05, rotate: 2 } : {}}
                className={`p-4 rounded-[24px] flex flex-col items-center text-center gap-2 transition-all duration-500 ${isUnlocked ? 'bg-white card-shadow border border-sage/10' : 'bg-gray-50 opacity-20 grayscale border border-transparent'}`}
              >
                <div className={`text-2xl mb-1 ${isUnlocked ? 'animate-bounce' : ''}`}>{ach.icon}</div>
                <div className="text-[9px] font-black text-charcoal leading-tight uppercase tracking-tighter">{ach.title}</div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* System Insight */}
      <section className="px-6 pb-12">
        <div className="bg-blue/5 p-6 rounded-[32px] border border-blue/10">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="text-blue" size={20} />
            <h3 className="font-bold text-blue">System Insight</h3>
          </div>
          <p className="text-sm text-charcoal opacity-80 leading-relaxed">
            {days >= 7 
              ? "You've crossed the one-week mark! Your body is now nicotine-free. Keep your hands busy and your mind focused on your goal."
              : days >= 3
              ? "The first 72 hours are the toughest, and you've conquered them. Your lungs are already starting to clear out."
              : "Every minute counts right now. If cravings get intense, remember why you started. You're stronger than a 5-second urge."
            }
            {successRate < 80 && " I noticed a few relapses logged—don't be discouraged. Each 'no' to a craving is a win. Try using 'Craving Mode' sooner next time."}
          </p>
        </div>
      </section>
    </div>
  );
}

function ImpactCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className={`p-6 rounded-[32px] flex flex-col items-center text-center gap-1 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-default ${color}`}>
      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-2">
        {icon}
      </div>
      <span className="text-2xl font-black tracking-tighter text-charcoal font-mono leading-none">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 mt-1">{label}</span>
    </div>
  );
}

function RecoveryGauge({ label, percent, color }: { label: string, percent: number, color: string }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="bg-white p-5 rounded-[32px] card-shadow flex flex-col items-center gap-4 border border-gray-50 transition-all hover:border-sage/20">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-50" />
          <motion.circle
            cx="40" cy="40" r={radius} stroke={color} strokeWidth="6" fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 2, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-black text-charcoal leading-none">{Math.round(percent)}%</span>
        </div>
      </div>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}
