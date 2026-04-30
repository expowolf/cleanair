import { Achievement } from '../types';

export const ACHIEVEMENTS: Achievement[] = [
  // Streak Achievements
  {
    id: 'streak_1',
    title: 'First Step',
    description: 'Complete 24 hours nicotine-free.',
    icon: '🌱',
    category: 'streak',
    requirement: 1
  },
  {
    id: 'streak_3',
    title: 'Three Day War',
    description: 'Survive the first 72 hours.',
    icon: '🔥',
    category: 'streak',
    requirement: 3
  },
  {
    id: 'streak_7',
    title: 'One Week Strong',
    description: '7 days of pure lung air.',
    icon: '💪',
    category: 'streak',
    requirement: 7
  },
  {
    id: 'streak_14',
    title: 'Two Week Fortitude',
    description: '14 days of resilience.',
    icon: '🛡️',
    category: 'streak',
    requirement: 14
  },
  {
    id: 'streak_30',
    title: 'Moon Mission',
    description: 'One full month without a single puff.',
    icon: '🏆',
    category: 'streak',
    requirement: 30
  },
  
  // Resistance Achievements
  {
    id: 'resist_1',
    title: 'First Stand',
    description: 'Resist your first craving using Craving Mode.',
    icon: '🛑',
    category: 'cravings',
    requirement: 1
  },
  {
    id: 'resist_10',
    title: 'Urge Master',
    description: 'Resist 10 individual cravings.',
    icon: '⚡',
    category: 'cravings',
    requirement: 10
  },
  {
    id: 'resist_50',
    title: 'Iron Will',
    description: '50 cravings suppressed. You are in control.',
    icon: '💎',
    category: 'cravings',
    requirement: 50
  },

  // Task Achievements
  {
    id: 'tasks_5',
    title: 'Habit Builder',
    description: 'Complete 5 daily tasks in your plan.',
    icon: '📝',
    category: 'tasks',
    requirement: 5
  },
  {
    id: 'tasks_20',
    title: 'Protocol Dedicated',
    description: 'Complete 20 daily tasks.',
    icon: '⚙️',
    category: 'tasks',
    requirement: 20
  },

  // Social Achievements
  {
    id: 'social_post',
    title: 'Network Sync',
    description: 'Share your first status update in the feed.',
    icon: '📡',
    category: 'social',
    requirement: 1
  },
  {
    id: 'social_join',
    title: 'Clan Member',
    description: 'Join your first community clan.',
    icon: '👥',
    category: 'social',
    requirement: 1
  }
];
