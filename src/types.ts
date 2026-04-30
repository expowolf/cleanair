export type NicotineType = 'Vape' | 'Cigarettes' | 'Both' | 'Other';
export type UsageHabits = 'Multiple times a day' | 'Once a day' | 'A few times a week';
export type Trigger = 'Stress' | 'Boredom' | 'Social situations' | 'After meals' | 'Morning routine' | 'Anxiety';
export type QuitMethod = 'Cold Turkey' | 'Gradual Reduction';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  nicotineType?: NicotineType;
  usageHabits?: UsageHabits;
  triggers?: Trigger[];
  quitMethod: QuitMethod;
  quitDate: string;
  weeklySpend: number;
  whyIQuit: string;
  nicotineReplacement?: string;
  otherProducts?: string;
  motivationLevel?: number;
  routineStyle?: 'Strict' | 'Flexible';
  favoriteStrategies?: string[];
  onboardingComplete: boolean;
  relapseCount?: number;
  lastRelapseDate?: string | null;
  lifestyleInfo?: string;
  freeTime?: string;
  goals?: string[];
  settings?: {
    notifications?: {
      cravings: boolean;
      community: boolean;
      milestones: boolean;
      planUpdates: boolean;
      marketing: boolean;
    };
    privacy?: {
      publicProfile: boolean;
      showStreak: boolean;
      showProgress: boolean;
      allowMessages: boolean;
    };
    appearance?: {
      theme: 'light' | 'dark' | 'system';
      compactMode: boolean;
      highContrast: boolean;
    };
    units?: {
      currency: string;
      dateFormat: string;
    };
  };
}

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes: string[]; // Array of UIDs
  commentCount: number;
  repostCount: number;
  repostedFrom?: string; // Original post ID if it's a repost
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  type: 'dm' | 'group';
  participants: string[]; // Array of UIDs
  name?: string; // For groups
  description?: string; // For groups
  ownerId?: string; // For groups
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  groupType?: 'support' | 'fitness' | 'productivity' | 'learning' | 'other';
  participantCount?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  readBy: string[]; // Array of UIDs
}

export interface Report {
  id: string;
  reporterId: string;
  targetId: string; // Post ID, Comment ID, or User ID
  targetType: 'post' | 'comment' | 'user';
  reason: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

export interface CravingEntry {
  id?: string;
  timestamp: string;
  triggerType?: string;
  intensity?: number;
  actionTaken?: string;
  suggestedAction?: string;
  feedback?: 'helpful' | 'not_helpful';
  isSaved?: boolean;
}

export interface DailyTask {
  id: string;
  title: string;
  description: string;
  category: 'exercise' | 'mindfulness' | 'habit' | 'learning' | 'productivity' | 'other';
  timeSlot: 'Morning' | 'Midday' | 'Evening';
  completed: boolean;
  completedAt?: string | null;
  feedback?: 'too_easy' | 'just_right' | 'too_hard';
}

export interface QuitPlan {
  id?: string;
  userId: string;
  generatedAt: string;
  goal?: string | null;
  goalSummary: {
    title: string;
    whyItMatters: string;
  };
  weeklyStructure: {
    week: number;
    milestone: string;
  }[];
  tasks: DailyTask[];
  habitReplacements: { trigger: string; suggestion: string }[];
  cravingResponsePlan: string[];
  progressSystem: {
    metric: string;
    description: string;
  };
  milestones: { title: string; targetDays: number; achieved: boolean }[];
  status: 'active' | 'completed' | 'adjusting';
  goalContext?: {
    level: string;
    availability: string;
    motivation: string;
    answers: Record<string, string>;
  } | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'streak' | 'cravings' | 'tasks' | 'social' | 'special';
  requirement: number; // e.g., 7 days streak, 10 cravings resisted
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
}

export interface ProgressSnapshot {
  uid: string;
  streakData: Record<string, number>; // date string -> streak
  goalsCompleted: number;
  moneySaved: number;
  cravingsResisted: number;
  cravingsTotal: number;
  tasksCompletedTotal: number;
  longestStreak: number;
  podsAvoided?: number;
  timeSavedMinutes?: number;
  lastUpdated: string;
  unlockedAchievements?: string[]; // Array of achievement IDs
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
