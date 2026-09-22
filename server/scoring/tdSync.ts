/**
 * Deciding what a roster of current Dáil members means for the `tds` table.
 * Pure: the repository applies the plan this returns.
 *
 * A TD is never deleted. Their scores, history and article verdicts cascade from
 * `tds.id`, so removing a row when someone leaves the Dáil would erase the record
 * of everything they did. They are deactivated instead.
 */

/** One current member, as the Oireachtas roster describes them. */
export interface TdSeed {
  name: string;
  party: string | null;
  constituency: string | null;
  /** Stable Oireachtas identifier, e.g. "Mary-Lou-McDonald.D.2011-03-09". */
  memberCode: string;
  imageUrl: string | null;
}

/** The subset of an existing row the plan needs. */
export interface ExistingTd {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  memberCode: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface TdSyncPlan {
  insert: TdSeed[];
  update: Array<{ id: number; seed: TdSeed }>;
  /** Ids of active TDs the roster no longer lists. */
  deactivate: number[];
}

const key = (name: string) => name.trim().toLowerCase();

function differs(existing: ExistingTd, seed: TdSeed): boolean {
  return (
    existing.name !== seed.name ||
    existing.party !== seed.party ||
    existing.constituency !== seed.constituency ||
    existing.memberCode !== seed.memberCode ||
    existing.imageUrl !== seed.imageUrl ||
    !existing.isActive
  );
}

/**
 * Match each seed to an existing TD, preferring the member code and falling back to
 * the name. Both are unique in the table, so a seed that would collide with a
 * *different* TD on the other key is reported as an update to that TD rather than an
 * insert that the database would reject.
 *
 * An empty roster returns an empty plan: a failed API call must never deactivate
 * the whole Dáil.
 */
export function planTdSync(existing: ExistingTd[], seeds: TdSeed[]): TdSyncPlan {
  const plan: TdSyncPlan = { insert: [], update: [], deactivate: [] };
  if (seeds.length === 0) return plan;

  const byCode = new Map<string, ExistingTd>();
  const byName = new Map<string, ExistingTd>();
  for (const td of existing) {
    if (td.memberCode) byCode.set(td.memberCode, td);
    byName.set(key(td.name), td);
  }

  const matched = new Set<number>();
  const seenCodes = new Set<string>();

  for (const seed of seeds) {
    // A roster that lists the same person twice must not produce two rows.
    if (seenCodes.has(seed.memberCode)) continue;
    seenCodes.add(seed.memberCode);

    const current = byCode.get(seed.memberCode) ?? byName.get(key(seed.name));
    if (!current) {
      plan.insert.push(seed);
      continue;
    }
    matched.add(current.id);
    if (differs(current, seed)) plan.update.push({ id: current.id, seed });
  }

  for (const td of existing) {
    if (td.isActive && !matched.has(td.id)) plan.deactivate.push(td.id);
  }

  return plan;
}

/** The Oireachtas serves a portrait per member code at a fixed path. */
export function memberImageUrl(memberCode: string): string {
  return `https://www.oireachtas.ie/en/members/member/${encodeURIComponent(memberCode)}/image/`;
}
