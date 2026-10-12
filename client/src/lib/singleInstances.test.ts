/**
 * Duplicates that showed or cost twice: two offline banners at once (two copies of the same hook),
 * and two toast import paths plus a toast context nobody read. Read as text: the client has no
 * component test setup.
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

const sources = files(SRC).map((file) => ({ file: path.relative(SRC, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }));

describe('toasts', () => {
  it('every caller imports the one store (and there are callers)', () => {
    const callers = sources.filter(({ text }) => /from ["'][^"']*use-toast["']/.test(text));
    expect(callers.length).toBeGreaterThan(10);
    expect(callers.filter(({ text }) => !/from ["']@\/hooks\/use-toast["']/.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it('has no unused context provider', () => {
    expect(sources.filter(({ text }) => /ToastContextProvider|useToastContext/.test(text)).map(({ file }) => file)).toEqual([]);
  });
});

describe('offline banner', () => {
  it('there is one, and it is announced', () => {
    expect(sources.some(({ file }) => file === 'components/OfflineAlert.tsx')).toBe(false);
    const indicator = sources.find(({ file }) => file === 'components/OfflineIndicator.tsx')!.text;
    expect(indicator).toMatch(/role="status"/);
    expect(indicator).toMatch(/clearTimeout\(timer\)/);
  });
});
