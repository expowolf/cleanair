import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  // Render a visible error so we don't end up with a blank white page.
  const msg =
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your hosting provider (Vercel → Settings → Environment Variables) and redeploy.';
  console.error(msg);
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `<pre style="padding:24px;font:14px ui-monospace,monospace;color:#b00;white-space:pre-wrap">${msg}</pre>`;
  }
  throw new Error(msg);
}

// Explicitly persist the session in localStorage so users stay logged in across
// reloads and when the app is launched standalone from the home screen (PWA).
// `persistSession` + `autoRefreshToken` are Supabase defaults, but we set them
// explicitly so they can't silently change.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
