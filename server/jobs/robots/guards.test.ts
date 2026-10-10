import { describe, expect, it } from 'vitest';
import { BLANKED_ENV } from '../../../test/e2e/harness';
import {
  NO_SUPABASE,
  assertNotNearMidnight,
  assertRobotDatabase,
  minutesToDublinMidnight,
  prepareEnvironment,
  robotDatabaseUrl,
} from './guards';

describe('robot run guards', () => {
  it('uses the _robots database next to TEST_DATABASE_URL, and only on this machine', () => {
    expect(robotDatabaseUrl({ TEST_DATABASE_URL: 'postgres://u:p@localhost:55432/postgres' })).toBe('postgres://u:p@localhost:55432/postgres_robots');
    expect(robotDatabaseUrl({ TEST_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432' })).toBe('postgres://u:p@127.0.0.1:5432/postgres_robots');
    expect(() => robotDatabaseUrl({})).toThrow(/TEST_DATABASE_URL is not set/);
    expect(() => robotDatabaseUrl({ TEST_DATABASE_URL: 'postgres://u:p@aws-1-eu-central-2.pooler.supabase.com:5432/postgres' })).toThrow(/is not local/);
  });

  it('sets its own environment: every model key blank, Supabase unreachable, the robots database', () => {
    // A key the shell left out, and one a .env would fill: both end up as the run sets them.
    const env: NodeJS.ProcessEnv = { TEST_DATABASE_URL: 'postgres://u:p@localhost:55432/postgres', JEV_API_KEY: 'real-key' };
    const url = prepareEnvironment(env);
    expect(url).toBe('postgres://u:p@localhost:55432/postgres_robots');
    expect(env.DATABASE_URL).toBe(url);
    expect(BLANKED_ENV.length).toBeGreaterThan(0);
    for (const key of BLANKED_ENV) expect(env[key], key).toBe('');
    expect(env.SUPABASE_URL).toBe(NO_SUPABASE);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).not.toBe('');
    expect(env.SCHEDULER).toBe('off');
  });

  it('refuses a connection that is not a _robots database', () => {
    expect(() => assertRobotDatabase('postgres_robots')).not.toThrow();
    for (const name of ['postgres', 'postgres_e2e', 'robots', undefined]) expect(() => assertRobotDatabase(name), String(name)).toThrow(/refusing/);
  });

  it('refuses to start within 30 minutes of midnight in Dublin', () => {
    // 2026-10-10 is Irish Summer Time (UTC+1).
    expect(minutesToDublinMidnight(new Date('2026-10-10T22:45:00Z'))).toBe(15);
    expect(() => assertNotNearMidnight(new Date('2026-10-10T22:45:00Z'))).toThrow(/midnight/);
    expect(() => assertNotNearMidnight(new Date('2026-10-10T12:00:00Z'))).not.toThrow();
  });
});
