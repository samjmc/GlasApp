/**
 * "Not now" for the daily vote. The app opens the daily session once per day for a signed-in
 * user who has not finished it; closing it (X) must stay closed for the rest of that day, or the
 * close button does nothing. The day is the Dublin calendar date, as on the server.
 */

const KEY = 'glas.daily.dismissed';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** The Dublin calendar date, YYYY-MM-DD. */
export function dublinDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function browserStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Kept in memory too, so "closed" holds for this page load even when storage is unavailable.
let dismissedInMemory: string | null = null;

export function dismissDailyForToday(now: Date = new Date(), store: Store | null = browserStore()): void {
  const today = dublinDate(now);
  dismissedInMemory = today;
  try {
    store?.setItem(KEY, today);
  } catch {
    /* storage full or blocked: the in-memory copy still holds */
  }
}

export function isDailyDismissedToday(now: Date = new Date(), store: Store | null = browserStore()): boolean {
  const today = dublinDate(now);
  if (dismissedInMemory === today) return true;
  try {
    return store?.getItem(KEY) === today;
  } catch {
    return false;
  }
}

/** For tests: forget the in-memory copy. */
export function resetDailyDismissalForTests(): void {
  dismissedInMemory = null;
}
