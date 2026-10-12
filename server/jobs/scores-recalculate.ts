/**
 * Rebuild every TD's derived scores and ranks from the Oireachtas facts. No LLM calls.
 *
 *   npm run scores:recalculate -- --yes     (--yes: needed for a database not on this machine)
 */
import { recalculateAll } from '../scoring';
import { shutdown } from '../db';
import { approveWrite } from './liveDbGuard';

approveWrite('scores:recalculate');
recalculateAll()
  .then(async (summary) => {
    console.log(`Recalculated ${summary.tds} TDs and ${summary.parties} parties.`);
    await shutdown();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await shutdown();
    process.exit(1);
  });
