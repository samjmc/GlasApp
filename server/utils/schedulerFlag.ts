/**
 * SCHEDULER=off stops every cron (docs/deploy.md). `false`, `0` and `no` mean the same, in any case:
 * someone who writes SCHEDULER=false has said they do not want the jobs, and reading it as "on" would
 * start four jobs against the real database on the first boot. Unset, empty or anything else runs them.
 */
export function schedulerDisabled(value: string | undefined): boolean {
  return /^(off|false|0|no)$/i.test((value ?? '').trim());
}
