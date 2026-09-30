/**
 * src/lib/seedData.ts
 *
 * Generates 12 nights of realistic fake sleep history and writes them to
 * Supabase via saveLog(). Called once after onboarding profile creation,
 * only when the user has zero existing logs.
 *
 * Shape of the generated data:
 *  - Night 0 (oldest): bedtime ~60-90 min later than target
 *  - Night 11 (most recent): bedtime close to or at target
 *  - Day-to-day noise of ±0-15 min keeps it non-linear / realistic
 *  - barrier_tag: random from baselineBarriers each night
 *  - intervention_completed: ~60% overall, weighted toward true on recent nights
 *  - is_seed_data: true on all rows
 */

import { saveLog, getLogs } from './dataStore';
import type { BarrierTag, SleepLogInput } from './types';
import { timeToMinutes, localISODate } from './timeMath';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEED_NIGHTS = 12;

/** How many minutes LATE the first night's bedtime starts vs. target */
const INITIAL_OFFSET_MIN = 75; // midpoint of 60-90

/** The trend narrows by this many minutes per night on average */
const TREND_REDUCTION_PER_NIGHT = INITIAL_OFFSET_MIN / (SEED_NIGHTS - 1); // ≈ 6.8 min/night

/** Max random noise added/subtracted each night (realistic variance) */
const NOISE_MAX = 15;

/**
 * Probability of intervention_completed = true for each night index (0 = oldest).
 * Starts at ~35% and ramps up to ~90% on the most recent night.
 */
function interventionProbability(nightIndex: number): number {
  // Linear ramp from 0.35 → 0.90 over SEED_NIGHTS
  return 0.35 + (0.55 * nightIndex) / (SEED_NIGHTS - 1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert total minutes since midnight back to "HH:MM:SS" */
function minutesToTime(totalMinutes: number): string {
  // Wrap around midnight (e.g. 25:00 → 01:00 next day, stored as 01:00:00)
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Return an ISO date string (YYYY-MM-DD) for `daysAgo` days before today */
function dateForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localISODate(d);
}

/** Seeded-ish random integer in [min, max] (inclusive). Uses Math.random(). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Generate and persist 12 seed sleep_log rows.
 *
 * @param targetBedtime   User's target bedtime from profile, e.g. "23:00:00"
 * @param baselineBarriers  Array of BarrierTag strings chosen at onboarding
 * @returns Number of rows successfully written (0-12)
 */
export async function generateSeedHistory(
  targetBedtime: string,
  baselineBarriers: BarrierTag[]
): Promise<number> {
  if (!targetBedtime) {
    console.warn('[seedData] No targetBedtime provided — skipping seed generation.');
    return 0;
  }

  // Gracefully fall back if no barriers were selected
  const barriers: BarrierTag[] =
    baselineBarriers.length > 0
      ? baselineBarriers
      : ['phone', 'gaming', 'overthinking', 'me_time'];

  const targetMinutes = timeToMinutes(targetBedtime);
  let written = 0;

  // Night 0 = oldest (SEED_NIGHTS days ago), Night 11 = most recent (1 day ago)
  for (let i = 0; i < SEED_NIGHTS; i++) {
    const nightIndex = i; // 0 = oldest
    const daysAgo = SEED_NIGHTS - i; // 12 → 1

    // Trending offset: starts at INITIAL_OFFSET_MIN, reduces toward 0
    const trendOffset = INITIAL_OFFSET_MIN - TREND_REDUCTION_PER_NIGHT * nightIndex;

    // Day-to-day noise: ±NOISE_MAX minutes, biased toward 0 as trend improves
    const noise = randInt(-NOISE_MAX, NOISE_MAX);

    // Clamp so we never go earlier than target (seed data shouldn't look suspiciously perfect)
    const finalOffset = Math.max(0, Math.round(trendOffset + noise));
    const bedtimeMinutes = targetMinutes + finalOffset;

    // Fall-asleep time: 10-30 min after bedtime (realistic sleep latency)
    const sleepLatency = randInt(10, 30);
    const fallAsleepMinutes = bedtimeMinutes + sleepLatency;

    // Wake time: 6.5-8 hours after fall-asleep time
    const sleepDurationMinutes = randInt(6 * 60 + 30, 8 * 60);
    const wakeMinutes = fallAsleepMinutes + sleepDurationMinutes;

    // Intervention: weighted probability toward true on recent nights
    const interventionCompleted = Math.random() < interventionProbability(nightIndex);

    // Mood: loosely correlated with how close bedtime was to target
    // Earlier = better mood; late nights weight toward 2-3, on-target weight 3-5
    const moodBase = finalOffset <= 15 ? randInt(3, 5) : randInt(2, 4);
    const mood = Math.min(5, Math.max(1, moodBase)) as 1 | 2 | 3 | 4 | 5;

    const log: SleepLogInput = {
      date: dateForDaysAgo(daysAgo),
      bedtime: minutesToTime(bedtimeMinutes),
      fall_asleep_time: minutesToTime(fallAsleepMinutes),
      wake_time: minutesToTime(wakeMinutes),
      barrier_tag: randomPick(barriers),
      intervention_completed: interventionCompleted,
      mood,
      is_seed_data: true,
    };

    const result = await saveLog(log);
    if (result) {
      written++;
    } else {
      console.warn(`[seedData] Failed to save seed log for ${log.date}`);
    }
  }

  console.log(`[seedData] Generated ${written}/${SEED_NIGHTS} seed nights.`);
  return written;
}

// ── Guard helper ──────────────────────────────────────────────────────────────

/**
 * Returns true if the current user already has sleep logs (seed or real).
 * Use this before calling generateSeedHistory() to prevent duplicate seeding.
 */
export async function userHasLogs(): Promise<boolean> {
  const logs = await getLogs(1);
  return logs.length > 0;
}
