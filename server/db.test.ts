import { describe, expect, it } from 'vitest';

// server/db refuses to load without DATABASE_URL; building the pool does not connect.
process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/unused';
const { poolMax } = await import('./db');

describe('DB_POOL_MAX', () => {
  it('defaults to 10 (GlasCore pooler holds 15, shared with GlasIntelligence) and takes a whole number from 1 to 50', () => {
    expect(poolMax(undefined)).toBe(10);
    expect(poolMax('')).toBe(10);
    expect(poolMax('30')).toBe(30);
    for (const bad of ['0', '51', '2.5', 'ten', '-3']) expect(() => poolMax(bad), bad).toThrow(/DB_POOL_MAX/);
  });
});
