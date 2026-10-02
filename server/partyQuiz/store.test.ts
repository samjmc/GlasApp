import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StoredPage } from './extract';
import { REPO_ROOT, TextStore, sha256Of } from './store';

const pages = (text: string): StoredPage[] => [{ ordinal: 1, label: '1', heading: null, text }];
const bytesA = new TextEncoder().encode('%PDF invented document A');
const bytesB = new TextEncoder().encode('%PDF invented document B');

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'party-quiz-store-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('TextStore', () => {
  it('round-trips the original and its pages under the sha256', () => {
    const store = new TextStore(dir);
    const saved = store.save({ slug: 'x-ge2024', format: 'pdf', bytes: bytesA, extractor: 'unpdf@1.7.0', pages: pages('one two three') });
    const sha = sha256Of(bytesA);
    expect(saved.status).toBe('stored');
    expect(saved.document).toEqual({ sha256: sha, slug: 'x-ge2024', extractor: 'unpdf@1.7.0', pageCount: 1, wordCount: 3, pages: pages('one two three') });
    expect(store.read(sha)).toEqual(saved.document);
    expect(store.find('x-ge2024')).toEqual(saved.document);
    expect(new Uint8Array(fs.readFileSync(path.join(dir, `${sha}.pdf`)))).toEqual(bytesA);
    expect(store.read('0'.repeat(64))).toBeNull();
    expect(store.find('y-ge2024')).toBeNull();
  });

  it('treats the same sha as a no-op', () => {
    const store = new TextStore(dir);
    store.save({ slug: 'x-ge2024', format: 'pdf', bytes: bytesA, extractor: 'e', pages: pages('first extraction') });
    const again = store.save({ slug: 'x-ge2024', format: 'pdf', bytes: bytesA, extractor: 'e', pages: pages('second extraction') });
    expect(again.status).toBe('unchanged');
    expect(store.read(sha256Of(bytesA))!.pages[0]!.text).toBe('first extraction');
    expect(() => store.save({ slug: 'y-ge2024', format: 'pdf', bytes: bytesA, extractor: 'e', pages: pages('x') })).toThrow(/already stored for x-ge2024/);
  });

  it('refuses a new sha for the same slug unless replace is given, then drops the old files', () => {
    const store = new TextStore(dir);
    store.save({ slug: 'x-ge2024', format: 'pdf', bytes: bytesA, extractor: 'e', pages: pages('a') });
    expect(() => store.save({ slug: 'x-ge2024', format: 'pdf', bytes: bytesB, extractor: 'e', pages: pages('b') })).toThrow(/--replace/);
    expect(store.find('x-ge2024')!.sha256).toBe(sha256Of(bytesA));

    const replaced = store.save({ slug: 'x-ge2024', format: 'pdf', bytes: bytesB, extractor: 'e', pages: pages('b') }, { replace: true });
    expect(replaced.status).toBe('replaced');
    expect(store.find('x-ge2024')!.sha256).toBe(sha256Of(bytesB));
    expect(store.read(sha256Of(bytesA))).toBeNull();
    expect(fs.readdirSync(dir).sort()).toEqual([`${sha256Of(bytesB)}.pages.json`, `${sha256Of(bytesB)}.pdf`]);
  });

  it('refuses any directory inside the repo: manifesto text must never be committed', () => {
    for (const inside of [REPO_ROOT, path.join(REPO_ROOT, 'party-quiz'), path.join(REPO_ROOT, 'server', 'partyQuiz', 'store'), path.join(REPO_ROOT, 'a', '..', 'b'), path.join(REPO_ROOT, '..store')]) {
      expect(() => new TextStore(inside), inside).toThrow(/inside the repo/);
    }
    expect(fs.existsSync(path.join(REPO_ROOT, 'party-quiz'))).toBe(false);
    expect(() => new TextStore(dir)).not.toThrow();
    expect(() => new TextStore(path.join(REPO_ROOT, '..', 'outside-the-repo'))).not.toThrow();
  });
});
