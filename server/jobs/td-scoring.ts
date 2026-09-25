/**
 * Score new articles now, then recalculate.   npm run td-scoring
 * Recalculate only, no LLM calls:               npm run td-scoring -- --recalculate
 * One article, bypassing triage:                npm run td-scoring -- --article 123
 */
import { recalculateAll, runPipeline, scoreArticleById } from '../scoring';
import { shutdown } from '../db';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const articleFlag = args.indexOf('--article');

  if (args.includes('--recalculate')) {
    const summary = await recalculateAll();
    console.log(`Recalculated ${summary.tds} TDs and ${summary.parties} parties.`);
    return;
  }
  if (articleFlag >= 0) {
    const id = Number(args[articleFlag + 1]);
    if (!Number.isInteger(id)) throw new Error('--article needs an integer id');
    const stats = await scoreArticleById(id);
    console.log(`Article ${id}: ${stats.tdsUpdated} TD(s) updated, ${stats.errors} error(s).`);
    return;
  }
  const stats = await runPipeline({ batchSize: 50, topPercentile: 25, minImportanceScore: 40 });
  console.log(
    `Articles: ${stats.totalArticles} fetched, ${stats.selectedForScoring} selected, ` +
      `${stats.articlesProcessed} processed. ` +
      `TDs updated: ${stats.tdsUpdated}. Errors: ${stats.errors}.`,
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
