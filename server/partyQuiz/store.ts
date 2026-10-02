/**
 * The local text store: each downloaded manifesto and its extracted pages, OUTSIDE the repo.
 *
 * The repo is public and a manifesto is someone else's text, so the full text lives only here,
 * keyed by the sha256 of the downloaded file: `<sha>.<pdf|html>` (the original) and
 * `<sha>.pages.json`. A directory inside the repo is refused. No database, no migration.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StoredPage } from './extract';
import { wordCount } from './normalise';
import type { ManifestoDocument } from './registry';

export const DEFAULT_STORE_DIR = path.join(os.homedir(), '.glas', 'party-quiz');
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `<sha>.pages.json` */
export interface PagesFile {
  slug: string;
  extractor: string;
  pageCount: number;
  wordCount: number;
  pages: StoredPage[];
}

export interface StoredDocument extends PagesFile {
  sha256: string;
}

export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const PAGES = '.pages.json';

export class TextStore {
  readonly dir: string;

  constructor(dir: string = DEFAULT_STORE_DIR, repoRoot: string = REPO_ROOT) {
    this.dir = path.resolve(dir);
    const rel = path.relative(path.resolve(repoRoot), this.dir);
    const outside = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
    if (!outside) {
      throw new Error(`The text store ${this.dir} is inside the repo; manifesto text must never be committed. Use a directory outside it.`);
    }
  }

  read(sha256: string): StoredDocument | null {
    const file = path.join(this.dir, sha256 + PAGES);
    if (!fs.existsSync(file)) return null;
    return { sha256, ...(JSON.parse(fs.readFileSync(file, 'utf8')) as PagesFile) };
  }

  /** The stored document for a slug; a slug has at most one (a new download needs `replace`). */
  find(slug: string): StoredDocument | null {
    if (!fs.existsSync(this.dir)) return null;
    for (const name of fs.readdirSync(this.dir)) {
      if (!name.endsWith(PAGES)) continue;
      const doc = this.read(name.slice(0, -PAGES.length));
      if (doc?.slug === slug) return doc;
    }
    return null;
  }

  /**
   * The document a new file for `slug` would replace, or null. Throws when the file is stored
   * for another slug, or replaces one without `replace`; the job calls it before extracting.
   */
  replaced(slug: string, sha256: string, replace = false): StoredDocument | null {
    const same = this.read(sha256);
    if (same && same.slug !== slug) throw new Error(`This file is already stored for ${same.slug}, not ${slug}.`);
    const previous = this.find(slug);
    if (!previous || previous.sha256 === sha256) return null;
    if (!replace) throw new Error(`${slug} is already stored as ${previous.sha256}; this file is ${sha256}. Pass --replace to re-ingest it.`);
    return previous;
  }

  save(
    input: { slug: string; format: ManifestoDocument['format']; bytes: Uint8Array; extractor: string; pages: StoredPage[] },
    options: { replace?: boolean } = {},
  ): { status: 'stored' | 'unchanged' | 'replaced'; document: StoredDocument } {
    const sha256 = sha256Of(input.bytes);
    const previous = this.replaced(input.slug, sha256, options.replace);
    const existing = this.read(sha256);
    if (existing) return { status: 'unchanged', document: existing };

    const file: PagesFile = {
      slug: input.slug,
      extractor: input.extractor,
      pageCount: input.pages.length,
      wordCount: input.pages.reduce((n, p) => n + wordCount(p.text), 0),
      pages: input.pages,
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, `${sha256}.${input.format}`), input.bytes);
    fs.writeFileSync(path.join(this.dir, sha256 + PAGES), JSON.stringify(file));
    if (previous) {
      for (const name of fs.readdirSync(this.dir)) if (name.startsWith(`${previous.sha256}.`)) fs.rmSync(path.join(this.dir, name));
    }
    return { status: previous ? 'replaced' : 'stored', document: { sha256, ...file } };
  }
}
