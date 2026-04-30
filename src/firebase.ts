import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { supabase } from './lib/supabase';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Auth is now provided by Supabase. We expose a minimal `auth` shim so that
// existing code referring to `auth.currentUser.uid`, `auth.currentUser.email`,
// etc. keeps working without a sweeping refactor.
type ShimUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: { providerId: string }[];
};

const toShim = (u: any): ShimUser | null =>
  u
    ? {
        uid: u.id,
        email: u.email ?? null,
        displayName:
          u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        photoURL: u.user_metadata?.avatar_url ?? null,
        emailVerified: !!u.email_confirmed_at,
        isAnonymous: false,
        tenantId: null,
        providerData: ((u.app_metadata?.providers as string[] | undefined) ??
          (u.app_metadata?.provider ? [u.app_metadata.provider] : []))
          .map((p) => ({ providerId: p })),
      }
    : null;

export const auth: { currentUser: ShimUser | null } = { currentUser: null };

supabase.auth.getSession().then(({ data }) => {
  auth.currentUser = toShim(data.session?.user);
});
supabase.auth.onAuthStateChange((_event, session) => {
  auth.currentUser = toShim(session?.user);
});

export default app;
