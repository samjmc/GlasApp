/**
 * Populate `politics.tds` from the Oireachtas roster of the current Dáil.
 *
 *   npm run sync-tds
 *
 * Run this before the first scoring pass: the pipeline resolves TDs by name, so an
 * empty table means every article scores nobody. Safe to re-run — it upserts, and it
 * deactivates rather than deletes, so a TD who loses a seat keeps their record.
 */
import { getCurrentDailMembers } from '../services/oireachtasAPIService';
import { repository as repo } from '../scoring';
import { memberImageUrl, type TdSeed } from '../scoring/tdSync';
import { shutdown } from '../db';

async function main(): Promise<void> {
  const members = await getCurrentDailMembers();
  if (members.length === 0) {
    throw new Error('The Oireachtas API returned no members; refusing to change the roster.');
  }

  const seeds: TdSeed[] = members.map((m) => ({
    name: m.fullName.trim(),
    party: m.party,
    constituency: m.constituency,
    memberCode: m.memberCode,
    imageUrl: memberImageUrl(m.memberCode),
  }));

  const result = await repo.syncTds(seeds);
  console.log(
    `Roster: ${members.length} members. Inserted ${result.inserted}, updated ${result.updated}, deactivated ${result.deactivated}.`,
  );

  const missingParty = seeds.filter((s) => !s.party).length;
  const missingConstituency = seeds.filter((s) => !s.constituency).length;
  if (missingParty || missingConstituency) {
    console.warn(`Incomplete roster data: ${missingParty} without a party, ${missingConstituency} without a constituency.`);
  }
}

main()
  .then(() => shutdown())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await shutdown();
    process.exit(1);
  });
