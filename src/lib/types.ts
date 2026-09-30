/**
 * src/lib/types.ts
 *
 * Shared TypeScript interfaces matching the Supabase schema exactly.
 * Used across dataStore, seedData, and all screens.
 */

// ── Profile ───────────────────────────────────────────────────────────────────

export interface Profile {
  /** UUID — matches auth.users(id) */
  id: string;
  /** Target bedtime, stored as HH:MM:SS (e.g. "23:00:00") */
  target_bedtime: string;
  /** Target wake time, stored as HH:MM:SS (e.g. "07:00:00") */
  wake_time: string;
  /** Days the user works, e.g. ['mon','tue','wed','thu','fri'] */
  workdays: Workday[];
  /** IANA timezone string, e.g. "Asia/Singapore" */
  timezone: string;
  /** Barriers selected during onboarding */
  baseline_barriers: BarrierTag[];
  created_at?: string;
}

/** Subset used when creating/updating — id is always the current user's */
export type ProfileInput = Omit<Profile, 'id' | 'created_at'>;

// ── Sleep Log ─────────────────────────────────────────────────────────────────

export interface SleepLog {
  id: string;
  user_id: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Bedtime as HH:MM:SS (recorded when user taps "Going to sleep now") */
  bedtime: string | null;
  /** Time user actually fell asleep (entered next morning) */
  fall_asleep_time: string | null;
  /** Wake time (entered next morning) */
  wake_time: string | null;
  /** Which barrier triggered the check-in */
  barrier_tag: BarrierTag | null;
  /** Whether the user completed the intervention flow */
  intervention_completed: boolean;
  /** Self-reported mood 1–5 (optional) */
  mood: 1 | 2 | 3 | 4 | 5 | null;
  /** True for the synthetic history generated at onboarding */
  is_seed_data: boolean;
  created_at?: string;
}

/** Subset used when inserting a new log — id/user_id are filled by dataStore */
export type SleepLogInput = Omit<SleepLog, 'id' | 'user_id' | 'created_at'>;

/** Subset allowed when patching an existing log */
export type SleepLogUpdate = Partial<
  Pick<
    SleepLog,
    | 'bedtime'
    | 'fall_asleep_time'
    | 'wake_time'
    | 'barrier_tag'
    | 'intervention_completed'
    | 'mood'
  >
>;

// ── Enums / literals ──────────────────────────────────────────────────────────

export type BarrierTag = 'phone' | 'gaming' | 'work' | 'overthinking' | 'me_time';

export type Workday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const BARRIER_LABELS: Record<BarrierTag, string> = {
  phone: '📱 Phone / Doomscrolling',
  gaming: '🎮 Gaming',
  work: '💼 Unfinished Work',
  overthinking: '🧠 Overthinking',
  me_time: '🌟 Not Enough Me-Time',
};

export const WORKDAY_LABELS: Record<Workday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};
