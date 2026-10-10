import { describe, expect, it, vi } from 'vitest';

// server/db refuses to load without DATABASE_URL; building the pool does not connect.
process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/unused';
const { poolMax, pool } = await import('./db');

describe('DB_POOL_MAX', () => {
  it('defaults to 15 and takes a whole number from 1 to 50', () => {
    expect(poolMax(undefined)).toBe(15);
    expect(poolMax('')).toBe(15);
    expect(poolMax('30')).toBe(30);
    for (const bad of ['0', '51', '2.5', 'ten', '-3']) expect(() => poolMax(bad), bad).toThrow(/DB_POOL_MAX/);
  });
});

describe('the connection pool', () => {
  it('has an error listener, so a dropped idle connection cannot crash the process', () => {
    // node-postgres rethrows an unhandled pool "error" as an uncaught exception.
    expect(pool.listenerCount('error')).toBeGreaterThan(0);
  });

  it('logs an idle-connection failure instead of throwing it', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('idle connection failed'), 'Connection terminated unexpectedly');
    logged.mockRestore();
  });
});
