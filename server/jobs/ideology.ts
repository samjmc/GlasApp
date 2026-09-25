/**
 * Rebuild every user, TD and party ideology profile from its evidence. No model calls.
 *   npm run ideology -- --recalculate
 */
import { recalculateAll, unknownTdCount } from '../ideology';
import { shutdown } from '../db';

async function main(): Promise<void> {
  if (!process.argv.slice(2).includes('--recalculate')) {
    throw new Error('Usage: npm run ideology -- --recalculate');
  }
  const summary = await recalculateAll();
  console.log(`Recalculated ${summary.users} users, ${summary.tds} TDs and ${summary.parties} parties.`);
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
