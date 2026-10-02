/**
 * Leave watch: catches leave nobody has documented yet.
 *
 * The Oireachtas records no reason for an absence, so a long silence (sitting days with no vote
 * and no speech) is the only signal. Once a week this lists every such run that no documented
 * absence covers, with news that may explain it. It decides nothing: a person reads the source
 * and either CONFIRMS the leave (it becomes a td_absences row, with the source) or DISMISSES the
 * run. A dismissed run that doubles in length opens again, because that is how leave announced
 * late looks. Confirmed leave takes effect at the next daily sync, like any documented absence.
 *
 *   npm run parliament:leave-watch
 */
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { tdAbsences, tdLeaveAlerts, type LeaveHint } from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type { ConfirmLeaveInput, LeaveAlertState, LeaveAlertView } from '@shared/parliamentApi';
import { db, type Db } from '../db';
import { validateAbsences } from './absences';
import { undocumentedSilences } from './repo/fairness';

/** The same length `npm run parliament:silences` starts at: two sitting weeks. */
export const LEAVE_WATCH_MIN_DAYS = 8;
/** News from this long before a run starts is looked at too: leave is often announced first. */
const HINT_LOOKBACK_DAYS = 7;
const MAX_HINTS = 5;
/**
 * Words that point the reviewer to an article. This only narrows a list of links for a person
 * to read; it classifies nobody, and an article it misses just means the reviewer searches.
 */
const LEAVE_WORDS =
  'maternity|paternity|parental leave|medical leave|sick leave|leave of absence|illness|ill health|unwell|hospital|surgery|bereave|stepping back|step back';

export interface LeaveWatchSummary {
  opened: number;
  updated: number;
  reopened: number;
  closed: number;
  /** Open alerts after this run. */
  open: number;
}

export class LeaveAlertError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

const keyOf = (memberCode: string, startDate: string) => `${memberCode}\u0000${startDate}`;

async function hintsFor(tdId: number | undefined, from: string, database: Db): Promise<LeaveHint[]> {
  if (tdId === undefined) return [];
  const res = await database.execute(sql`
    select a.title, a.url, a.published_at
    from politics.article_tds x
    join politics.news_articles a on a.id = x.article_id
    where x.td_id = ${tdId}
      and a.status <> 'duplicate'
      and a.published_at >= (${from}::date - ${HINT_LOOKBACK_DAYS} * interval '1 day')
      and (a.title || ' ' || coalesce(a.summary, '')) ~* ${LEAVE_WORDS}
    order by a.published_at desc
    limit ${MAX_HINTS}`);
  return (res.rows as Array<{ title: string; url: string; published_at: Date | string }>).map((r) => ({
    title: r.title,
    url: r.url,
    publishedAt: new Date(r.published_at).toISOString(),
  }));
}

/** Record this week's silences. Idempotent: running it twice in a row changes nothing the second time. */
export async function runLeaveWatch(database: Db = db, minDays: number = LEAVE_WATCH_MIN_DAYS): Promise<LeaveWatchSummary> {
  const runs = await undocumentedSilences(minDays, database);
  const tdIds = new Map(
    (await database.select({ id: tds.id, code: tds.memberCode }).from(tds).where(isNotNull(tds.memberCode))).map((t) => [t.code as string, t.id]),
  );
  const existing = new Map((await database.select().from(tdLeaveAlerts)).map((a) => [keyOf(a.memberCode, a.startDate), a]));
  const now = new Date();
  const summary: LeaveWatchSummary = { opened: 0, updated: 0, reopened: 0, closed: 0, open: 0 };

  const planned = await Promise.all(
    runs.map(async (run) => ({ run, hints: await hintsFor(tdIds.get(run.memberCode), run.from, database) })),
  );
  const seen = new Set(runs.map((r) => keyOf(r.memberCode, r.from)));

  await database.transaction(async (tx) => {
    for (const { run, hints } of planned) {
      const prior = existing.get(keyOf(run.memberCode, run.from));
      const latest = { endDate: run.to, sittingDays: run.sittingDays, lastSeenAt: now };
      if (!prior) {
        await tx.insert(tdLeaveAlerts).values({ memberCode: run.memberCode, tdId: tdIds.get(run.memberCode) ?? null, startDate: run.from, hints, ...latest });
        summary.opened++;
        summary.open++;
        continue;
      }
      if (prior.status === 'confirmed') continue;
      if (prior.status === 'dismissed') {
        const grew = run.sittingDays >= 2 * (prior.daysWhenResolved ?? run.sittingDays);
        if (!grew) {
          await tx.update(tdLeaveAlerts).set(latest).where(eq(tdLeaveAlerts.id, prior.id));
          continue;
        }
      }
      // Open, closed earlier, or a dismissed run that has doubled: it needs a person again.
      const wasOpen = prior.status === 'open';
      await tx
        .update(tdLeaveAlerts)
        .set({ ...latest, hints, status: 'open', resolvedAt: null, resolvedBy: null, resolutionNote: null, daysWhenResolved: null })
        .where(eq(tdLeaveAlerts.id, prior.id));
      if (wasOpen) summary.updated++;
      else summary.reopened++;
      summary.open++;
    }
    for (const [key, alert] of Array.from(existing)) {
      if (alert.status !== 'open' || seen.has(key)) continue;
      await tx
        .update(tdLeaveAlerts)
        .set({ status: 'closed', resolvedAt: now, resolvedBy: 'watch', resolutionNote: 'The TD voted or spoke again, or documented leave now covers the run.' })
        .where(eq(tdLeaveAlerts.id, alert.id));
      summary.closed++;
    }
  });
  return summary;
}

