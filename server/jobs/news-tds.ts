/**
 * Link new articles to the TDs they name and make daily-vote questions. Scores nobody.
 *
 *   npm run news:tds
 *   npm run news:tds -- --article 123    one article, bypassing triage
 */
import { processArticleById, runTdPipeline } from '../news/tdPipeline';
import { shutdown } from '../db';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const articleFlag = args.indexOf('--article');

  if (articleFlag >= 0) {
    const id = Number(args[articleFlag + 1]);
    if (!Number.isInteger(id)) throw new Error('--article needs an integer id');
    const stats = await processArticleById(id);
    console.log(`Article ${id}: ${stats.tdsLinked} TD link(s), ${stats.errors} error(s).`);
    return;
  }
  const stats = await runTdPipeline({ batchSize: 50, topPercentile: 25, minImportanceScore: 40 });
  console.log(
    `Articles: ${stats.totalArticles} fetched, ${stats.selectedForScoring} selected, ` +
      `${stats.articlesProcessed} processed. ` +
      `TD links: ${stats.tdsLinked}. Errors: ${stats.errors}.`,
  );
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
