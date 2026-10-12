/**
 * Rebuild every user, TD and party ideology profile from its evidence. No model calls.
 *   npm run ideology -- --recalculate --yes     (--yes: needed for a database not on this machine)
 */
import { recalculateAll, unknownTdCount } from '../ideology';
import { shutdown } from '../db';
import { approveWrite } from './liveDbGuard';

async function main(): Promise<void> {
  if (!process.argv.slice(2).includes('--recalculate')) {
    throw new Error('Usage: npm run ideology -- --recalculate [--yes]');
  }
  approveWrite('ideology');
  const summary = await recalculateAll();
  console.log(
    `Re-scored ${summary.quizzesRescored} stored quiz result(s). ` +
      `Recalculated ${summary.users} users, ${summary.tds} TDs and ${summary.parties} parties.`,
  );
  if (unknownTdCount()) console.log(`${unknownTdCount()} evidence item(s) named an unknown TD.`);
}

main()
  .then(() => shutdown())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await shutdown();
    process.exit(1);
  });