/** Alerts for the admin page, longest silence first. `open` (default) hides the resolved ones. */
export async function listLeaveAlerts(scope: 'open' | 'all' = 'open', database: Db = db): Promise<LeaveAlertView[]> {
  const rows = await database
    .select({ alert: tdLeaveAlerts, name: tds.name, party: tds.party })
    .from(tdLeaveAlerts)
    .leftJoin(tds, eq(tds.memberCode, tdLeaveAlerts.memberCode))
    .where(scope === 'open' ? eq(tdLeaveAlerts.status, 'open') : undefined)
    .orderBy(sql`(${tdLeaveAlerts.status} = 'open') desc`, desc(tdLeaveAlerts.sittingDays))
    .limit(200);
  return rows.map(({ alert: a, name, party }) => ({
    id: a.id,
    memberCode: a.memberCode,
    tdId: a.tdId,
    name: name ?? a.memberCode,
    party: party ?? null,
    from: a.startDate,
    to: a.endDate,
    sittingDays: a.sittingDays,
    status: a.status as LeaveAlertState,
    hints: a.hints,
    firstSeenAt: a.firstSeenAt.toISOString(),
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
    resolvedBy: a.resolvedBy,
    resolutionNote: a.resolutionNote,
  }));
}

/**
 * Record the leave the reviewer found a public source for. The source is required and checked
 * like every entry in absences.ts; the leave must overlap the silent days it is confirming.
 */
export async function confirmLeave(id: number, input: ConfirmLeaveInput, actor: string, database: Db = db): Promise<void> {
  await database.transaction(async (tx) => {
    const [alert] = await tx.select().from(tdLeaveAlerts).where(eq(tdLeaveAlerts.id, id)).for('update');
    if (!alert) throw new LeaveAlertError(404, `Alert ${id} not found`);
    if (alert.status !== 'open') throw new LeaveAlertError(409, `Alert ${id} is already ${alert.status}`);

    const entry = { memberCode: alert.memberCode, from: input.from, to: input.to, reason: input.reason, source: input.sourceUrl, note: input.note };
    try {
      validateAbsences([entry]);
    } catch (error) {
      throw new LeaveAlertError(400, error instanceof Error ? error.message : 'Invalid leave');
    }
    if (entry.from > alert.endDate || (entry.to !== null && entry.to < alert.startDate)) {
      throw new LeaveAlertError(400, `The leave must cover some of the silent days (${alert.startDate} to ${alert.endDate})`);
    }
    const [clash] = await tx
      .select({ from: tdAbsences.startDate })
      .from(tdAbsences)
      .where(and(eq(tdAbsences.memberCode, alert.memberCode), eq(tdAbsences.startDate, entry.from)));
    if (clash) throw new LeaveAlertError(409, `A leave starting ${entry.from} is already recorded for this TD`);

    await tx.insert(tdAbsences).values({
      memberCode: alert.memberCode,
      tdId: alert.tdId,
      startDate: entry.from,
      endDate: entry.to,
      reason: entry.reason,
      sourceUrl: entry.source,
      note: entry.note,
      origin: 'admin',
    });
    await tx
      .update(tdLeaveAlerts)
      .set({ status: 'confirmed', resolvedAt: new Date(), resolvedBy: actor, resolutionNote: entry.note, daysWhenResolved: alert.sittingDays })
      .where(eq(tdLeaveAlerts.id, id));
  });
}

/** The reviewer looked and found no public reason. The run opens again if it doubles. */
export async function dismissLeave(id: number, note: string | null, actor: string, database: Db = db): Promise<void> {
  const updated = await database
    .update(tdLeaveAlerts)
    .set({ status: 'dismissed', resolvedAt: new Date(), resolvedBy: actor, resolutionNote: note, daysWhenResolved: sql`${tdLeaveAlerts.sittingDays}` })
    .where(and(eq(tdLeaveAlerts.id, id), eq(tdLeaveAlerts.status, 'open')))
    .returning({ id: tdLeaveAlerts.id });
  if (updated.length > 0) return;
  const [exists] = await database.select({ status: tdLeaveAlerts.status }).from(tdLeaveAlerts).where(eq(tdLeaveAlerts.id, id));
  if (!exists) throw new LeaveAlertError(404, `Alert ${id} not found`);
  throw new LeaveAlertError(409, `Alert ${id} is already ${exists.status}`);
}
