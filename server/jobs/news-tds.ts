/**
 * Link new articles to the TDs they name, record the stances they verifiably stated, and make
 * daily-vote questions. Scores nobody.
 *
 *   npm run news:tds
 *   npm run news:tds -- --article 123    one article, bypassing triage
 */
import { processArticleById, runTdPipeline } from '../news/tdPipeline';
import type { StanceStats } from '../stances';
import { shutdown } from '../db';

const stanceLine = (s: StanceStats) =>
  `Stances: ${s.extracted} extracted, ${s.accepted} accepted, ${s.mapped} matched to an answer; rejected ` +
  Object.keys(s.rejected)
    .map((reason) => `${reason} ${s.rejected[reason as keyof StanceStats['rejected']]}`)
    .join(', ') +
  '.';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const articleFlag = args.indexOf('--article');

  if (articleFlag >= 0) {
    const id = Number(args[articleFlag + 1]);
    if (!Number.isInteger(id)) throw new Error('--article needs an integer id');
    const stats = await processArticleById(id);
    console.log(`Article ${id}: ${stats.tdsLinked} TD link(s), ${stats.errors} error(s).`);
    console.log(stanceLine(stats.stances));
    return;
  }
  const stats = await runTdPipeline({ batchSize: 50, topPercentile: 25, minImportanceScore: 40 });
  console.log(
    `Articles: ${stats.totalArticles} fetched, ${stats.selectedForScoring} selected, ` +
      `${stats.articlesProcessed} processed. ` +
      `TD links: ${stats.tdsLinked}. Errors: ${stats.errors}.`,
  );
  console.log(stanceLine(stats.stances));
  if (stats.articlesFailed.length) console.log('Failed:', stats.articlesFailed.join(' | '));
}

main()
  .then(() => shutdown())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await shutdown();
    process.exit(1);
  });
