import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { schedulerDisabled } from './schedulerFlag';

describe('server/index.ts', () => {
  it('decides whether to start the crons through schedulerDisabled, not a literal comparison', () => {
    const source = readFileSync(path.resolve(__dirname, '../index.ts'), 'utf8');
    expect(source).toMatch(/if \(schedulerDisabled\(process\.env\.SCHEDULER\)\) \{/);
    expect(source).not.toMatch(/process\.env\.SCHEDULER === ['"]off['"]/);
  });
});

describe('schedulerDisabled', () => {
  it('runs the crons only for exactly "on"', () => {
    expect(schedulerDisabled('on')).toBe(false);
  });

  it('leaves them off when it is unset, empty, off, or anything else, typos included', () => {
    for (const value of [undefined, '', ' ', 'off', 'OFF', 'false', '0', 'no', 'true', '1', 'yes', 'ON', ' on', 'offf']) expect(schedulerDisabled(value), String(value)).toBe(true);
  });
});
