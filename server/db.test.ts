import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

// server/db refuses to load without DATABASE_URL; building the pool does not connect.
process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/unused';
const { poolMax, pool } = await import('./db');

describe('DB_POOL_MAX', () => {
  it('defaults to 10 (GlasCore pooler holds 15, shared with GlasIntelligence) and takes a whole number from 1 to 50', () => {
    expect(poolMax(undefined)).toBe(10);
    expect(poolMax('')).toBe(10);
    expect(poolMax('30')).toBe(30);
    for (const bad of ['0', '51', '2.5', 'ten', '-3']) expect(() => poolMax(bad), bad).toThrow(/DB_POOL_MAX/);
  });
});

describe('the connection pool', () => {
  it('has an error listener, so a dropped idle connection cannot crash the process', () => {
    // node-postgres rethrows an unhandled pool "error" as an uncaught exception.
    expect(pool.listenerCount('error')).toBeGreaterThan(0);
  });

  it('gives every new client an error listener for its whole life, so a connection that drops mid-transaction cannot crash the process', () => {
    // pg-pool removes its own listener while a client is checked out; this one has to stay.
    const client = new EventEmitter();
    pool.emit('connect', client);
    expect(client.listenerCount('error')).toBe(1);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => client.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('a connection failed'), 'terminating connection due to administrator command');
    logged.mockRestore();
  });

  it('logs an idle-connection failure instead of throwing it', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('idle connection failed'), 'Connection terminated unexpectedly');
    logged.mockRestore();
  });
});
