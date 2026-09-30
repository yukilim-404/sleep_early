/** Convert "HH:MM" or "HH:MM:SS" to minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

/** Shortest distance between two clock times, in minutes (wraps at midnight). */
export function circularDiffMinutes(a: string, b: string): number {
  const d = Math.abs(timeToMinutes(a) - timeToMinutes(b));
  return Math.min(d, 1440 - d);
}

/** Signed minutes of `bedtime` relative to `target`; positive = later. e.g. 00:10 vs 23:00 = +70. */
export function signedBedtimeOffset(bedtime: string, target: string): number {
  let d = timeToMinutes(bedtime) - timeToMinutes(target);
  if (d > 720) d -= 1440;
  if (d <= -720) d += 1440;
  return d;
}

/** Minutes for plotting a bedtime on a night axis: after-midnight (before noon) times get +1440. */
export function nightAxisMinutes(bedtime: string): number {
  const m = timeToMinutes(bedtime);
  return m < 720 ? m + 1440 : m;
}

/** Local (not UTC) calendar date as YYYY-MM-DD. */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
