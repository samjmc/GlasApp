/**
 * Only SCHEDULER=on starts the crons (docs/deploy.md). They write to the real database (scoring, the
 * parliament sync), so they are turned on on purpose: unset, empty, `off`, `true`, `ON` or a typo such
 * as `offf` all leave them off, and the start-up log says so.
 */
export function schedulerDisabled(value: string | undefined): boolean {
  return value !== 'on';
}
