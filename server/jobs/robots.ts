/**
 * The robot run (docs/plans/robot-run.md): synthetic users through the real app, over HTTP, on a
 * local disposable database. It proves the app works for many users at once and finds slow
 * routes and rate-limit cliffs. It says nothing about quiz quality: robots answer from a model.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:55432/postgres"
 *   $env:ROBOTS_SOURCE_DATABASE_URL = <GlasCore, read-only use: public reference rows only>
 *   npm run robots -- [--robots 400] [--concurrency 20] [--seed 1]
 *
 * Writes reports/robots/<stamp>/report.md and analysis.md (reports/ is gitignored).
 *
 * Static imports here never reach server/db: it reads DATABASE_URL at import, and
 * server/services/aiService.ts loads `.env` at import. Both must come after the guards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { QUIZ_QUESTIONS } from '@shared/quiz';
import { itemOffsets, makeRespondents, mulberry32 } from '../quiz/testing/respondents';
import { assertNotNearMidnight, assertRobotDatabase, prepareEnvironment } from './robots/guards';
import { KINDS, renderRobotReport, type KindCounts } from './robots/report';
import { Recorder, runRobot, type Robot, type RobotKind, type World, type WorldQuestion } from './robots/robot';
import { readReference, writeReference } from './robots/seed';
import { installRobotSignIn } from './robots/signIn';

const USAGE = 'Usage: npm run robots -- [--robots 400] [--concurrency 20] [--seed 1]';
const FLAGS = { '--robots': 'robots', '--concurrency': 'concurrency', '--seed': 'seed' } as const;
export const PROBE_ROBOTS = 10;

export interface RobotArgs {
  robots: number;
  concurrency: number;
  seed: number;
}

/** Every flag takes a positive whole number; anything else is refused. */
export function parseRobotArgs(argv: string[]): RobotArgs {
  const args: RobotArgs = { robots: 400, concurrency: 20, seed: 1 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = FLAGS[argv[i] as keyof typeof FLAGS];
    const value = Number(argv[i + 1]);
    if (!key) throw new Error(`Unknown flag ${argv[i]}. ${USAGE}`);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${argv[i]} needs a positive whole number. ${USAGE}`);
    args[key] = value;
  }
  if (args.robots > 100_000) throw new Error(`--robots is at most 100000. ${USAGE}`);
  return args;
}

/** 5% anonymous, 10% refuse consent, 5% withdraw it at the end, the rest finish. */
export function kindOf(n: number): RobotKind {
  const slot = n % 20;
  return slot === 0 ? 'anonymous' : slot <= 2 ? 'refuser' : slot === 3 ? 'withdrawer' : 'finisher';
}

/** A distinct synthetic address per robot, 10.x.y.z. */
export const robotAddress = (n: number) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;

const COUNTIES = ['Dublin', 'Cork', 'Galway', 'Kerry', 'Limerick', 'Mayo', 'Donegal', 'Wexford', 'Louth', 'Kildare'];

async function countsFor(pool: { query: (sql: string, params: unknown[]) => Promise<{ rows: any[] }> }, ids: string[]): Promise<Omit<KindCounts, 'robots'>> {
  const { rows } = await pool.query(
    `select
       (select count(*) from politics.quiz_results where user_id = any($1))::int as "quizResults",
       (select count(*) from politics.quiz_results where user_id = any($1) and plan is not null)::int as "quizPlans",
       (select count(*) from politics.policy_votes where user_id = any($1))::int as votes,
       (select count(*) from politics.daily_sessions where user_id = any($1))::int as sessions,
       (select count(*) from politics.daily_sessions where user_id = any($1) and status = 'completed')::int as "completedSessions",
       (select count(distinct user_id) from politics.pledge_category_priorities where user_id = any($1))::int as priorities,
       (select count(*) from politics.ideology_profiles where subject_kind = 'user' and subject_id = any($1))::int as "userProfiles",
       (select count(*) from politics.users where id = any($1))::int as users,
       (select count(*) from politics.users where id = any($1) and political_consent_at is not null)::int as consented`,
    [ids],
  );
  return rows[0];
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}

async function main(): Promise<void> {
  const args = parseRobotArgs(process.argv.slice(2));
  const started = new Date();
  assertNotNearMidnight(started);
  const source = process.env.ROBOTS_SOURCE_DATABASE_URL;
  if (!source) throw new Error('ROBOTS_SOURCE_DATABASE_URL is not set: the database to copy TDs and questions from, read-only');
  const url = prepareEnvironment();
  if (source === url) throw new Error('refusing to run: the source and the robots database are the same');

  // Only now, with the environment fixed, may anything reach server/db.
  const { ensureDatabase, applyAllMigrations } = await import('../testing/migrations');
  await ensureDatabase(url);
  const { pool, shutdown } = await import('../db');
  const database: string | undefined = (await pool.query('select current_database() as name')).rows[0]?.name;
  assertRobotDatabase(database);
  await applyAllMigrations(pool);
  const data = await readReference(source);
  const seeded = await writeReference(pool, data, new Date());
  await (await import('../ideology')).recalculateAll();

  const questions = new Map<number, WorldQuestion>();
  for (const q of data.policy_questions as Array<{ id: number; article_id: number }>) questions.set(q.id, { id: q.id, articleId: q.article_id, options: {} });
  for (const o of data.policy_question_options as Array<Record<string, any>>) {
    const q = questions.get(o.question_id);
    if (q) q.options[o.option_key] = Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, Number(o[d] ?? 0)]));
  }
  const constituencies = [...new Set((data.tds as Array<{ constituency: string | null }>).map((t) => t.constituency).filter((c): c is string => !!c))].sort();

  // The app as server/index.ts builds it, without importing it (it listens and schedules at import).
  const express = (await import('express')).default;
  const helmet = (await import('helmet')).default;
  const pinoHttp = (await import('pino-http')).default;
  const { logger } = await import('../utils/logger');
  const app = express();
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  const server = await (await import('../routes')).registerRoutes(app);
  app.use((await import('../middleware/errorHandler')).errorHandler);
  installRobotSignIn((await import('../auth/supabase')).supabase, database, (n) => ({
    county: COUNTIES[n % COUNTIES.length]!,
    constituency: constituencies[n % Math.max(constituencies.length, 1)] ?? 'Dublin Central',
  }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const recorder = new Recorder();
  const rng = mulberry32(args.seed);
  const people = makeRespondents(args.robots + PROBE_ROBOTS, rng);
  const world: World = { base: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`, questions, offsets: itemOffsets(QUIZ_QUESTIONS, rng), recorder };
  const robots: Robot[] = people.map((p, i) => ({
    n: i + 1,
    kind: i < args.robots ? kindOf(i + 1) : 'finisher',
    // The probe robots share ONE address: what people behind one office network would hit.
    ip: i < args.robots ? robotAddress(i + 1) : '10.255.255.254',
    latent: p.latent,
    noise: p.noise,
    seed: Math.floor(rng() * 2 ** 32),
  }));

  const poolWaiting: number[] = [];
  const sampler = setInterval(() => poolWaiting.push(pool.waitingCount), 250);
  const crowd = robots.slice(0, args.robots);
  await inBatches(crowd, args.concurrency, (robot) => runRobot(world, robot));
  const probe = { robots: PROBE_ROBOTS, votes: 0, rateLimited: 0 };
  await inBatches(robots.slice(args.robots), args.concurrency, async (robot) => {
    const outcome = await runRobot(world, robot);
    probe.votes += outcome.votes + outcome.articleVotes;
    probe.rateLimited += outcome.rateLimited;
  });
  clearInterval(sampler);

  const counts = {} as Record<RobotKind, KindCounts>;
  for (const kind of KINDS) {
    const ids = crowd.filter((r) => r.kind === kind).map((r) => `robot-${r.n}`);
    counts[kind] = { robots: ids.length, ...(await countsFor(pool, ids)) };
  }

  const dir = path.join('reports', 'robots', started.toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const { loadLatestQuizzes } = await import('../quiz/analyse/loader');
  const { EXCLUSION_REASONS, toRespondent } = await import('../quiz/analyse/exposures');
  const { analyse } = await import('../quiz/analyse/analyse');
  const { renderReport } = await import('../quiz/analyse/report');
  const respondents = [];
  const excluded = Object.fromEntries(EXCLUSION_REASONS.map((r) => [r, 0])) as Record<(typeof EXCLUSION_REASONS)[number], number>;
  for (const row of await loadLatestQuizzes(pool)) {
    const out = toRespondent(row, QUIZ_QUESTIONS);
    if (out.ok) respondents.push(out.r);
    else excluded[out.reason] += 1;
  }
  const analysisFile = path.join(dir, 'analysis.md');
  fs.writeFileSync(analysisFile, renderReport(analyse(respondents, QUIZ_QUESTIONS, excluded), new Date()));

  const reportFile = path.join(dir, 'report.md');
  fs.writeFileSync(
    reportFile,
    renderRobotReport({
      started,
      finished: new Date(),
      config: args,
      seeded: seeded.rows,
      recorder,
      counts,
      poolWaiting,
      probe,
      refuserSessions: counts.refuser.sessions,
      analysisFile,
    }),
  );
  console.log(`Wrote ${reportFile}: ${args.robots} robots, ${recorder.findings.length} finding(s).`);
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await shutdown();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // cacheService keeps a timer alive, so the run ends itself.
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
