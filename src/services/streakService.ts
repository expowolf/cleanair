// Local-first streak tracker. Counts consecutive days the user marked any
// quit-plan task complete. Persisted in localStorage so it survives Firestore
// outages; the canonical longest-streak is also written to ProgressSnapshot
// when available.

const KEY = (uid: string) => `streak:${uid}`;

type StreakRecord = {
  dates: string[]; // ISO yyyy-mm-dd, sorted ascending, deduped
  longest: number;
};

const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function load(uid: string): StreakRecord {
  try {
    const raw = localStorage.getItem(KEY(uid));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { dates: [], longest: 0 };
}

function save(uid: string, rec: StreakRecord) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(rec)); } catch {}
}

// Walks back from today counting consecutive days present in `dates`.
export function computeCurrentStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  // Allow today OR yesterday as the latest active day (so a streak doesn't
  // visually reset until a full day of inactivity passes).
  if (!set.has(todayKey(d))) {
    d.setDate(d.getDate() - 1);
    if (!set.has(todayKey(d))) return 0;
  }
  while (set.has(todayKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getStreak(uid: string): { current: number; longest: number } {
  const rec = load(uid);
  return { current: computeCurrentStreak(rec.dates), longest: rec.longest };
}

export function markTodayActive(uid: string): { current: number; longest: number } {
  const rec = load(uid);
  const t = todayKey();
  if (!rec.dates.includes(t)) {
    rec.dates.push(t);
    rec.dates.sort();
    // Cap history to last 365 days so the array doesn't grow forever.
    if (rec.dates.length > 365) rec.dates = rec.dates.slice(-365);
  }
  const current = computeCurrentStreak(rec.dates);
  if (current > rec.longest) rec.longest = current;
  save(uid, rec);
  return { current, longest: rec.longest };
}

// ---- Notifications ----

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function notifPermission(): NotifPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifPermission;
}

export async function requestNotifications(): Promise<NotifPermission> {
  if (notifPermission() === 'unsupported') return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result as NotifPermission;
  } catch {
    return 'denied';
  }
}

// Schedules an in-page reminder at the next 9am local time. Web Notifications
// only fire while a tab is open; for installed PWAs on iOS 16.4+/Android this
// still works in the background once a service worker is registered. Without
// a SW it acts as a "next visit" reminder.
const REMINDER_TIMER_KEY = '__cleanair_reminder_timer';

export function scheduleDailyReminder(message = "Don't break your streak — open CleanAIr and crush today's task.") {
  if (notifPermission() !== 'granted') return;
  const w = window as any;
  if (w[REMINDER_TIMER_KEY]) clearTimeout(w[REMINDER_TIMER_KEY]);

  const now = new Date();
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  const ms = next.getTime() - now.getTime();

  w[REMINDER_TIMER_KEY] = setTimeout(() => {
    try { new Notification('CleanAIr', { body: message, icon: '/favicon.ico' }); } catch {}
    scheduleDailyReminder(message);
  }, ms);
}

// Fire a one-off "you're on a streak" toast notification right after the user
// completes their first task of the day.
export function fireStreakNotification(streak: number) {
  if (notifPermission() !== 'granted') return;
  try {
    new Notification('Streak +1', {
      body: streak === 1 ? "Day 1 — momentum starts now." : `${streak} day streak. Keep it lit.`,
      icon: '/favicon.ico',
    });
  } catch {}
}
