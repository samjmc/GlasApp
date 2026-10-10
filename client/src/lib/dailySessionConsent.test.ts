/**
 * GET /api/daily-session needs political consent (it creates and stores the session), so every
 * caller of useDailySession must pass a flag that includes consent. A caller that passed only
 * `isAuthenticated` (the shell's streak chip) sent a 403 and raised an error toast on every page
 * for users who had not agreed. Read as text: the client has no component test setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('useDailySession callers', () => {
  // `function useDailySession(enabled: boolean)` is the definition, not a call.
  const calls = files(SRC).flatMap((file) =>
    [...fs.readFileSync(file, 'utf8').matchAll(/(function\s+)?useDailySession\(([^)]*)\)/g)]
      .filter((m) => !m[1])
      .map((m) => ({ file: path.relative(SRC, file), arg: m[2]!.trim() })),
  );

  it('finds the callers (a scan that matched nothing would pass vacuously)', () => {
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('every caller enables the query only with consent', () => {
    const ungated = calls.filter((c) => !/\bconsented\b/.test(c.arg)).map((c) => `${c.file}: useDailySession(${c.arg})`);
    expect(ungated).toEqual([]);
  });
});
