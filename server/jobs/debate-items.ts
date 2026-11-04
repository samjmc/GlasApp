/**
 * Read argued debates for items: Step 2 of docs/plans/debate-analysis.md. Flags and report in
 * itemsJob.ts.
 *
 *   npm run debates:items -- --pilot 50          a fixed sample of 50 argued debates
 *   npm run debates:items -- --debate <id> …     these debates
 *   npm run debates:items -- --limit 20          the first 20 not read yet
 */
import 'dotenv/config';
import { repository as repo } from '../parliament';
import { extractDebates } from '../parliament/debateItems/run';
import { runItemsJob } from './itemsJob';
import { approveWrite } from './liveDbGuard';

approveWrite('debates:items', process.argv.includes('--dry-run'));
runItemsJob({
  units: 'argued debates',
  extract: extractDebates,
  total: async () => {
    const all = await repo.arguedDebates();
    return { count: all.length, words: all.reduce((n, d) => n + d.words, 0) };
  },
});
