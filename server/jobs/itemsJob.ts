/**
 * The command line shared by the debate and question extractors (debate-items.ts,
 * question-items.ts): the same flags, and the same report of tokens, cost at DeepSeek's list
 * prices, what code rejected by language, and what reading every unit would cost at that rate.
 *
 * Exactly one of:
 *   --all             every unit not read yet, or whose speeches changed
 *   --limit N         the first N not read yet, or whose word count changed since their read
 *   --pilot N         a fixed sample of N units
 *   --debate <id> …   these units (debate or exchange ids)
 * and any of:
 *   --dry-run         make the calls, write nothing
 *   --force           read again even when this version already read the same speeches
 *   --concurrency N   units read at once (default 2: DeepSeek caps concurrent calls per account,
 *                     by balance, and other apps share the key)
 *
 * The process exits 1 when a unit failed or the run stopped early, so a chained command stops too.
 */
import { shutdown } from '../db';
import { costOf, type ExtractOptions, type ExtractSummary } from '../parliament/debateItems/run';
import { REJECT_REASONS } from '../parliament/debateItems/verify';
import { isLLMConfigured } from '../services/aiService';

const USAGE = 'Use one of --all, --limit N, --pilot N or --debate <id> …, with any of --dry-run, --force, --concurrency N.';
const FLAGS = ['--all', '--limit', '--pilot', '--debate', '--dry-run', '--force', '--concurrency'];
const VALUE_FLAGS = ['--limit', '--pilot', '--concurrency'];

/** Every flag is checked: a mistyped one must not fall through to a paid run of every unit. */
export function parseArgs(argv: string[]): Omit<ExtractOptions, 'complete' | 'log'> {
  const ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!FLAGS.includes(arg)) throw new Error(`Unknown argument ${arg}. ${USAGE}`);
    if (VALUE_FLAGS.includes(arg)) i++;
    if (arg !== '--debate') continue;
    const before = ids.length;
    while (i + 1 < argv.length && !argv[i + 1]!.startsWith('--')) ids.push(argv[++i]!);
    if (ids.length === before) throw new Error(`--debate needs at least one id. ${USAGE}`);
  }
  const count = (flag: string) => {
    const at = argv.indexOf(flag);
    if (at === -1) return null;
    const n = Number(argv[at + 1]);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} needs a whole number. ${USAGE}`);
    return n;
  };
  const scopes = [argv.includes('--all'), argv.includes('--limit'), argv.includes('--pilot'), ids.length > 0].filter(Boolean).length;
  if (scopes !== 1) throw new Error(USAGE);
  return {
    debateIds: ids.length > 0 ? ids : undefined,
    pilot: count('--pilot'),
    limit: count('--limit'),
    concurrency: count('--concurrency') ?? 2,
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
  };
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export interface ItemsJob {
  /** "argued debates", "question exchanges": how the report names the units. */
  units: string;
  extract(options: ExtractOptions): Promise<ExtractSummary>;
}

async function main(job: ItemsJob): Promise<ExtractSummary> {
  const options = parseArgs(process.argv.slice(2));
  if (!isLLMConfigured()) throw new Error('No LLM configured: set LLM_API_KEY.');
  const summary = await job.extract({ ...options, log: (line) => console.log(line) });

  // The rate comes from finished units only: a failed one stops part-way and would understate it.
  const done = summary.results.filter((r) => !r.error);
  const doneWords = done.reduce((n, r) => n + r.words, 0);
  const scale = doneWords > 0 ? summary.all.words / doneWords : 0;
  const full = costOf(done.reduce((n, r) => n + r.promptTokens, 0) * scale, done.reduce((n, r) => n + r.completionTokens, 0) * scale);
  const kinds = Object.entries(summary.acceptedByKind).map(([k, n]) => `${k} ${n}`).join(', ');
  const rejections = REJECT_REASONS.filter((r) => summary.rejected[r].en + summary.rejected[r].ga > 0)
    .map((r) => `${r} ${summary.rejected[r].en} en / ${summary.rejected[r].ga} ga`)
    .join('; ');

  console.log('');
  console.log(`Chosen: ${summary.debates} ${job.units}; ${summary.done} done, ${summary.failed} failed, ${summary.skipped} already read.`);
  console.log(`Read: ${summary.speeches} speeches (${summary.irishSpeeches} in Irish), ${summary.words} words, ${summary.calls} calls.`);
  console.log(`Tokens: ${summary.promptTokens} in, ${summary.completionTokens} out. Cost ${usd(summary.costUsd.offPeak)} off-peak, ${usd(summary.costUsd.peak)} peak.`);
  console.log(`Items accepted: ${kinds}.`);
  console.log(`Rejected by code: ${rejections || 'none'}${summary.malformed ? `; ${summary.malformed} malformed entries` : ''}.`);
  console.log(
    doneWords > 0
      ? `All ${summary.all.count} ${job.units} (${summary.all.words} words) at the rate of the ${done.length} finished: ${usd(full.offPeak)} off-peak, ${usd(full.peak)} peak.`
      : `Nothing finished, so there is no rate to project.`,
  );
  if (summary.stopped) console.log(`Stopped early: ${summary.stopped}.`);
  if (summary.orphansRemoved > 0) console.log(`Removed ${summary.orphansRemoved} item(s) whose speech left the record.`);
  console.log(options.dryRun ? 'Dry run: nothing was written.' : `Record rebuilt: ${summary.recordRows} rows.`);
  return summary;
}

export function runItemsJob(job: ItemsJob): void {
  main(job)
    .then(async (summary) => {
      await shutdown();
      if (summary.failed > 0 || summary.stopped) process.exitCode = 1;
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      await shutdown();
      process.exit(1);
    });
}
