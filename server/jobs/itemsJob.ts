/**
 * The command line shared by the debate and question extractors (debate-items.ts,
 * question-items.ts): the same flags, and the same report of tokens, cost at DeepSeek's list
 * prices, what code rejected by language, and what reading every unit would cost at that rate.
 *
 *   --pilot N         a fixed sample of N units
 *   --debate <id> …   these units (debate or exchange ids)
 *   --limit N         the first N not read yet
 *   --dry-run         make the calls, write nothing
 *   --force           read again even when this version already read the same speeches
 *   --concurrency N   units read at once (default 2: DeepSeek caps concurrent calls per account,
 *                     by balance, and other apps share the key)
 */
import { shutdown } from '../db';
import { costOf, type ExtractOptions, type ExtractSummary } from '../parliament/debateItems/run';
import { REJECT_REASONS } from '../parliament/debateItems/verify';
import { isLLMConfigured } from '../services/aiService';

function argValue(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  return i === -1 ? null : (argv[i + 1] ?? null);
}

function argNumber(argv: string[], flag: string): number | null {
  const v = argValue(argv, flag);
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} needs a whole number`);
  return n;
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export interface ItemsJob {
  /** "argued debates", "question exchanges": how the report names the units. */
  units: string;
  extract(options: ExtractOptions): Promise<ExtractSummary>;
  /** How many units there are and their words, to project the cost of reading them all. */
  total(): Promise<{ count: number; words: number }>;
}

async function main(job: ItemsJob) {
  const argv = process.argv.slice(2);
  if (!isLLMConfigured()) throw new Error('No LLM configured: set LLM_API_KEY.');
  const ids = argv.flatMap((a, i) => (argv[i - 1] === '--debate' ? [a] : []));
  const summary = await job.extract({
    debateIds: ids.length > 0 ? ids : undefined,
    pilot: argNumber(argv, '--pilot'),
    limit: argNumber(argv, '--limit'),
    concurrency: argNumber(argv, '--concurrency') ?? 2,
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    log: (line) => console.log(line),
  });

  // The rate comes from finished units only: a failed one stops part-way and would understate it.
  const done = summary.results.filter((r) => !r.error);
  const doneWords = done.reduce((n, r) => n + r.words, 0);
  const all = await job.total();
  const scale = doneWords > 0 ? all.words / doneWords : 0;
  const full = costOf(done.reduce((n, r) => n + r.promptTokens, 0) * scale, done.reduce((n, r) => n + r.completionTokens, 0) * scale);
  const kinds = Object.entries(summary.acceptedByKind).map(([k, n]) => `${k} ${n}`).join(', ');
  const rejections = REJECT_REASONS.filter((r) => summary.rejected[r].en + summary.rejected[r].ga > 0)
    .map((r) => `${r} ${summary.rejected[r].en} en / ${summary.rejected[r].ga} ga`)
    .join('; ');

  console.log('');
  console.log(`Debates: ${summary.debates} chosen, ${summary.done} done, ${summary.failed} failed, ${summary.skipped} already read.`);
  console.log(`Read: ${summary.speeches} speeches (${summary.irishSpeeches} in Irish), ${summary.words} words, ${summary.calls} calls.`);
  console.log(`Tokens: ${summary.promptTokens} in, ${summary.completionTokens} out. Cost ${usd(summary.costUsd.offPeak)} off-peak, ${usd(summary.costUsd.peak)} peak.`);
  console.log(`Items accepted: ${kinds}.`);
  console.log(`Rejected by code: ${rejections || 'none'}${summary.malformed ? `; ${summary.malformed} malformed entries` : ''}.`);
  console.log(
    doneWords > 0
      ? `All ${all.count} ${job.units} (${all.words} words) at the rate of the ${done.length} finished: ${usd(full.offPeak)} off-peak, ${usd(full.peak)} peak.`
      : `Nothing finished, so there is no rate to project.`,
  );
  if (summary.stopped) console.log(`Stopped early: ${summary.stopped}.`);
  if (summary.orphansRemoved > 0) console.log(`Removed ${summary.orphansRemoved} item(s) whose speech left the record.`);
  if (argv.includes('--dry-run')) console.log('Dry run: nothing was written.');
}

export function runItemsJob(job: ItemsJob): void {
  main(job)
    .then(() => shutdown())
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      await shutdown();
      process.exit(1);
    });
}
