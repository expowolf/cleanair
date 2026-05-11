import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Target, Edit2, ChevronRight, CheckCircle2, Circle, Loader2, Send, Plus, ThumbsUp, ThumbsDown, Zap, Trophy, HelpCircle, Youtube, ExternalLink, X } from 'lucide-react';
import { UserProfile, QuitPlan as IQuitPlan, DailyTask } from '../types';
import { format } from 'date-fns';
import { generatePersonalizedPlan, adjustPlan } from '../services/quitPlanService';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, cleanObject } from '../lib/firestore';
import { OperationType } from '../types';
import { checkAchievements } from '../services/achievementService';

interface QuitPlanProps {
  profile: UserProfile;
}

const STATIC_TASK_HELP: Record<string, { explanation: string; youtubeLink: string }> = {
  'Deep Inhalation Exercise': {
    explanation: "Sit upright and breathe deeply into your belly, expanding your diaphragm. This triggers the vagus nerve to calm your system.",
    youtubeLink: "https://www.youtube.com/watch?v=tybOi4hjZFQ"
  },
  'Hydration & Mobility': {
    explanation: "Drink water slowly. Stretching helps release tension that often feels like a craving.",
    youtubeLink: "https://www.youtube.com/watch?v=W-Lsh9m7L-c"
  },
  'Documentation Deep Dive': {
    explanation: "Choose one specific topic (e.g., Loops or Arrays) and read three different sources on it to master the concept.",
    youtubeLink: "https://www.youtube.com/watch?v=W6NZfCO5SIk"
  }
};

