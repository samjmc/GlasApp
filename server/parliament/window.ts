/**
 * Pure: which dates a sync reads, and how far it may then claim to have ingested.
 */

/** Days re-read before the resume point. Transcripts can appear a week or more late. */
export const OVERLAP_DAYS = 14;

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Where a feed starts: an explicit `since`, else the resume point minus the overlap, else the Dáil's first day. */
export function startDate(since: string | undefined, throughDate: string | null, dailStart: string): string {
  if (since) return since;
  if (!throughDate) return dailStart;
  const resume = addDays(throughDate, -OVERLAP_DAYS);
  return resume < dailStart ? dailStart : resume;
}

/**
 * What to store as "ingested through" after a run: today, unless `since` started LATER
 * than a normal run would have — then the days between were never fetched, and moving the
 * resume point to today would skip them for good. NULL keeps the stored value.
 */
export function resumePoint(since: string | undefined, throughDate: string | null, dailStart: string, today: string): string | null {
  if (!since) return today;
  return since <= startDate(undefined, throughDate, dailStart) ? today : null;
}
