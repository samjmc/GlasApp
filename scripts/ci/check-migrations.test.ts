import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findings, type Deps } from './check-migrations';

// The fixture is the real drizzle/ folder, used as both base and head. Each case changes
// one thing in memory. Files are stored with LF endings, as git stores them.
const ROOT = path.resolve(__dirname, '..', '..');
const JOURNAL = 'drizzle/meta/_journal.json';

interface Entry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}
interface Journal {
  version: string;
  dialect: string;
  entries: Entry[];
}

function readTree(): Map<string, string> {
  const files = new Map<string, string>();
  for (const dir of ['drizzle', 'drizzle/meta']) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (!fs.statSync(path.join(ROOT, rel)).isFile()) continue;
      files.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'));
    }
  }
  return files;
}

const pad = (idx: number) => String(idx).padStart(4, '0');
const journalOf = (files: Map<string, string>): Journal => JSON.parse(files.get(JOURNAL)!);
const setJournal = (files: Map<string, string>, journal: Journal) => files.set(JOURNAL, JSON.stringify(journal, null, 2));

function fixture() {
  const base = readTree();
  const head = new Map(base);
  const entries = journalOf(base).entries;
  const maxWhen = Math.max(...entries.map((e) => e.when));
  return { base, head, entries, n: entries.length, maxWhen };
}

/** Append a complete migration (journal entry, SQL, snapshot) to `head`. */
function addMigration(head: Map<string, string>, idx: number, tag: string, when: number) {
  const journal = journalOf(head);
  journal.entries.push({ idx, version: '7', when, tag, breakpoints: true });
  setJournal(head, journal);
  head.set(`drizzle/${tag}.sql`, 'CREATE TABLE "politics"."x" ("id" serial PRIMARY KEY);\n');
  head.set(`drizzle/meta/${pad(idx)}_snapshot.json`, '{}\n');
}

function run(head: Map<string, string>, base: Map<string, string>, readBase?: Deps['readBase']) {
  return findings({
    readHead: (rel) => head.get(rel),
    listHead: (dir) => [...head.keys()].filter((k) => path.posix.dirname(k) === dir).map((k) => path.posix.basename(k)),
    readBase: readBase ?? ((rel) => base.get(rel)),
  });
}
const codes = (r: ReturnType<typeof run>) => r.errors.map((e) => e.code);

