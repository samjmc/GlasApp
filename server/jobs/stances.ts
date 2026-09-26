/**
 * Rebuild TD stance evidence from the news, in one run:
 *   1. delete the deleted scoring panel's `article` evidence (an LLM's guess, never checked);
 *   2. re-read canonical articles of the last N days that ALREADY have a daily-vote question,
 *      and record their verified stances (extract → verify → map → save → evidence);
 *   3. recalculate every ideology profile.
 * It never makes a question: a new one would carry today's date and flood the daily sessions.
 * Needs an LLM key (extract and map are model calls). `--dry-run` makes the calls and counts,
 * but writes nothing.
 *
 *   npm run stances -- --rebuild [--days 180] [--dry-run]
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { shutdown } from '../db';
import { deleteTdEvidence, recalculateAll } from '../ideology';
import { isLLMConfigured } from '../services/aiService';
import { emptyStanceStats, rebuildArticles, recordStances, toCandidate } from '../stances';
import { completeJson, questionForArticle } from '../voting';

const DEFAULT_DAYS = 180;
const USAGE = 'Usage: npm run stances -- --rebuild [--days 180] [--dry-run]';

export function parseArgs(argv: string[]): { days: number; dryRun: boolean } {
  if (!argv.includes('--rebuild')) throw new Error(USAGE);
  const at = argv.indexOf('--days');
  const days = at === -1 ? DEFAULT_DAYS : Number(argv[at + 1]);
  if (!Number.isInteger(days) || days <= 0) throw new Error(`--days needs a positive whole number. ${USAGE}`);
  return { days, dryRun: argv.includes('--dry-run') };
}

async function main(): Promise<void> {
  const { days, dryRun } = parseArgs(process.argv.slice(2));
  // Checked before the purge: without a model, step 2 records nothing and step 1 has already run.
  if (!isLLMConfigured()) throw new Error('No LLM key is configured, so no stance can be extracted. Nothing was changed.');

  const articles = await rebuildArticles(new Date(Date.now() - days * 86_400_000));
  const purged = await deleteTdEvidence('article', dryRun);
  const stats = emptyStanceStats();
  let failed = 0;
  for (const article of articles) {
    try {
      await recordStances({ id: article.id, title: article.title, content: article.content }, article.tds.map(toCandidate), stats, {
        complete: completeJson,
        question: () => questionForArticle(article.id),
        dryRun,
      });
    } catch (error) {
      failed++;
      console.warn(`[stances] article ${article.id} failed:`, error instanceof Error ? error.message : error);
    }
  }

  const prefix = dryRun ? '[dry run, nothing written] ' : '';
  console.log(`${prefix}${dryRun ? 'Would delete' : 'Deleted'} ${purged} article evidence row(s).`);
  console.log(
    `${prefix}${articles.length} article(s) from the last ${days} days: ${stats.extracted} stance(s) extracted, ` +
      `${stats.accepted} accepted, ${stats.mapped} matched to an answer, ${failed} article(s) failed. Rejected: ` +
      `${Object.keys(stats.rejected).map((reason) => `${reason} ${stats.rejected[reason as keyof typeof stats.rejected]}`).join(', ')}.`,
  );
  if (!dryRun) {
    const summary = await recalculateAll();
    console.log(`Recalculated ${summary.users} users, ${summary.tds} TDs and ${summary.parties} parties.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then(() => shutdown())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error(error);
      await shutdown();
      process.exit(1);
    });
}