export default function QuitPlan({ profile }: QuitPlanProps) {
  const [plan, setPlan] = useState<IQuitPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [goalStep, setGoalStep] = useState<'goal' | 'questions'>('goal');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [aiDebug, setAiDebug] = useState<string | null>(null);

  const FOLLOW_UP_QUESTIONS = [
    { id: 'q1', label: 'Current experience level', placeholder: 'e.g. complete beginner, intermediate, advanced' },
    { id: 'q2', label: 'How many minutes can you commit daily?', placeholder: 'e.g. 15 minutes, 30 minutes, 1 hour' },
    { id: 'q3', label: "Biggest obstacle you've hit before?", placeholder: 'e.g. lack of time, motivation drops, no equipment' },
  ];
  
  // Task Help State
  const [helpData, setHelpData] = useState<{ title: string; explanation: string; youtubeLink: string } | null>(null);
  const [loadingHelp, setLoadingHelp] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Hydrate from localStorage immediately so the plan shows even if Firestore is blocked.
    try {
      const cached = localStorage.getItem(`plan:${auth.currentUser.uid}`);
      if (cached) { setPlan(JSON.parse(cached)); setLoading(false); }
    } catch {}

    // Bound the loading state so the UI renders even if Firestore never replies.
    const fallback = setTimeout(() => setLoading(false), 4000);

    const unsubscribe = onSnapshot(doc(db, 'plans', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const planData = docSnap.data() as IQuitPlan;
        // Only override the in-memory plan if Firestore actually has something newer.
        // Otherwise a stale Firestore snapshot wipes a freshly-generated AI plan
        // when the Firestore write was rejected (the bug users hit on mobile).
        setPlan((current) => {
          if (!current) return planData;
          const remoteTime = new Date(planData.generatedAt || 0).getTime();
          const localTime = new Date(current.generatedAt || 0).getTime();
          return remoteTime > localTime ? planData : current;
        });

        if (planData.status === 'adjusting' && !generating) {
          handleGeneratePlan();
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `plans/${auth.currentUser.uid}`);
      setLoading(false);
    });

    return () => { clearTimeout(fallback); unsubscribe(); };
  }, []);

  const handleGeneratePlan = async (specificGoal?: string, context?: any) => {
    if (!auth.currentUser) return;
    setGenerating(true);
    setAiDebug(null);
    try {
      const newPlan = await generatePersonalizedPlan(profile, specificGoal, context);
      const lastErr = (window as any).__cleanair_lastAIError;
      const aiInfo = (window as any).__cleanair_ai;
      if (lastErr) setAiDebug(`AI failed: ${lastErr} | mode=${aiInfo?.mode || 'unknown'}`);
      // Persist locally first so it survives even if Firestore is blocked.
      try { localStorage.setItem(`plan:${auth.currentUser.uid}`, JSON.stringify(newPlan)); } catch {}
      try {
        const { patchUserDataBestEffort } = await import('../lib/userData');
        patchUserDataBestEffort(auth.currentUser.uid, { plan: newPlan });
      } catch {}
      // Best-effort Firestore write with 6s timeout.
      try {
        await Promise.race([
          setDoc(doc(db, 'plans', auth.currentUser.uid), cleanObject(newPlan)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
        ]);
      } catch (writeErr) {
        console.warn('Plan Firestore write failed, using local copy', writeErr);
      }
      setPlan(newPlan);
      setShowGoalInput(false);
    } catch (error) {
      console.error("Failed to generate plan", error);
    } finally {
      setGenerating(false);
    }
  };

  const startGoalFlow = async () => {
    if (!goalText.trim()) return;
    // Advance to follow-up questions step instead of generating immediately.
    setGoalStep('questions');
  };

  const finalizePlan = () => {
    const context = {
      level: questionAnswers.q1 || 'beginner',
      availability: questionAnswers.q2 || '15 minutes',
      motivation: questionAnswers.q3 || '',
      answers: questionAnswers,
    };
    handleGeneratePlan(goalText, context);
  };

  const toggleTask = async (taskId: string) => {
    if (!plan || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const isCompleting = !plan.tasks.find(t => t.id === taskId)?.completed;
    const updatedTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t
    );

    // Optimistic local update so the checkbox responds instantly.
    const updatedPlan = { ...plan, tasks: updatedTasks };
    setPlan(updatedPlan);
    try { localStorage.setItem(`plan:${uid}`, JSON.stringify(updatedPlan)); } catch {}
    try {
      const { patchUserDataBestEffort } = await import('../lib/userData');
      patchUserDataBestEffort(uid, { plan: updatedPlan });
    } catch {}

    // Best-effort Firestore sync; non-blocking.
    Promise.race([
      updateDoc(doc(db, 'plans', uid), cleanObject({ tasks: updatedTasks })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]).catch((err) => console.warn('Task toggle sync skipped', err?.message || err));

    if (isCompleting) {
      Promise.race([
        (async () => {
          const progressRef = doc(db, 'progress', uid);
          const progressSnap = await getDoc(progressRef);
          if (progressSnap.exists()) {
            const data = progressSnap.data();
            await updateDoc(progressRef, {
              tasksCompletedTotal: (data.tasksCompletedTotal || 0) + 1,
              goalsCompleted: (data.goalsCompleted || 0) + 1,
              lastUpdated: new Date().toISOString()
            });
            checkAchievements({ ...data, tasksCompletedTotal: (data.tasksCompletedTotal || 0) + 1 } as any);
          } else {
            await setDoc(progressRef, {
              uid, streakData: {}, goalsCompleted: 1, moneySaved: 0,
              cravingsResisted: 0, cravingsTotal: 0, tasksCompletedTotal: 1,
              longestStreak: 0, lastUpdated: new Date().toISOString()
            });
          }
        })(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ]).catch((err) => console.warn('Progress sync skipped', err?.message || err));
    }
  };

  const handleTaskFeedback = async (taskId: string, feedback: 'too_easy' | 'just_right' | 'too_hard') => {
    if (!plan || !auth.currentUser) return;
    
    const updatedTasks = plan.tasks.map(t => t.id === taskId ? { ...t, feedback } : t);
    
    try {
      await updateDoc(doc(db, 'plans', auth.currentUser.uid), cleanObject({ tasks: updatedTasks }));
      
      // If we have enough feedback, trigger an adjustment
      const feedbackCount = updatedTasks.filter(t => t.feedback && t.feedback !== 'just_right').length;
      if (feedbackCount >= 2) {
        setGenerating(true);
        const feedbackList = updatedTasks
          .filter(t => t.feedback)
          .map(t => ({ taskId: t.id, feedback: t.feedback! }));
        
        const adjustedPlan = await adjustPlan(plan, feedbackList);
        await updateDoc(doc(db, 'plans', auth.currentUser.uid), cleanObject({ 
          tasks: adjustedPlan.tasks,
          generatedAt: adjustedPlan.generatedAt,
          status: 'active'
        }));
      }
    } catch (error) {
      console.error("Feedback/Adjustment failed", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGetHelp = async (task: DailyTask) => {
    setLoadingHelp(task.id);
    // Search query combines task + the user's goal + task description so YouTube
    // returns videos relevant to what the user is actually doing, not generic
    // tutorials that happen to share keywords.
    const goal = plan?.goal && plan.goal !== 'General Cessation' ? plan.goal : '';
    const descSnippet = (task.description || '').split(/[.,]/)[0].slice(0, 60);
    const query = [task.title, goal, descSnippet, 'how to'].filter(Boolean).join(' ');
    const help = STATIC_TASK_HELP[task.title] || {
      explanation: "Focus on excellence. Consistency is your most powerful asset in this transition.",
      youtubeLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    };
    
    setHelpData({ 
      title: task.title, 
      explanation: help.explanation, 
      youtubeLink: help.youtubeLink 
    });
    setLoadingHelp(null);
  };

  const renderPlan = () => {
    if (!plan) return null;

    // Handle legacy plans or missing data gracefully
    if (!plan.goalSummary) {
      return (
        <div className="bg-white p-8 rounded-[24px] card-shadow text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center text-sage">
            <Zap size={32} />
          </div>
          <h2 className="text-xl font-bold text-charcoal">Update Your Plan</h2>
          <p className="text-sm text-gray-500">We've upgraded our plan generator! Please update your focus to get a more structured "Level Up" plan.</p>
          <button 
            onClick={() => { setShowGoalInput(true); setGoalStep("goal"); setQuestionAnswers({}); }}
            className="w-full py-4 bg-sage text-white rounded-full font-bold mt-4"
          >
            Update My Plan
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-8 pb-32">
        {/* Goal Summary */}
        <div className="bg-white p-6 rounded-[32px] card-shadow border-t-4 border-sage">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-sage/10 rounded-2xl text-sage">
              <Target size={24} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-charcoal">{plan.goalSummary.title}</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Level Up Goal</p>
            </div>
          </div>
          <p className="text-gray-600 italic">"{plan.goalSummary.whyItMatters}"</p>
        </div>

        {/* Weekly Structure */}
        {plan.weeklyStructure && (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-extrabold text-charcoal flex items-center gap-2">
              <Calendar size={20} className="text-sage" /> Monthly Roadmap
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {plan.weeklyStructure.map((week) => (
                <div key={week.week} className="bg-white p-4 rounded-2xl card-shadow flex items-center gap-4">
                  <div className="w-10 h-10 bg-charcoal text-white rounded-xl flex items-center justify-center font-bold">
                    W{week.week}
                  </div>
                  <p className="text-sm font-medium text-charcoal">{week.milestone}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Plan */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-extrabold text-charcoal flex items-center gap-2">
            <Zap size={20} className="text-sage" /> Daily Routine
          </h3>
          <div className="flex flex-col gap-3">
            {['Morning', 'Midday', 'Evening'].map((slot) => {
              const task = plan.tasks.find(t => t.timeSlot === slot);
              if (!task) return null;
              return (
                <div key={task.id} className={`p-5 rounded-[24px] transition-all border-2 ${task.completed ? 'bg-sage/5 border-sage/20' : 'bg-white border-transparent card-shadow'}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-sage bg-sage/10 px-2 py-0.5 rounded-md">
                          {slot}
                        </span>
                        <h4 className={`font-bold ${task.completed ? 'text-gray-400 line-through' : 'text-charcoal'}`}>
                          {task.title}
                        </h4>
                      </div>
                      <p className={`text-sm mb-3 ${task.completed ? 'text-gray-300' : 'text-gray-500'}`}>
                        {task.description}
                      </p>
                      
                      {!task.completed && (
                        <button 
                          onClick={() => handleGetHelp(task)}
                          disabled={loadingHelp === task.id}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-sage hover:text-sage-700 transition-colors bg-sage/5 px-3 py-1.5 rounded-full"
                        >
                          {loadingHelp === task.id ? (
                            <Loader2 className="animate-spin" size={12} />
                          ) : (
                            <HelpCircle size={12} />
                          )}
                          Don't know how?
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        task.completed ? 'bg-sage text-white' : 'border-2 border-gray-200 text-gray-300'
                      }`}
                    >
                      <CheckCircle2 size={18} strokeWidth={3} />
                    </button>
                  </div>

                  {task.completed && !task.feedback && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase text-center">How was this task?</p>
                      <div className="flex gap-2">
                        {[
                          { id: 'too_easy', label: 'Too Easy', icon: '🐣' },
                          { id: 'just_right', label: 'Just Right', icon: '✅' },
                          { id: 'too_hard', label: 'Too Hard', icon: '🔥' }
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => handleTaskFeedback(task.id, f.id as any)}
                            className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors"
                          >
                            <span className="block text-lg mb-1">{f.icon}</span>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Trigger Replacement */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-extrabold text-charcoal">Trigger Replacement</h3>
          <div className="bg-charcoal p-6 rounded-[32px] text-white">
            <div className="flex flex-col gap-4">
              {plan.habitReplacements.map((hr, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-sage mt-2" />
                  <div>
                    <span className="font-bold text-sage">{hr.trigger}:</span>{' '}
                    <span className="text-sm opacity-90">{hr.suggestion}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Craving Response */}
        {plan.cravingResponsePlan && (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-extrabold text-charcoal">Instant Craving Response</h3>
            <div className="grid grid-cols-1 gap-3">
              {plan.cravingResponsePlan.map((action, i) => (
                <div key={i} className="bg-orange/5 p-4 rounded-2xl border border-orange/10 flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange text-white rounded-lg flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <p className="text-sm font-bold text-orange-900">{action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress System */}
        {plan.progressSystem && (
          <div className="bg-white p-6 rounded-[32px] card-shadow border-b-4 border-secondary">
            <h3 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">Progress System</h3>
            <p className="font-bold text-charcoal mb-1">{plan.progressSystem.metric}</p>
            <p className="text-sm text-gray-500">{plan.progressSystem.description}</p>
          </div>
        )}

        {/* Milestones */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-extrabold text-charcoal">Level Up Milestones</h3>
          <div className="flex flex-col gap-3">
            {plan.milestones.map((m, i) => (
              <div key={i} className={`p-4 rounded-2xl flex items-center justify-between ${m.achieved ? 'bg-sage/10' : 'bg-white card-shadow'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${m.achieved ? 'bg-sage text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <Trophy size={20} />
                  </div>
                  <div>
                    <p className={`font-bold ${m.achieved ? 'text-sage' : 'text-charcoal'}`}>{m.title}</p>
                    <p className="text-xs text-gray-400">Target: {m.targetDays} Days</p>
                  </div>
                </div>
                {m.achieved && <CheckCircle2 className="text-sage" size={20} />}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => { setShowGoalInput(true); setGoalStep("goal"); setQuestionAnswers({}); }}
          className="mt-4 py-4 text-gray-400 font-bold text-sm hover:text-charcoal transition-colors"
        >
          Reset & Create New Plan
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-sage" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-24 px-6">
      {aiDebug && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 break-words">
          <div className="font-bold mb-1">AI debug</div>
          {aiDebug}
          <button onClick={() => setAiDebug(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}
      <header className="flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-charcoal">Quit Plan</h1>
          {plan?.goalSummary && (
            <span className="text-[10px] font-bold text-sage uppercase tracking-widest flex items-center gap-1">
              <Zap size={10} /> Focus: {plan.goalSummary.title}
            </span>
          )}
        </div>
        <button 
          onClick={() => { setShowGoalInput(true); setGoalStep("goal"); setQuestionAnswers({}); }}
          className="p-2 bg-white rounded-full card-shadow text-sage flex items-center gap-2 text-xs font-bold px-4"
        >
          <Zap size={14} />
          {plan ? 'Update Focus' : 'Create Plan'}
        </button>
      </header>

      {!plan && !showGoalInput && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[24px] card-shadow text-center flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center text-sage">
            <Zap size={32} />
          </div>
          <h2 className="text-xl font-bold text-charcoal">Level Up Your Life</h2>
          <p className="text-sm text-gray-500">Quitting is about more than just stopping. It's about starting something new. Let's build your "Level Up" plan.</p>
          <button 
            onClick={() => handleGeneratePlan()}
            className="w-full py-4 bg-sage text-white rounded-full font-bold mt-4"
          >
            Generate Default Plan
          </button>
          <button 
            onClick={() => { setShowGoalInput(true); setGoalStep("goal"); setQuestionAnswers({}); }}
            className="text-sage font-bold text-sm"
          >
            I have a specific goal in mind
          </button>
        </motion.div>
      )}

      {createPortal(
        <AnimatePresence>
          {showGoalInput && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-background flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-6 pt-12">
                <div className="max-w-sm mx-auto flex flex-col gap-6">
                  <button
                    onClick={() => setShowGoalInput(false)}
                    className="self-end text-gray-400 p-2"
                  >
                    <X size={24} />
                  </button>

                  {goalStep === 'goal' && (
                    <>
                      <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center text-sage">
                        <Target size={24} />
                      </div>
                      <h2 className="text-xl font-bold text-charcoal">What's your focus?</h2>
                      <p className="text-sm text-gray-500">Instead of just "quitting", what is one big dream you want to achieve with the extra time and money? We'll tailor your daily routine to help you reach it.</p>

                      <div className="flex flex-wrap gap-2 mb-2">
                        {['Run a 5k', 'Build a Car', 'Learn to Code', 'Write a Book', 'Master Cooking'].map(g => (
                          <button
                            key={g}
                            onClick={() => setGoalText(g)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${goalText === g ? 'bg-sage text-white border-sage' : 'bg-white text-gray-500 border-gray-200 hover:border-sage'}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={goalText}
                        onChange={(e) => setGoalText(e.target.value)}
                        placeholder="e.g. I want to build a custom drift car and learn how to swap an engine..."
                        className="w-full p-6 bg-gray-50 rounded-[32px] text-sm border border-gray-100 focus:ring-2 focus:ring-sage outline-none min-h-[160px] font-bold text-charcoal placeholder:text-gray-200 transition-all"
                      />
                    </>
                  )}

                  {goalStep === 'questions' && (
                    <>
                      <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center text-sage">
                        <Zap size={24} />
                      </div>
                      <h2 className="text-xl font-bold text-charcoal">A few quick questions</h2>
                      <p className="text-sm text-gray-500">So we can tailor your plan for <span className="font-bold text-charcoal">{goalText}</span>.</p>

                      {FOLLOW_UP_QUESTIONS.map((q) => (
                        <div key={q.id} className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold uppercase tracking-widest text-charcoal">{q.label}</label>
                          <input
                            type="text"
                            value={questionAnswers[q.id] || ''}
                            onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder={q.placeholder}
                            className="w-full p-4 bg-gray-50 rounded-2xl text-sm border border-gray-100 focus:ring-2 focus:ring-sage outline-none font-medium text-charcoal placeholder:text-gray-300"
                          />
                        </div>
                      ))}

                      <button
                        onClick={() => setGoalStep('goal')}
                        className="text-[11px] font-bold uppercase tracking-widest text-gray-400 self-start"
                      >
                        ← back to goal
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-6 pb-10 bg-background border-t border-gray-100">
                {goalStep === 'goal' ? (
                  <button
                    onClick={startGoalFlow}
                    disabled={!goalText.trim() || generating}
                    className="w-full max-w-sm mx-auto block py-5 bg-charcoal text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 disabled:opacity-20 shadow-xl shadow-charcoal/20 active:scale-95 transition-all"
                  >
                    Next: Tailor your plan
                  </button>
                ) : (
                  <button
                    onClick={finalizePlan}
                    disabled={generating}
                    className="w-full max-w-sm mx-auto block py-5 bg-charcoal text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 disabled:opacity-20 shadow-xl shadow-charcoal/20 active:scale-95 transition-all"
                  >
                    {generating ? <Loader2 className="animate-spin" size={20} /> : 'Initialize Protocol'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {renderPlan()}
      
      {generating && (
        <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-[32px] card-shadow flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-sage" size={48} />
            <p className="font-bold text-charcoal animate-pulse">Adjusting your plan...</p>
          </div>
        </div>
      )}

      {/* Task Help Modal */}
      <AnimatePresence>
        {helpData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-charcoal/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[48px] p-8 card-shadow shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-sage/10 blur-[60px] rounded-full -mr-16 -mt-16" />
              
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="w-14 h-14 bg-sage/10 rounded-2xl flex items-center justify-center text-sage">
                  <Zap size={28} />
                </div>
                <button 
                  onClick={() => setHelpData(null)} 
                  className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-charcoal hover:bg-gray-100 transition-all font-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-10 relative z-10">
                <h2 className="text-2xl font-black text-charcoal mb-4 leading-tight tracking-tight uppercase">
                  {helpData.title}
                </h2>
                <div className="h-1.5 w-16 bg-sage rounded-full mb-6" />
                <p className="text-sm text-gray-600 leading-relaxed font-bold opacity-80">
                  {helpData.explanation}
                </p>
              </div>

              <div className="flex flex-col gap-4 relative z-10">
                <a 
                  href={helpData.youtubeLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-6 bg-charcoal text-white rounded-[24px] font-black flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-charcoal/20 hover:bg-sage"
                >
                  <Youtube size={28} fill="white" className="text-red-500" />
                  <span className="tracking-[0.1em] uppercase text-xs">Initialize Tutorial</span>
                </a>
                
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="w-1 h-1 bg-sage rounded-full animate-ping" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                    Sourced from verified repositories
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
