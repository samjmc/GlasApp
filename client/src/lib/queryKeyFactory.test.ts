/**
 * The query-key factory had ten entries nobody used while pages wrote their keys inline, so the
 * same cache entry could be spelled two ways and an invalidation could miss it. Every factory entry
 * must be used, and no call site may write a key inline. Read as text: the client has no component
 * test setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { keysStaleAfterVote, queryKeys } from './queryKeys';

const SRC = path.resolve(__dirname, '..');

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** "td.profile", "dailySession", ... for every function in the factory. */
function entries(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'function' ? [`${prefix}${key}`] : entries(value as object, `${prefix}${key}.`),
  );
}

const sources = files(SRC).map((file) => ({ file: path.relative(SRC, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }));

describe('query keys', () => {
  const all = entries(queryKeys);

  it('reads the factory (a scan of nothing would pass vacuously)', () => {
    expect(all.length).toBeGreaterThan(30);
  });

  it('every factory entry is used somewhere', () => {
    const queryKeysFile = sources.find(({ file }) => file === 'lib/queryKeys.ts')!.text;
    const used = (entry: string) =>
      sources.some(({ file, text }) => file !== 'lib/queryKeys.ts' && text.includes(`queryKeys.${entry}(`)) ||
      // keysStaleAfterVote, in the factory file itself, is the only user of a few prefix keys.
      queryKeysFile.includes(`queryKeys.${entry}(`);
    expect(all.filter((entry) => !used(entry))).toEqual([]);
    expect(keysStaleAfterVote('article').length).toBe(2);
  });

  it('no call site writes a key inline', () => {
    const inline = sources
      .filter(({ text }) => /queryKey:\s*\[/.test(text))
      .map(({ file }) => file);
    expect(inline).toEqual([]);
  });
});

describe('dead code stays gone', () => {
  it('utils exports only cn', () => {
    const utils = sources.find(({ file }) => file === 'lib/utils.ts')!.text;
    expect([...utils.matchAll(/export function (\w+)/g)].map((m) => m[1])).toEqual(['cn']);
  });

  it('Login and Register share one set of sign-in options', () => {
    for (const page of ['pages/LoginPage.tsx', 'pages/RegisterPage.tsx']) {
      const text = sources.find(({ file }) => file === page)!.text;
      expect(text).toMatch(/<SignInOptions mode=/);
      expect(text).not.toMatch(/signInWithMagicLink|signInWithGoogle/);
    }
  });

  it('the admin page does not guard itself a second time', () => {
    expect(sources.find(({ file }) => file === 'pages/AdminPage.tsx')!.text).not.toMatch(/ProtectedRoute/);
  });
});
