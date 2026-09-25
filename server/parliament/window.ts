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

/** First days of every month from the one containing `from` to the one containing `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(`${key}-01`);
    if (key >= endKey) return out;
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
}

/** Last day of a month, given its first day. */
export function monthEnd(first: string): string {
  const [y, m] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))];
  return isoDate(new Date(Date.UTC(y, m, 0)));
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
