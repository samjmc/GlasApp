import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { approveWrite, targetOf, writePlan } from './liveDbGuard';

/** Files in server/jobs that are not a job of their own. */
const HELPERS = ['itemsJob.ts', 'liveDbGuard.ts'];
/** Job entries that do not call the guard, and why. Every other entry must. */
const EXEMPT: Record<string, string> = {
  'party-quiz.ts': 'writes only local files (sheets, the text store); `report` only reads the database. Its own --yes approves model spend',
  'parliament-silences.ts': 'only reads the database',
  'quiz-analyse.ts': 'only reads the database; writes a local report file',
  'robots.ts': 'writes only to a local _robots database: robots/guards.ts refuses any other, which is stricter than this guard',
  'td-scoring.ts': 'an alias: it imports scores-recalculate.ts or news-tds.ts, which call the guard',
};
const JOBS = path.resolve(__dirname);

const REMOTE = 'postgres://postgres.abcd:s3cret-pw@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

describe('live database guard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('knows the hosts on this machine, and nothing else', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal', 'LOCALHOST']) {
      expect(targetOf(`postgres://u:p@${host}:5432/glas`), host).toEqual({ host: host.toLowerCase(), database: 'glas', local: true });
    }
    expect(targetOf(REMOTE)).toEqual({ host: 'aws-1-eu-west-1.pooler.supabase.com', database: 'postgres', local: false });
    // Look-alikes are remote.
    for (const host of ['localhost.example.com', '127.0.0.2', 'mylocalhost']) expect(targetOf(`postgres://u:p@${host}/x`).local, host).toBe(false);
  });

  it('follows ?host=, which node-postgres connects to instead of the authority', () => {
    expect(targetOf('postgres://u:p@localhost:5432/x?host=db.example.com')).toMatchObject({ host: 'db.example.com', local: false });
  });

  it('treats a missing, empty or unparseable URL as remote', () => {
    for (const url of [undefined, '', 'not a url', 'postgres://u:p@:5432/x']) expect(targetOf(url).local, String(url)).toBe(false);
  });

  it('lets a local write, a dry run and an approved remote write go on', () => {
    expect(writePlan('job', false, [], 'postgres://postgres:postgres@localhost:55441/postgres').approved).toBe(true);
    expect(writePlan('job', true, [], REMOTE).approved).toBe(true);
    expect(writePlan('job', false, ['--yes'], REMOTE).approved).toBe(true);
  });

  it('stops a remote write without --yes, and says how to approve it', () => {
    const plan = writePlan('scores:recalculate', false, ['--dry-run'], REMOTE);
    expect(plan.approved).toBe(false); // --dry-run counts only when the job says it ran dry
    expect(plan.lines).toEqual([
      '[scores:recalculate] target: aws-1-eu-west-1.pooler.supabase.com/postgres (remote), writes',
      '[scores:recalculate] nothing was changed. Re-run with --yes to write to aws-1-eu-west-1.pooler.supabase.com/postgres.',
    ]);
    expect(writePlan('job', false, [], 'garbage').approved).toBe(false);
  });

  it('never prints the password or user, even from a mangled URL', () => {
    const urls = [REMOTE, 'postgres://u:s3cret-pw@localhost/x', 'postgres://u:1/s3cret-pw@db.example.com/x', 'postgres://u:s3cret-pw@db.example.com/x?host=/tmp/s3cret-pw'];
    for (const url of urls) {
      const out = [...writePlan('job', false, [], url).lines, ...writePlan('job', true, ['--yes'], url).lines].join('\n');
      expect(out, url).not.toContain('s3cret-pw');
      expect(out, url).not.toContain('abcd');
    }
  });

  it('approveWrite prints the target, and exits 2 before a write it was not given --yes for', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    approveWrite('job', false, [], REMOTE);
    expect(exit).toHaveBeenCalledWith(2);
    expect(log.mock.calls.map((c) => c[0]).join('\n')).toContain('target: aws-1-eu-west-1.pooler.supabase.com/postgres (remote)');

    exit.mockClear();
    log.mockClear();
    approveWrite('job', false, ['--yes'], REMOTE);
    expect(exit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('every job entry asks for approval', () => {
  const entries = fs.readdirSync(JOBS).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !HELPERS.includes(f));
  const callsGuard = (f: string) => /\bapproveWrite\(/.test(fs.readFileSync(path.join(JOBS, f), 'utf8'));

  it('finds the entries, and every npm script that runs a job is one of them', () => {
    expect(entries.length).toBeGreaterThanOrEqual(15);
    const scripts = Object.values(JSON.parse(fs.readFileSync(path.join(JOBS, '../../package.json'), 'utf8')).scripts as Record<string, string>);
    const run = scripts.flatMap((s) => [...s.matchAll(/server\/jobs\/([\w-]+\.ts)/g)].map((m) => m[1]));
    expect(run.length).toBeGreaterThanOrEqual(15);
    for (const file of run) expect(entries, file).toContain(file);
  });

  it('calls the guard in every entry that is not exempt, and in none that is', () => {
    for (const file of Object.keys(EXEMPT)) expect(entries, `${file} is exempt but is not an entry`).toContain(file);
    const unguarded = entries.filter((f) => !(f in EXEMPT) && !callsGuard(f));
    expect(unguarded, 'a job entry that writes must call approveWrite, or be listed in EXEMPT with the reason').toEqual([]);
    expect(Object.keys(EXEMPT).filter(callsGuard)).toEqual([]);
    expect(entries.filter(callsGuard).length).toBe(entries.length - Object.keys(EXEMPT).length);
  });
});
