/** Postgres caps a statement at 65,535 parameters; rows × columns stays well under it. */
export const INSERT_CHUNK = 500;

export function chunks<T>(rows: T[], size = INSERT_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
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
