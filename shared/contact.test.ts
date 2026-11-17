/**
 * The old .ie domain has no DNS, so every address on it was a dead end. Addresses
 * live in shared/contact.ts; this scans the source so the old domain cannot come back.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, PRIVACY_EMAIL, SUPPORT_EMAIL } from './contact';

const ROOT = path.resolve(__dirname, '..');
const DEAD_DOMAIN = ['glaspolitics', 'ie'].join('.');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css|html|json|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('contact addresses', () => {
  const files = ['client', 'server', 'shared'].flatMap((d) => walk(path.join(ROOT, d)));

  it('scanned a real number of files (a scan that read nothing would pass vacuously)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no source file mentions the dead domain', () => {
    const hits = files.filter((f) => fs.readFileSync(f, 'utf8').includes(DEAD_DOMAIN)).map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('publishes the three live addresses', () => {
    expect([CONTACT_EMAIL, SUPPORT_EMAIL, PRIVACY_EMAIL]).toEqual([
      'hello@glasinsight.com',
      'support@glasinsight.com',
      'privacy@glasinsight.com',
    ]);
  });
});