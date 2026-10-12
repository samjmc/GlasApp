import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

async function load() {
  vi.resetModules();
  return import('./supabase');
}

describe('serviceRoleKey', () => {
  it('uses the service-role key whenever it is set', async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    const { serviceRoleKey } = await load();
    expect(serviceRoleKey({ NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' })).toBe('service');
  });

  it('refuses to fall back to the anon key in production, whether the key is missing or empty', async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    const { serviceRoleKey } = await load();
    expect(() => serviceRoleKey({ NODE_ENV: 'production', SUPABASE_ANON_KEY: 'anon' })).toThrow(/SUPABASE_SERVICE_ROLE_KEY must be set in production/);
    expect(() => serviceRoleKey({ NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_ANON_KEY: 'anon' })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY must be set in production/,
    );
  });

  it('falls back to the anon key outside production, so dev and tests start without it', async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    const { serviceRoleKey } = await load();
    expect(serviceRoleKey({ NODE_ENV: 'development', SUPABASE_ANON_KEY: 'anon' })).toBe('anon');
    expect(serviceRoleKey({ SUPABASE_ANON_KEY: 'anon' })).toBe('anon');
  });
});

describe('server/auth/supabase at start-up', () => {
  it('stops in production without the service-role key', async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'anon';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NODE_ENV = 'production';
    await expect(load()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY must be set in production/);
  });

  it('starts in production with the key, and without it outside production', async () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    process.env.NODE_ENV = 'production';
    await expect(load()).resolves.toHaveProperty('supabaseAdmin');

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NODE_ENV = 'test';
    await expect(load()).resolves.toHaveProperty('supabaseAdmin');
  });
});
