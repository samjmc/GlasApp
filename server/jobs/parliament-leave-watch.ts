/**
 * Weekly leave watch: list long silences no documented absence covers, for an admin to review
 * at /admin/leave-watch. See server/parliament/leaveWatch.ts. Scheduled by the app (Mondays);
 * this runs it by hand.
 *
 *   npm run parliament:leave-watch
 */
import { shutdown } from '../db';
import { leaveWatch } from '../parliament';

leaveWatch
  .runLeaveWatch()
  .then(async (s) => {
    console.log(`Leave watch: ${s.opened} opened, ${s.updated} updated, ${s.reopened} reopened, ${s.closed} closed; ${s.open} open.`);
    await shutdown();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await shutdown();
    process.exit(1);
  });
