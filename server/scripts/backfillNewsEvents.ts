/**
 * One-off: link same-event articles stored before ingest matched events.
 *
 *   npx tsx server/scripts/backfillNewsEvents.ts --dry-run    print the pairs, change nothing
 *   npx tsx server/scripts/backfillNewsEvents.ts              link them
 *
 * Only rows still `pending` or `skipped` and never linked to any TD are linked, oldest first,
 * over the pipeline window: a row linked to a TD stays visible. Every other
 * visible article in that window (plus the event window before it) is a candidate canonical.
 */
import { shutdown } from '../db';
import { EVENT_CANDIDATE_LIMIT, EVENT_WINDOW_HOURS, assignCanonicals, matchEvents } from '../news/events';
import * as repo from '../news/repository';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const now = new Date();
  const rows = await repo.linkableRows(new Date(now.getTime() - repo.MAX_SCORING_AGE_DAYS * 86_400_000));
  const rowIds = new Set(rows.map((r) => r.id));
  const stored = (await repo.eventCandidates(now, repo.MAX_SCORING_AGE_DAYS * 24 + EVENT_WINDOW_HOURS, EVENT_CANDIDATE_LIMIT)).filter(
    (c) => !rowIds.has(c.id),
  );

  const { links, failedCalls } = await matchEvents(
    rows.map((r, index) => ({ index, title: r.title, summary: r.summary })),
    stored,
  );
  if (failedCalls > 0) throw new Error(`${failedCalls} event-match call(s) failed; nothing was linked`);

  const titles = new Map(stored.map((c) => [c.id, c.title]));
  rows.forEach((r) => titles.set(r.id, r.title));
  let linked = 0;
  const canonicalOf = assignCanonicals(rows, links);
  for (let i = 0; i < rows.length; i++) {
    const of = canonicalOf[i];
    if (of === null) continue;
    const root = 'stored' in of ? of.stored : rows[of.run].id;
    console.log(`#${rows[i].id} "${rows[i].title}"  ->  #${root} "${titles.get(root)}"`);
    if (!dryRun && (await repo.linkDuplicate(rows[i].id, root))) linked++;
  }
  console.log(dryRun ? `Dry run: ${rows.length} rows checked, nothing changed.` : `Linked ${linked} of ${rows.length} rows checked.`);
}

main()
  .then(() => shutdown())
  .catch(async (error) => {
    console.error(error);
    await shutdown();
    process.exit(1);
  });
