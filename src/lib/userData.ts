// Cross-device data sync via Supabase. Stores per-user state as JSONB so we
// can add fields without schema migrations. Server-side RLS enforces that
// each user can only read/write their own row.
import { supabase } from './supabase';

const TABLE = 'user_data';

export type UserData = {
  profile?: any;
  plan?: any;
  progress?: any;
  cravings?: any[];
  posts_local?: any[]; // user's own pending posts
};

export async function loadUserData(uid: string): Promise<UserData | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) {
    console.warn('[userData] load failed', error.message);
    return null;
  }
  return (data?.data as UserData) || null;
}

// Merge-patch the user's data row. Reads current, merges, upserts.
export async function patchUserData(uid: string, patch: Partial<UserData>): Promise<void> {
  const current = (await loadUserData(uid)) || {};
  const merged: UserData = { ...current, ...patch };
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: uid, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.warn('[userData] patch failed', error.message);
}

// Best-effort sync with a hard timeout so UI never hangs.
export function patchUserDataBestEffort(uid: string, patch: Partial<UserData>, timeoutMs = 4000) {
  Promise.race([
    patchUserData(uid, patch),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
  ]).catch((e) => console.warn('[userData] sync skipped', e?.message || e));
}
