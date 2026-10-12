/**
 * Every API call goes through lib/api.ts, which attaches the token and the region header. A raw
 * fetch() skips both, and the region used to be added by patching window.fetch from an effect,
 * after the first requests had already gone out. Read as text: the client has no component test
 * setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');

/** Static files, not the API. */
const ALLOWED = new Set(['lib/api.ts', 'helpers/fetchConstituencyGeoJSON.ts']);

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('one API path', () => {
  const sources = files(SRC).map((file) => ({
    file: path.relative(SRC, file).split(path.sep).join('/'),
    text: fs.readFileSync(file, 'utf8'),
  }));

  it('finds lib/api.ts calling fetch (a scan that matched nothing would pass vacuously)', () => {
    const api = sources.find(({ file }) => file === 'lib/api.ts');
    expect(api?.text).toMatch(/(?<![\w.])fetch\(/);
  });

  it('no other file calls fetch() directly', () => {
    const offenders = sources.filter(({ file, text }) => !ALLOWED.has(file) && /(?<![\w.])fetch\(/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nothing patches window.fetch', () => {
    expect(sources.filter(({ text }) => /window\.fetch\s*=/.test(text)).map(({ file }) => file)).toEqual([]);
  });
});
