/**
 * Pledge arithmetic. Pure: every number comes from the arguments.
 *
 * Deliberately small. A party's record is the count of its pledges in each reviewed
 * status, and a delivery rate over the pledges that have been resolved either way. The
 * old module blended that with per-party integrity, transparency and accuracy numbers
 * that were typed in by hand; nothing here is an opinion about a party.
 */
import {
  PLEDGE_STATUSES,
  type CategoryWeights,
  type PartyPledgeSummary,
  type PledgeCategory,
  type PledgeStatus,
} from '@shared/pledges';

/**
 * Weights from one ranking, most important first. A Borda count: with n categories the
 * first gets n points and the last 1, then points are normalised to sum to 1.
 */
export function weightsFromRanking(ranking: readonly PledgeCategory[]): CategoryWeights {
  const n = ranking.length;
  if (n === 0) return {};
  const total = (n * (n + 1)) / 2;
  const weights: CategoryWeights = {};
  ranking.forEach((category, index) => {
    weights[category] = (n - index) / total;
  });
  return weights;
}

/** Group stored rows into each user's ranking, ordered by rank. */
export function rankingsByUser(
  rows: ReadonlyArray<{ userId: string; category: PledgeCategory; rank: number }>,
): Map<string, PledgeCategory[]> {
  const byUser = new Map<string, Array<{ category: PledgeCategory; rank: number }>>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  // Array.from, not spread: the ES2017 target cannot iterate a Map directly.
  return new Map(
    Array.from(byUser.entries()).map(([userId, list]): [string, PledgeCategory[]] => [
      userId,
      list.sort((a, b) => a.rank - b.rank).map((r) => r.category),
    ]),
  );
}

/** Everyone's rankings combined: the mean of each user's weights, so every user counts once. */
export function communityWeights(rankings: ReadonlyArray<readonly PledgeCategory[]>): CategoryWeights {
  if (rankings.length === 0) return {};
  const sum: CategoryWeights = {};
  for (const ranking of rankings) {
    for (const [category, weight] of Object.entries(weightsFromRanking(ranking)) as Array<[PledgeCategory, number]>) {
      sum[category] = (sum[category] ?? 0) + weight;
    }
  }
  for (const category of Object.keys(sum) as PledgeCategory[]) sum[category] = sum[category]! / rankings.length;
  return sum;
}

const emptyCounts = (): Record<PledgeStatus, number> =>
  Object.fromEntries(PLEDGE_STATUSES.map((s) => [s, 0])) as Record<PledgeStatus, number>;

/**
 * One party's record. The weighted rate counts each resolved pledge by its category's
 * weight; categories nobody ranked weigh nothing, so it is null when no resolved pledge
 * falls in a ranked category.
 */
export function summariseParty(
  party: string,
  pledges: ReadonlyArray<{ status: PledgeStatus; category: PledgeCategory }>,
  weights: CategoryWeights | null,
): PartyPledgeSummary {
  const byStatus = emptyCounts();
  let delivered = 0;
  let resolved = 0;
  let weightedDelivered = 0;
  let weightedResolved = 0;

  for (const pledge of pledges) {
    byStatus[pledge.status] += 1;
    if (pledge.status !== 'delivered' && pledge.status !== 'broken') continue;
    const hit = pledge.status === 'delivered' ? 1 : 0;
    resolved += 1;
    delivered += hit;
    const weight = weights?.[pledge.category] ?? 0;
    weightedResolved += weight;
    weightedDelivered += weight * hit;
  }

  return {
    party,
    total: pledges.length,
    byStatus,
    deliveryRate: resolved > 0 ? delivered / resolved : null,
    weightedDeliveryRate: weights && weightedResolved > 0 ? weightedDelivered / weightedResolved : null,
  };
}
