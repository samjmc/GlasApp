/**
 * The robot run's safety guards (docs/plans/robot-run.md). Pure: no server import, so they run
 * before server/db reads DATABASE_URL and before server/services/aiService.ts loads `.env`.
 *
 * The run sets its own environment instead of trusting the shell: on Windows `$env:X = ''`
 * deletes X, and dotenv then fills it from `.env`. A variable set to '' is never overridden.
 */
import { BLANKED_ENV } from '../../../test/e2e/harness';

/** Nothing listens on port 9, so a Supabase call fails at once instead of reaching the real one. */
export const NO_SUPABASE = 'http://127.0.0.1:9';
export const DATABASE_SUFFIX = 'robots';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** What the run sets before anything else loads. */
export function robotEnvironment(): Record<string, string> {
  return {
    ...Object.fromEntries(BLANKED_ENV.map((key) => [key, ''])),
    SUPABASE_URL: NO_SUPABASE,
    SUPABASE_ANON_KEY: 'robots-anon',
    // '' would crash server/auth/supabase.ts, which falls back with `??`.
    SUPABASE_SERVICE_ROLE_KEY: 'robots-service-role',
    NODE_ENV: 'production',
    LOG_LEVEL: 'warn',
    SCHEDULER: 'off',
  };
}

/** Sets the run's environment, including DATABASE_URL, then checks every value took. */
export function prepareEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  const url = robotDatabaseUrl(env);
  Object.assign(env, robotEnvironment(), { DATABASE_URL: url });
  for (const [key, value] of Object.entries({ ...robotEnvironment(), DATABASE_URL: url })) {
    if (env[key] !== value) throw new Error(`refusing to run: ${key} did not take its robot value`);
  }
  return url;
}

/** The `_robots` database next to TEST_DATABASE_URL, on this machine only. */
export function robotDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.TEST_DATABASE_URL;
  if (!base) throw new Error('refusing to run: TEST_DATABASE_URL is not set (a local, disposable Postgres)');
  const url = new URL(base);
  if (!LOCAL_HOSTS.includes(url.hostname)) throw new Error(`refusing to run: host ${url.hostname} is not local`);
  url.pathname = `/${url.pathname.replace(/^\//, '') || 'postgres'}_${DATABASE_SUFFIX}`;
  return url.toString();
}

/** After connecting: the server really is on a `_robots` database. */
export function assertRobotDatabase(currentDatabase: string | undefined): void {
  if (!currentDatabase?.endsWith(`_${DATABASE_SUFFIX}`)) {
    throw new Error(`refusing to run: connected to ${currentDatabase ?? 'nothing'}, not a _${DATABASE_SUFFIX} database`);
  }
}

/** Daily sessions are dated Europe/Dublin; a run crossing midnight gets 409s. */
export function minutesToDublinMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  return 24 * 60 - (hour * 60 + minute);
}

export const MIDNIGHT_MARGIN_MINUTES = 30;

export function assertNotNearMidnight(now: Date): void {
  if (minutesToDublinMidnight(now) < MIDNIGHT_MARGIN_MINUTES) {
    throw new Error(`refusing to run: less than ${MIDNIGHT_MARGIN_MINUTES} minutes to midnight in Dublin, when daily sessions roll over`);
  }
}
