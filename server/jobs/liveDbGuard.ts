/**
 * The approval step of a job run by hand (`npm run <job>`). Every run prints where it writes;
 * a run that writes to a database NOT on this machine stops with exit code 2 unless it has
 * `--yes`. A dry run needs no approval. Only the job entries in server/jobs call this: the
 * scheduler and the admin routes call the library functions directly and are not gated.
 *
 * Pure apart from `approveWrite`: no server import, so it runs before anything connects.
 */

/** Hosts on this machine. Anything else, or a URL that does not parse, is remote. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

export interface Target {
  host: string;
  database: string;
  local: boolean;
}

/** Only plain names are printed, so a mangled URL cannot put a password in the log. */
const printable = (s: string) => (/^[\w.\-:[\]]+$/.test(s) ? s : '(unprintable)');

/** Where a connection string points: its host and database name, never its password. */
export function targetOf(databaseUrl: string | undefined): Target {
  let url: URL;
  try {
    url = new URL(databaseUrl ?? '');
  } catch {
    return { host: '(unparseable DATABASE_URL)', database: '?', local: false };
  }
  // node-postgres lets ?host= override the host in the authority, so that is where it connects.
  const host = (url.searchParams.get('host') ?? url.hostname).toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return { host: host ? printable(host) : '(none)', database: database ? printable(database) : '(default)', local: LOCAL_HOSTS.has(host) };
}

/** The plan a run prints, and whether it may go on. */
export function writePlan(job: string, dryRun: boolean, argv: string[], databaseUrl: string | undefined): { approved: boolean; lines: string[] } {
  const t = targetOf(databaseUrl);
  const where = `${t.host}/${t.database}`;
  const lines = [`[${job}] target: ${where} (${t.local ? 'local' : 'remote'}), ${dryRun ? 'dry run: nothing is written' : 'writes'}`];
  const approved = t.local || dryRun || argv.includes('--yes');
  if (!approved) lines.push(`[${job}] nothing was changed. Re-run with --yes to write to ${where}.`);
  return { approved, lines };
}

/**
 * Call first in a job entry, after its own argument checks. `dryRun` is the job's own parsed
 * flag: a job without a dry run passes nothing, so a stray `--dry-run` never counts as one.
 */
export function approveWrite(job: string, dryRun = false, argv = process.argv.slice(2), databaseUrl = process.env.DATABASE_URL): void {
  const plan = writePlan(job, dryRun, argv, databaseUrl);
  for (const line of plan.lines) console.log(line);
  if (!plan.approved) process.exit(2);
}
