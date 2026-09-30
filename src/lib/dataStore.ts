/**
 * src/lib/dataStore.ts
 *
 * Supabase-backed data access layer.
 * All functions are async and return null / empty array on any error — they
 * never throw, so the app survives flaky demo wifi without crashing.
 *
 * Functions:
 *   getProfile()           → Profile | null
 *   saveProfile(input)     → Profile | null
 *   getLogs(limit?)        → SleepLog[]
 *   saveLog(input)         → SleepLog | null
 *   updateLog(id, changes) → SleepLog | null
 */

import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { circularDiffMinutes } from './timeMath';
import type { Profile, ProfileInput, SleepLog, SleepLogInput, SleepLogUpdate } from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolves the current user ID and logs a warning if none is available.
 * Returns null when the caller should bail out early.
 */
async function requireUserId(fnName: string): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (!uid) {
    console.warn(`[dataStore.${fnName}] No authenticated user — skipping.`);
  }
  return uid;
}

function logError(fnName: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[dataStore.${fnName}] Error:`, msg);
}

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's profile row.
 * Returns null if the row doesn't exist yet (first launch) or on any error.
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const uid = await requireUserId('getProfile');
    if (!uid) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      logError('getProfile', error);
      return null;
    }

    return data as Profile | null;
  } catch (err) {
    logError('getProfile', err);
    return null;
  }
}

/**
 * Upsert the current user's profile row.
 * Returns the saved Profile on success, null on failure.
 */
export async function saveProfile(input: ProfileInput): Promise<Profile | null> {
  try {
    const uid = await requireUserId('saveProfile');
    if (!uid) return null;

    const row: Profile = { ...input, id: uid };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      logError('saveProfile', error);
      return null;
    }

    return data as Profile;
  } catch (err) {
    logError('saveProfile', err);
    return null;
  }
}

// ── Sleep Logs ────────────────────────────────────────────────────────────────

/**
 * Fetch sleep logs for the current user, newest first.
 * @param limit  Max rows to return (default: 60 — covers ~2 months)
 * Returns an empty array on any error.
 */
export async function getLogs(limit: number = 60): Promise<SleepLog[]> {
  try {
    const uid = await requireUserId('getLogs');
    if (!uid) return [];

    const { data, error } = await supabase
      .from('sleep_logs')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      logError('getLogs', error);
      return [];
    }

    return (data ?? []) as SleepLog[];
  } catch (err) {
    logError('getLogs', err);
    return [];
  }
}

/**
 * Insert (or update, if a log for that date already exists) a sleep_logs row for the current user.
 * Returns the inserted row on success, null on failure.
 */
export async function saveLog(input: SleepLogInput): Promise<SleepLog | null> {
  try {
    const uid = await requireUserId('saveLog');
    if (!uid) return null;

    const row = { ...input, user_id: uid };

    const { data, error } = await supabase
      .from('sleep_logs')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) {
      logError('saveLog', error);
      return null;
    }

    return data as SleepLog;
  } catch (err) {
    logError('saveLog', err);
    return null;
  }
}

/**
 * Patch an existing sleep_logs row by its UUID.
 * Only the current user can update their own rows (enforced by RLS).
 * Returns the updated row on success, null on failure.
 */
export async function updateLog(
  id: string,
  changes: SleepLogUpdate
): Promise<SleepLog | null> {
  try {
    const uid = await requireUserId('updateLog');
    if (!uid) return null;

    const { data, error } = await supabase
      .from('sleep_logs')
      .update(changes)
      .eq('id', id)
      .eq('user_id', uid) // belt-and-suspenders alongside RLS
      .select()
      .single();

    if (error) {
      logError('updateLog', error);
      return null;
    }

    return data as SleepLog;
  } catch (err) {
    logError('updateLog', err);
    return null;
  }
}

/** Delete this user's synthetic demo rows (is_seed_data = true). Returns true on success. */
export async function deleteSeedLogs(): Promise<boolean> {
  try {
    const uid = await requireUserId('deleteSeedLogs');
    if (!uid) return false;
    const { error } = await supabase
      .from('sleep_logs')
      .delete()
      .eq('user_id', uid)
      .eq('is_seed_data', true);
    if (error) {
      logError('deleteSeedLogs', error);
      return false;
    }
    return true;
  } catch (err) {
    logError('deleteSeedLogs', err);
    return false;
  }
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/**
 * Current consecutive-nights streak: nights (real data only) whose bedtime was within
 * 30 minutes of target, on consecutive calendar dates. Handles midnight wrap.
 *
 * @param logs          Result of getLogs() — newest-first
 * @param targetBedtime HH:MM:SS string from profile
 */
export function calculateStreak(logs: SleepLog[], targetBedtime: string): number {
  if (!targetBedtime) return 0;

  let streak = 0;
  let prevDate: string | null = null;
  for (const log of logs) {
    if (log.is_seed_data) continue;
    if (!log.bedtime) break;
    if (prevDate && dayDiff(log.date, prevDate) !== 1) break; // gap in logging
    if (circularDiffMinutes(log.bedtime, targetBedtime) > 30) break;
    streak++;
    prevDate = log.date;
  }
  return streak;
}

/** Whole days from a to b (YYYY-MM-DD strings), b - a. */
function dayDiff(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000
  );
}
