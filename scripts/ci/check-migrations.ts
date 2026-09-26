/**
 * Migration guard. CI compares drizzle/ on HEAD with drizzle/ on the base commit.
 *
 * drizzle-orm runs a migration only if its journal `when` is greater than the newest
 * `created_at` already applied, so a new migration with a lower `when` is skipped on
 * GlasCore with no error. This guard makes that red, and also any edit to a merged
 * migration. The snapshot chain is checked by `npx drizzle-kit check` (its own CI step).
 *
 *   npx tsx scripts/ci/check-migrations.ts --base <sha>
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const JOURNAL = 'drizzle/meta/_journal.json';

export type Code =
  | 'base-unreadable'
  | 'base-empty'
  | 'head-unreadable'
  | 'idx-sequence'
  | 'tag-idx-mismatch'
  | 'missing-sql'
  | 'missing-snapshot'
  | 'orphan-file'
  | 'base-entry-missing'
  | 'base-entry-changed'
  | 'base-sql-changed'
  | 'when-not-increasing';

export interface Finding {
  code: Code;
  file: string;
  message: string;
}

/** Paths are repo-relative with forward slashes. `listHead` returns file names only. */
export interface Deps {
  readHead(rel: string): string | undefined;
  listHead(dir: string): string[];
  readBase(rel: string): string | undefined;
}

interface Entry {
  idx: number;
  when: number;
  tag: string;
}

const pad = (idx: number) => String(idx).padStart(4, '0');
const sqlOf = (tag: string) => `drizzle/${tag}.sql`;
const snapshotOf = (idx: number) => `drizzle/meta/${pad(idx)}_snapshot.json`;
// core.autocrlf=true makes the working tree CRLF while git stores LF.
const lf = (text: string) => text.replace(/\r\n/g, '\n');

function parseJournal(text: string | undefined): Entry[] | undefined {
  if (text === undefined) return undefined;
  try {
    const entries: unknown = JSON.parse(text).entries;
    if (!Array.isArray(entries)) return undefined;
    const valid = entries.every(
      (e) => Number.isInteger(e?.idx) && Number.isFinite(e?.when) && typeof e?.tag === 'string',
    );
    return valid ? entries.map((e: Entry) => ({ idx: e.idx, when: e.when, tag: e.tag })) : undefined;
  } catch {
    return undefined;
  }
}

export function findings(deps: Deps): { errors: Finding[]; checked: { base: number; added: number } } {
  const errors: Finding[] = [];
  const fail = (code: Code, file: string, message: string) => errors.push({ code, file, message });

  // 1. Fail closed: with no base journal there is nothing to compare against.
  const base = parseJournal(deps.readBase(JOURNAL));
  if (!base) fail('base-unreadable', JOURNAL, 'Cannot read the migration journal on the base commit.');
  else if (base.length === 0) fail('base-empty', JOURNAL, 'The migration journal on the base commit has no entries.');
  const head = parseJournal(deps.readHead(JOURNAL));
  if (base?.length && !head) fail('head-unreadable', JOURNAL, 'Cannot read the migration journal.');
  if (!base?.length || !head) return { errors, checked: { base: 0, added: 0 } };

  // 2. idx runs 0..n-1 in order, and each tag starts with its own idx.
  head.forEach((e, i) => {
    if (e.idx !== i) fail('idx-sequence', JOURNAL, `Journal entry ${i} (${e.tag}) has idx ${e.idx}; idx must run 0..n-1 with no gap.`);
    if (!e.tag.startsWith(`${pad(e.idx)}_`)) fail('tag-idx-mismatch', JOURNAL, `Tag ${e.tag} does not start with ${pad(e.idx)}_, its idx.`);
  });

  // 3. Every entry has its files, and every migration file has an entry.
  for (const e of head) {
    if (deps.readHead(sqlOf(e.tag)) === undefined) fail('missing-sql', sqlOf(e.tag), `Journal entry ${e.tag} has no SQL file.`);
    if (deps.readHead(snapshotOf(e.idx)) === undefined) fail('missing-snapshot', snapshotOf(e.idx), `Journal entry ${e.tag} has no snapshot.`);
  }
  const sqlFiles = new Set(head.map((e) => sqlOf(e.tag)));
  const snapshots = new Set(head.map((e) => snapshotOf(e.idx)));
  for (const name of deps.listHead('drizzle')) {
    const rel = `drizzle/${name}`;
    if (name.endsWith('.sql') && !sqlFiles.has(rel)) fail('orphan-file', rel, `${rel} is not in the journal.`);
  }
  for (const name of deps.listHead('drizzle/meta')) {
    const rel = `drizzle/meta/${name}`;
    if (name.endsWith('_snapshot.json') && !snapshots.has(rel)) fail('orphan-file', rel, `${rel} is not in the journal.`);
  }

  // 4. Merged migrations never change.
  for (const b of base) {
    const h = head.find((e) => e.idx === b.idx);
    if (!h) {
      fail('base-entry-missing', JOURNAL, `Merged migration ${b.tag} (idx ${b.idx}) is missing from the journal.`);
      continue;
    }
    if (h.tag !== b.tag || h.when !== b.when) {
      fail('base-entry-changed', JOURNAL, `Merged migration idx ${b.idx} changed: was ${b.tag} when ${b.when}, now ${h.tag} when ${h.when}.`);
      continue;
    }
    const baseSql = deps.readBase(sqlOf(b.tag));
    const headSql = deps.readHead(sqlOf(b.tag));
    if (baseSql === undefined) fail('base-unreadable', sqlOf(b.tag), `Cannot read ${sqlOf(b.tag)} on the base commit.`);
    else if (headSql !== undefined && lf(headSql) !== lf(baseSql)) fail('base-sql-changed', sqlOf(b.tag), `Merged migration ${b.tag} was edited.`);
  }

  // 5. Each new `when` is above every `when` before it, or drizzle skips the migration.
  const baseIdx = new Set(base.map((b) => b.idx));
  const added = head.filter((e) => !baseIdx.has(e.idx));
  let max = Math.max(...base.map((b) => b.when));
  for (const e of added) {
    if (!(e.when > max)) {
      fail('when-not-increasing', sqlOf(e.tag), `${e.tag} has when ${e.when}, not above ${max}, the highest when before it. drizzle would skip it on GlasCore with no error.`);
    }
    max = Math.max(max, e.when);
  }

  return { errors, checked: { base: base.length, added: added.length } };
}

const RECIPE = [
  'How to fix: delete this PR\'s migration .sql, its snapshot and its journal entry.',
  'Merge current main. Run `npm run db:generate -- --name <name>`. Re-apply any hand edits. Commit.',
  'Never renumber by hand. Never edit a merged migration.',
].join('\n');

function main(argv: string[]): number {
  const at = argv.indexOf('--base');
  const sha = at >= 0 ? argv[at + 1] : undefined;
  if (!sha) {
    console.error('usage: tsx scripts/ci/check-migrations.ts --base <sha>');
    return 2;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { errors, checked } = findings({
    readHead: (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : undefined),
    listHead: (dir) => fs.readdirSync(path.join(root, dir)),
    readBase: (rel) => {
      try {
        return execFileSync('git', ['show', `${sha}:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        return undefined;
      }
    },
  });
  console.log(`base ${sha}`);
  console.log(`checked ${checked.base} base + ${checked.added} new entries`);
  for (const e of errors) console.log(`::error file=${e.file}::${e.message}`);
  if (errors.length) console.log(RECIPE);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
