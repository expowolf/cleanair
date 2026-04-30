import { UserProfile, QuitPlan, DailyTask } from "../types";
import { generatePlanWithAI, isAIAvailable } from "./aiService";

const GOAL_TEMPLATES: Record<string, any> = {
  'Run a 5k': {
    title: '5K Endurance Protocol',
    whyItMatters: 'Trading smoke for lung capacity. Every day you don\'t vape, your VO2 max increases.',
    milestones: [
      { title: 'Breath Control', targetDays: 3 },
      { title: 'First 1km Non-Stop', targetDays: 7 },
      { title: 'Interval Mastery', targetDays: 14 },
      { title: 'The full 5K', targetDays: 30 },
    ],
    tasks: [
      { id: 't1', title: 'Deep Inhalation Exercise', description: '5 mins of focused belly breathing to expand lung volume.', timeSlot: 'Morning', category: 'exercise' },
      { id: 't2', title: 'Interval Jog', description: '15 mins switch between power walking and jogging.', timeSlot: 'Midday', category: 'exercise' },
      { id: 't3', title: 'Hydration & Mobility', description: 'Drink 500ml water and 5 mins leg stretching.', timeSlot: 'Evening', category: 'habit' },
    ]
  },
  'Learn to Code': {
    title: 'Neural Rewiring Protocol',
    whyItMatters: 'Replace dopamine loops from nicotine with the dopamine hit of solving a bug.',
    milestones: [
      { title: 'Syntax Fluency', targetDays: 3 },
      { title: 'Logic Foundation', targetDays: 7 },
      { title: 'First Mini-Project', targetDays: 14 },
      { title: 'The Deployment', targetDays: 30 },
    ],
    tasks: [
      { id: 't1', title: 'Documentation Deep Dive', description: 'Read 3 pages of documentation for your chosen language.', timeSlot: 'Morning', category: 'learning' },
      { id: 't2', title: 'Logic Sprints', description: 'Solve 1 small logic puzzle or leetcode easy.', timeSlot: 'Midday', category: 'productivity' },
      { id: 't3', title: 'Code Review', description: 'Look at a GitHub repo and try to understand one function.', timeSlot: 'Evening', category: 'learning' },
    ]
  },
  'generic': {
    title: 'CleanAIr Prime Protocol',
    whyItMatters: 'Regaining total control over your neurochemistry and time.',
    milestones: [
      { title: 'Chemical Independence', targetDays: 3 },
      { title: 'Routine Solidification', targetDays: 7 },
      { title: 'Clarity of Mind', targetDays: 14 },
      { title: 'Peak Performance', targetDays: 30 },
    ],
    tasks: [
      { id: 't1', title: 'Morning Visualization', description: '3 mins visualizing your day without a single craving.', timeSlot: 'Morning', category: 'mindfulness' },
      { id: 't2', title: 'Dopamine Reset', description: 'Walk outside for 10 mins without any digital devices.', timeSlot: 'Midday', category: 'habit' },
      { id: 't3', title: 'Daily Audit', description: 'Reflect on your hardest moment today and how you beat it.', timeSlot: 'Evening', category: 'productivity' },
    ]
  }
};

export async function generatePersonalizedPlan(
  profile: UserProfile,
  specificGoal?: string,
  goalContext?: { level: string; availability: string; motivation: string; answers: Record<string, string> }
): Promise<QuitPlan> {
  const goal = specificGoal || 'General Cessation';

  // Try AI first; fall back to static template if unavailable or fails.
  if (isAIAvailable()) {
    try {
      const ai = await generatePlanWithAI({
        goal,
        profile: {
          nicotineType: profile.nicotineType,
          weeklySpend: profile.weeklySpend,
          whyIQuit: profile.whyIQuit,
          quitMethod: profile.quitMethod,
          triggers: profile.triggers,
          motivationLevel: profile.motivationLevel,
        },
      });
      return {
        userId: profile.uid,
        generatedAt: new Date().toISOString(),
        goal,
        goalSummary: { title: ai.title, whyItMatters: ai.whyItMatters },
        weeklyStructure: [
          { week: 1, milestone: 'Stabilization & Habit Mapping' },
          { week: 2, milestone: 'Active Engagement & Load Increase' },
          { week: 3, milestone: 'Recovery Testing' },
          { week: 4, milestone: 'Peak Integration' },
        ],
        tasks: ai.tasks.map((t) => ({ ...t, completed: false } as DailyTask)),
        habitReplacements: ai.habitReplacements,
        cravingResponsePlan: ai.cravingResponsePlan,
        progressSystem: { metric: 'Protocol Adherence', description: 'Percentage of tasks completed without deviation.' },
        milestones: ai.milestones.map((m) => ({ ...m, achieved: false })),
        status: 'active',
        goalContext: goalContext || null,
      } as QuitPlan;
    } catch (e) {
      console.error('AI plan generation failed, using template fallback', e);
    }
  }

  // Fallback: static template
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const template = GOAL_TEMPLATES[specificGoal as string] || GOAL_TEMPLATES['generic'];

  return {
    userId: profile.uid,
    generatedAt: new Date().toISOString(),
    goal,
    goalSummary: {
      title: template.title,
      whyItMatters: template.whyItMatters
    },
    weeklyStructure: [
      { week: 1, milestone: 'Stabilization & Habit Mapping' },
      { week: 2, milestone: 'Active Engagement & Load Increase' },
      { week: 3, milestone: 'Recovery Testing' },
      { week: 4, milestone: 'Peak Integration' },
    ],
    tasks: template.tasks.map((t: any) => ({ ...t, completed: false })),
    habitReplacements: [
      { trigger: 'Stress', suggestion: '30s box breathing or 5 pushups' },
      { trigger: 'Boredom', suggestion: 'Open the CleanAIr Learning module' },
      { trigger: 'Social', suggestion: 'Order a sparkling water with lime' },
    ],
    cravingResponsePlan: [
      'Stop moving and stand tall',
      'Exhale completely and hold for 4 seconds',
      'Recall your Primary Protocol Anchor'
    ],
    progressSystem: {
      metric: 'Protocol Adherence',
      description: 'Percentage of tasks completed without deviation.'
    },
    milestones: template.milestones.map((m: any) => ({ ...m, achieved: false })),
    status: 'active',
    goalContext: goalContext || null
  };
}

export async function askFollowUpQuestions(_profile: UserProfile, _interest: string): Promise<string[]> {
  // Static questions for launch stability
  return [
    "What is your current experience level with this goal?",
    "How many minutes can you realistically commit daily?",
    "What is the biggest obstacle you've faced with this in the past?"
  ];
}

export async function adjustPlan(currentPlan: QuitPlan, feedback: { taskId: string; feedback: string }[]): Promise<QuitPlan> {
  // Simple deterministic adjustment
  const hasHard = feedback.some(f => f.feedback === 'too_hard');
  
  return {
    ...currentPlan,
    generatedAt: new Date().toISOString(),
    tasks: currentPlan.tasks.map(t => {
      if (hasHard) {
        return { ...t, description: t.description + " (Reduced Intensity)" };
      }
      return t;
    }),
    status: 'active'
  };
}
