/**
 * The first page load must not carry the map, the charts or the screenshot library. A static
 * import of a page in App.tsx, or of html2canvas anywhere, pulls it back into the main chunk
 * (one static import defeats every dynamic one). Read as text: the client has no component
 * test setup.
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

describe('route code splitting', () => {
  const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
  const staticPages = [...app.matchAll(/^import\s+\w+\s+from\s+["']@\/pages\/([^"']+)["']/gm)].map((m) => m[1]);
  const lazyPages = [...app.matchAll(/lazy\(\(\)\s*=>\s*import\(["']@\/pages\/([^"']+)["']\)\)/g)].map((m) => m[1]);

  it('finds the lazy pages (a scan that matched nothing would pass vacuously)', () => {
    expect(lazyPages.length).toBeGreaterThanOrEqual(20);
  });

  it('statically imports only the home page and the 404 page', () => {
    expect(staticPages.sort()).toEqual(['HomePage', 'not-found']);
  });
});

describe('html2canvas', () => {
  it('is never imported statically', () => {
    const offenders = files(SRC)
      .filter((file) => /^import\s[^;]*from\s+["']html2canvas["']/m.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('is still used, loaded on demand (the check above would pass vacuously otherwise)', () => {
    const dynamic = files(SRC).filter((file) => fs.readFileSync(file, 'utf8').includes("import('html2canvas')"));
    expect(dynamic.length).toBeGreaterThanOrEqual(2);
  });
});
