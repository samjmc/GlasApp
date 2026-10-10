/**
 * The robot run's report: route latency and statuses, the database pool's queue, the checks on
 * what each kind of robot left in the database, and every finding. Pure.
 */
import type { Recorder, RobotKind } from './robot';

export const KINDS: RobotKind[] = ['finisher', 'refuser', 'withdrawer', 'anonymous'];

/** What one kind of robot left behind, counted in the database. */
export interface KindCounts {
  robots: number;
  quizResults: number;
  quizPlans: number;
  votes: number;
  sessions: number;
  completedSessions: number;
  priorities: number;
  userProfiles: number;
  users: number;
  consented: number;
}

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

/** Pass/fail rules from docs/plans/robot-run.md. Counts are totals over the kind's robots. */
export function checks(c: Record<RobotKind, KindCounts>, fiveHundreds: number): Check[] {
  const none = (k: KindCounts, keys: Array<keyof KindCounts>) => keys.filter((key) => k[key] !== 0);
  const opinions: Array<keyof KindCounts> = ['quizResults', 'votes', 'priorities', 'userProfiles'];
  const f = c.finisher;
  const r = c.refuser;
  const w = c.withdrawer;
  const a = c.anonymous;
  return [
    { name: 'Refusers stored no opinion and no daily session', pass: none(r, [...opinions, 'sessions']).length === 0, detail: describe(r, [...opinions, 'sessions']) },
    {
      name: 'Withdrawers have no political data left, and still have an account without consent',
      pass: none(w, [...opinions, 'sessions', 'consented']).length === 0 && w.users === w.robots,
      detail: `${describe(w, [...opinions, 'sessions', 'consented'])}; accounts ${w.users} of ${w.robots}`,
    },
    {
      name: 'Every finisher has a planned quiz, 3 daily votes, a completed session and a profile',
      pass: f.quizResults === f.robots && f.quizPlans === f.robots && f.completedSessions === f.robots && f.userProfiles === f.robots && f.votes >= 3 * f.robots,
      detail: `${describe(f, ['quizResults', 'quizPlans', 'votes', 'completedSessions', 'userProfiles'])} for ${f.robots} robots`,
    },
    { name: 'Anonymous robots stored nothing', pass: none(a, [...opinions, 'sessions', 'users']).length === 0, detail: describe(a, [...opinions, 'sessions', 'users']) },
    { name: 'No 5xx response', pass: fiveHundreds === 0, detail: `${fiveHundreds} responses with status 500 or over` },
  ];
}

const describe = (k: KindCounts, keys: Array<keyof KindCounts>) => keys.map((key) => `${key} ${k[key]}`).join(', ');

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

export interface ReportInput {
  started: Date;
  finished: Date;
  config: { robots: number; concurrency: number; seed: number };
  seeded: Record<string, number>;
  recorder: Recorder;
  counts: Record<RobotKind, KindCounts>;
  poolWaiting: number[];
  probe: { robots: number; votes: number; rateLimited: number };
  /** The server's database pool size (server/db.ts DB_POOL_MAX). */
  poolMax: number;
  analysisFile: string;
}

export function renderRobotReport(input: ReportInput): string {
  const fiveHundreds = [...input.recorder.routes.values()].reduce(
    (sum, s) => sum + Object.entries(s.statuses).reduce((n, [status, count]) => n + (Number(status) >= 500 ? count : 0), 0),
    0,
  );
  const results = checks(input.counts, fiveHundreds);
  const seconds = (input.finished.getTime() - input.started.getTime()) / 1000;
  const waiting = input.poolWaiting;
  const lines = [
    `# Robot run ${input.started.toISOString()}`,
    '',
    `${input.config.robots} robots, ${input.config.concurrency} at a time, seed ${input.config.seed}; ${seconds.toFixed(0)} s.`,
    `Copied from GlasCore: ${Object.entries(input.seeded).map(([t, n]) => `${t} ${n}`).join(', ')}.`,
    '',
    '## Checks',
    '',
    ...results.map((c) => `- ${c.pass ? 'PASS' : 'FAIL'}: ${c.name}. ${c.detail}.`),
    '',
    '## Findings',
    '',
    `- Rate-limit probe: ${input.probe.robots} robots behind ONE address got ${input.probe.votes} votes saved and ${input.probe.rateLimited} refused with 429 (60 votes per user and 600 per address, per 15 minutes).`,
    ...(input.recorder.findings.length
      ? summariseFindings(input.recorder.findings)
      : ['- Every response was one the journey expected.']),
    '',
    '## Routes',
    '',
    '| Route | Calls | p50 ms | p95 ms | max ms | Statuses |',
    '|---|---|---|---|---|---|',
    ...[...input.recorder.routes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([route, s]) => {
        const ms = [...s.ms].sort((x, y) => x - y);
        const statuses = Object.entries(s.statuses).map(([status, n]) => `${status}×${n}`).join(' ');
        return `| ${route} | ${ms.length} | ${percentile(ms, 50).toFixed(0)} | ${percentile(ms, 95).toFixed(0)} | ${ms.at(-1)!.toFixed(0)} | ${statuses} |`;
      }),
    '',
    `Database pool (${input.poolMax} connections): requests waiting, sampled every 250 ms: max ${waiting.length ? Math.max(...waiting) : 0}, mean ${waiting.length ? (waiting.reduce((s, x) => s + x, 0) / waiting.length).toFixed(1) : '0'}.`,
    '',
    'Latency is one laptop and a local Postgres. In production each signed-in request also calls Supabase two or three times, which is not in these numbers.',
    '',
    '## Database, by kind of robot',
    '',
    '| Kind | Robots | Quiz results | With plan | Votes | Sessions | Completed | Pledge rankings | Profiles | Accounts | Consented |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...KINDS.map((k) => {
      const c = input.counts[k];
      return `| ${k} | ${c.robots} | ${c.quizResults} | ${c.quizPlans} | ${c.votes} | ${c.sessions} | ${c.completedSessions} | ${c.priorities} | ${c.userProfiles} | ${c.users} | ${c.consented} |`;
    }),
    '',
    `## Quiz item analysis`,
    '',
    `On the robots' stored quizzes: ${input.analysisFile}. Robots answer from a model, so this proves the analysis runs on real stored rows; it says nothing about the questions.`,
    '',
  ];
  return lines.join('\n');
}

/** The first few findings in full, then a count per kind of finding. */
function summariseFindings(findings: string[]): string[] {
  const byKind = new Map<string, number>();
  for (const f of findings) {
    const key = f.replace(/robot-\d+/, 'robot-N');
    byKind.set(key, (byKind.get(key) ?? 0) + 1);
  }
  return [...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([text, n]) => `- ${n}× ${text}`);
}
