import { describe, expect, it } from 'vitest';
import { schedulerDisabled } from './schedulerFlag';

describe('schedulerDisabled', () => {
  it('reads off, false, 0 and no as "do not run the crons", in any case and with spaces', () => {
    for (const value of ['off', 'OFF', 'Off', ' off ', 'false', 'False', '0', 'no', 'NO']) expect(schedulerDisabled(value), value).toBe(true);
  });

  it('runs the crons when it is unset, empty, on, or anything else', () => {
    for (const value of [undefined, '', ' ', 'on', 'true', '1', 'yes', 'offf']) expect(schedulerDisabled(value), String(value)).toBe(false);
  });
});
