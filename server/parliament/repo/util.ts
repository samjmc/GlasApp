import { sql } from 'drizzle-orm';

/** Postgres caps a statement at 65,535 parameters; rows × columns stays well under it. */
export const INSERT_CHUNK = 500;

export function chunks<T>(rows: T[], size = INSERT_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * For an upsert that rewrites a row only when it changed: `set` takes each column from
 * `excluded`, and `changed` (the `setWhere`) compares the stored row with the incoming one.
 * `columns` maps each Drizzle key to its column name in `politics.<table>`.
 */
export function upsertChanged(table: string, columns: Record<string, string>) {
  const pairs = Object.entries(columns);
  const list = (prefix: string) => pairs.map(([, c]) => `${prefix}.${c}`).join(', ');
  return {
    set: Object.fromEntries(pairs.map(([key, c]) => [key, sql.raw(`excluded.${c}`)])),
    changed: sql.raw(`(${list(`politics.${table}`)}) is distinct from (${list('excluded')})`),
  };
}

/** Postgres SQLSTATE for "deadlock detected". */
const DEADLOCK = '40P01';
const DEADLOCK_ATTEMPTS = 3;

/**
 * Run a self-contained write again when Postgres aborts it as a deadlock victim. Only for
 * steps that are idempotent and run in their own transaction: the victim's work is rolled
 * back, so repeating it is safe. Measured 2026-09-24 on GlasCore: the first full sync died
 * with "deadlock detected" while another writer was updating the same score rows.
 */
export async function withDeadlockRetry<T>(fn: () => Promise<T>, attempts = DEADLOCK_ATTEMPTS, delayMs = 500): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
      if (code !== DEADLOCK || attempt >= attempts) throw error;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}
