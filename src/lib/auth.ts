/**
 * src/lib/auth.ts
 *
 * Email + one-time-code auth (no anonymous sessions). Sign-up and sign-in both go
 * through signInWithOtp/verifyOtp — Supabase creates the account on first verify.
 * Session is persisted automatically by the Supabase client via AsyncStorage.
 */

import { supabase } from './supabase';

/** Returns the user ID of the currently active session, or null if none. */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      console.error('[auth] getSession error:', error.message);
      return null;
    }
    return session?.user?.id ?? null;
  } catch (err) {
    console.error('[auth] Unexpected error in getCurrentUserId:', err);
    return null;
  }
}

/** Email of the current signed-in user, or null if signed out. */
export async function getCurrentEmail(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** true if a signed-in session currently exists. */
export async function hasSession(): Promise<boolean> {
  return (await getCurrentUserId()) !== null;
}

// ── Email OTP: one flow for both sign-up and sign-in ──────────────────────────

/** Send a 6-digit code to `email`. Creates the account on first use. */
export async function sendLoginCode(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return error?.message ?? null;
}

/** Verify the code and complete sign-in/sign-up. Returns an error message or null on success. */
export async function verifyLoginCode(email: string, token: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Subscribe to auth state changes (sign-in, sign-out, token refresh).
 * Returns the unsubscribe function — call it in a useEffect cleanup.
 */
export function subscribeToAuthChanges(
  onUserChange: (userId: string | null) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    onUserChange(session?.user?.id ?? null);
  });
  return () => subscription.unsubscribe();
}