describe('findings', () => {
  it('1: the real drizzle/ against itself has no errors, and every entry was checked', () => {
    const { base, head, n } = fixture();
    const r = run(head, base);
    expect(r.errors).toEqual([]);
    expect(n).toBeGreaterThanOrEqual(10);
    expect(r.checked).toEqual({ base: n, added: 0 });
  });

  it('2: accepts a valid new migration', () => {
    const { base, head, n, maxWhen } = fixture();
    addMigration(head, n, `${pad(n)}_new`, maxWhen + 1);
    const r = run(head, base);
    expect(r.errors).toEqual([]);
    expect(r.checked.added).toBe(1);
  });

  it('3: rejects a new `when` equal to the base maximum', () => {
    const { base, head, n, maxWhen } = fixture();
    addMigration(head, n, `${pad(n)}_new`, maxWhen);
    expect(codes(run(head, base))).toContain('when-not-increasing');
  });

  it('4: rejects a new `when` above 0007 but below the base maximum', () => {
    const { base, head, n, entries, maxWhen } = fixture();
    const when = 1790281000000;
    expect(when).toBeGreaterThan(entries.find((e) => e.tag === '0007_quiz_ideology')!.when);
    expect(when).toBeLessThan(maxWhen);
    addMigration(head, n, `${pad(n)}_new`, when);
    expect(codes(run(head, base))).toContain('when-not-increasing');
  });

  it('5: rejects two new migrations whose `when` goes down', () => {
    const { base, head, n, maxWhen } = fixture();
    addMigration(head, n, `${pad(n)}_first`, maxWhen + 10);
    addMigration(head, n + 1, `${pad(n + 1)}_second`, maxWhen + 5);
    const r = run(head, base);
    expect(r.errors.filter((e) => e.code === 'when-not-increasing').map((e) => e.file)).toEqual([
      `drizzle/${pad(n + 1)}_second.sql`,
    ]);
  });

  it('6: rejects a changed `when` on a base entry', () => {
    const { base, head } = fixture();
    const journal = journalOf(head);
    journal.entries.find((e) => e.tag === '0007_quiz_ideology')!.when = 1790361770440;
    setJournal(head, journal);
    expect(codes(run(head, base))).toContain('base-entry-changed');
  });

  it('7: rejects a renamed base tag', () => {
    const { base, head } = fixture();
    const journal = journalOf(head);
    journal.entries.find((e) => e.tag === '0007_quiz_ideology')!.tag = '0007_quiz';
    setJournal(head, journal);
    const c = codes(run(head, base));
    expect(c).toContain('base-entry-changed');
    expect(c).toContain('missing-sql');
  });

  it('8: rejects an edit to a base migration', () => {
    const { base, head } = fixture();
    head.set('drizzle/0000_politics_scoring.sql', `${head.get('drizzle/0000_politics_scoring.sql')}-- edited\n`);
    expect(codes(run(head, base))).toContain('base-sql-changed');
  });

  it('9: ignores CRLF line endings in the working tree', () => {
    const { base, head } = fixture();
    const sql = head.get('drizzle/0000_politics_scoring.sql')!;
    expect(sql).toContain('\n');
    head.set('drizzle/0000_politics_scoring.sql', sql.replace(/\n/g, '\r\n'));
    expect(run(head, base).errors).toEqual([]);
  });

  it('10: rejects a base entry removed from the journal', () => {
    const { base, head } = fixture();
    const journal = journalOf(head);
    journal.entries.pop();
    setJournal(head, journal);
    expect(codes(run(head, base))).toContain('base-entry-missing');
  });

  it('11: rejects an idx gap', () => {
    const { base, head, n, maxWhen } = fixture();
    addMigration(head, n + 1, `${pad(n + 1)}_new`, maxWhen + 1);
    expect(codes(run(head, base))).toContain('idx-sequence');
  });

  it('12: rejects a tag whose number is not its idx', () => {
    const { base, head, n, maxWhen } = fixture();
    addMigration(head, n, `${pad(n + 1)}_x`, maxWhen + 1);
    expect(codes(run(head, base))).toContain('tag-idx-mismatch');
  });

  it('13: rejects a journal entry with no SQL file', () => {
    const { base, head } = fixture();
    head.delete('drizzle/0003_news_ingestion.sql');
    expect(codes(run(head, base))).toContain('missing-sql');
  });

  it('14: rejects an SQL file that no journal entry names', () => {
    const { base, head } = fixture();
    head.set('drizzle/0099_orphan.sql', 'SELECT 1;\n');
    expect(codes(run(head, base))).toContain('orphan-file');
  });

  it('14b: rejects a snapshot that no journal entry names', () => {
    const { base, head } = fixture();
    head.set('drizzle/meta/0099_snapshot.json', '{}\n');
    expect(codes(run(head, base))).toContain('orphan-file');
  });

  it('15: rejects a journal entry with no snapshot', () => {
    const { base, head, entries } = fixture();
    head.delete(`drizzle/meta/${pad(entries[entries.length - 1].idx)}_snapshot.json`);
    expect(codes(run(head, base))).toContain('missing-snapshot');
  });

  it('16: fails closed when the base journal cannot be read', () => {
    const { base, head } = fixture();
    expect(codes(run(head, base, () => undefined))).toEqual(['base-unreadable']);
  });

  it('17: fails closed when the base journal has no entries', () => {
    const { base, head } = fixture();
    setJournal(base, { ...journalOf(base), entries: [] });
    expect(codes(run(head, base))).toEqual(['base-empty']);
  });

  it('18: fails closed when the head journal cannot be read', () => {
    const { base, head } = fixture();
    head.set(JOURNAL, 'not json');
    expect(codes(run(head, base))).toEqual(['head-unreadable']);
  });

  it('19: fails closed when a merged migration cannot be read on the base commit', () => {
    const { base, head } = fixture();
    base.delete('drizzle/0003_news_ingestion.sql');
    expect(codes(run(head, base))).toEqual(['base-unreadable']);
  });
});
