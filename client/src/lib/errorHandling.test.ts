/**
 * Errors are told apart by ApiError's status and code, never by message text: a server copy edit
 * broke the daily session's "new day has started" recovery, and "failed to fetch" is Chrome's
 * wording only (Safari says "Load failed"). And the global query-error toast is opt-in, because
 * pages already show their own error state. Read as text: the client has no component test setup.
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

describe('error handling', () => {
  const sources = files(SRC).map((file) => ({ file: path.relative(SRC, file), text: fs.readFileSync(file, 'utf8') }));

  it('scans the client (a scan of nothing would pass vacuously)', () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it('no code matches error text for a status or a network failure', () => {
    const offenders = sources
      .filter(({ text }) => /\.(includes|startsWith)\(\s*["'`](failed to fetch|\d{3}:)|\/[^/\n]*session has ended[^/\n]*\/i?/i.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('the daily session branches on status 409 and on status 0', () => {
    const page = sources.find(({ file }) => file.endsWith('DailySessionPage.tsx'))!.text;
    expect(page).toMatch(/isApiError\(error, 409\)/);
    expect(page).toMatch(/isApiError\(mutationError, 0\)/);
  });

  it('the query-error toast fires only for queries that opt in', () => {
    const boundary = sources.find(({ file }) => file.endsWith('ErrorBoundary.tsx'))!.text;
    expect(boundary).toMatch(/!event\.query\.meta\?\.toastOnError/);
  });
});
