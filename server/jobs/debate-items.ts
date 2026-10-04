/**
 * Read argued debates for items: Step 2 of docs/plans/debate-analysis.md. Not scheduled: items
 * are scored, and read daily, only after the check set passes (Step 3).
 *
 *   npm run debates:items -- --pilot 50          a fixed sample of 50 argued debates
 *   npm run debates:items -- --debate <id> …     these debates
 *   npm run debates:items -- --limit 20          the first 20 not read yet
 *   --dry-run         make the calls, write nothing
 *   --force           read again even when this version already read the same speeches
 *   --concurrency N   debates read at once (default 2: DeepSeek caps concurrent calls per account,
 *                     by balance, and other apps share the key)
 *
 * Prints the tokens, the cost at DeepSeek's list prices, what code rejected by language, and
 * what reading every argued debate would cost at the same rate.
 */
import { shutdown } from '../db';
import { repository as repo } from '../parliament';
import { costOf, extractDebates } from '../parliament/debateItems/run';
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

async function main() {
  const argv = process.argv.slice(2);
  if (!isLLMConfigured()) throw new Error('No LLM configured: set LLM_API_KEY.');
  const debateIds = argv.flatMap((a, i) => (argv[i - 1] === '--debate' ? [a] : []));
  const summary = await extractDebates({
    debateIds: debateIds.length > 0 ? debateIds : undefined,
    pilot: argNumber(argv, '--pilot'),
    limit: argNumber(argv, '--limit'),
    concurrency: argNumber(argv, '--concurrency') ?? 2,
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    log: (line) => console.log(line),
  });

  // The rate comes from finished debates only: a failed one stops part-way and would understate it.
  const done = summary.results.filter((r) => !r.error);
  const doneWords = done.reduce((n, r) => n + r.words, 0);
  const all = await repo.arguedDebates();
  const allWords = all.reduce((n, d) => n + d.words, 0);
  const scale = doneWords > 0 ? allWords / doneWords : 0;
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
      ? `All ${all.length} argued debates (${allWords} words) at the rate of the ${done.length} finished: ${usd(full.offPeak)} off-peak, ${usd(full.peak)} peak.`
      : `No debate finished, so there is no rate to project.`,
  );
  if (summary.stopped) console.log(`Stopped early: ${summary.stopped}.`);
  if (summary.orphansRemoved > 0) console.log(`Removed ${summary.orphansRemoved} item(s) whose speech left the record.`);
  if (argv.includes('--dry-run')) console.log('Dry run: nothing was written.');
}

main()
  .then(() => shutdown())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await shutdown();
    process.exit(1);
  });
