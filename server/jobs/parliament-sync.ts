/**
 * Ingest new Oireachtas data and refresh every TD's parliament record and score.
 *
 *   npm run parliament:sync                       resume from the last run
 *   npm run parliament:sync -- --since 2024-11-29 re-ingest from a date
 *
 * Safe to re-run: every write replaces what it covers. The scheduler runs it daily.
 */
import { runSync, syncHadFailures } from '../parliament';
import { shutdown } from '../db';

function argSince(argv: string[]): string | undefined {
  const i = argv.indexOf('--since');
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('--since needs a date: YYYY-MM-DD');
  return value;
}

runSync({ since: argSince(process.argv.slice(2)) })
  .then(async (summary) => {
    console.log(JSON.stringify(summary, null, 2));
    await shutdown();
    process.exit(syncHadFailures(summary) ? 1 : 0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await shutdown();
    process.exit(1);
  });
