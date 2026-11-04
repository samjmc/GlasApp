/**
 * Ingest new Oireachtas data and refresh every TD's parliament record and score.
 *
 *   npm run parliament:sync -- --yes                       resume from the last run
 *   npm run parliament:sync -- --since 2024-11-29 --yes    re-ingest from a date
 *   npm run parliament:sync -- --force-roster --yes        apply a roster that deactivates many TDs (after an election)
 *
 * --yes: needed for a database not on this machine. The scheduler calls runSync directly, so it
 * never needs it.
 *
 * Safe to re-run: every write replaces what it covers. The scheduler runs it daily. One sync at
 * a time across processes: a second one, here or in the server, refuses to start.
 */
import 'dotenv/config';
import { runSync, syncHadFailures } from '../parliament';
import { shutdown } from '../db';
import { approveWrite } from './liveDbGuard';

function argSince(argv: string[]): string | undefined {
  const i = argv.indexOf('--since');
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('--since needs a date: YYYY-MM-DD');
  return value;
}

const since = argSince(process.argv.slice(2));
approveWrite('parliament:sync');
runSync({ since, forceRoster: process.argv.includes('--force-roster') })
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
