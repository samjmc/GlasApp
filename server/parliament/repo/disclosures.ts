/**
 * What TDs publicly declare and are paid, from the Oireachtas's own PDFs: the Register of
 * Members' Interests and the Parliamentary Standard Allowance payments. Every file read is
 * recorded in disclosure_files, so a published file is read once.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { disclosureFiles, tdAllowancePayments, tdInterests, tdParliamentStats } from '@shared/schema/parliament';
import type { TdAllowances, TdInterests } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { InterestsEntry } from '../sources/interests';
import type { PsaPayment } from '../sources/psa';
import { chunks } from './util';

type Kind = 'interests' | 'allowances';

/** Source files already read, so the sync reads only new ones. */
export async function storedDisclosureSources(database: Db = db): Promise<Set<string>> {
  const rows = await database.select({ url: disclosureFiles.sourceUrl }).from(disclosureFiles);
  return new Set(rows.map((r) => r.url));
}

/** Within a transaction: this file is now the one read for its period. */
async function recordFile(tx: Pick<Db, 'delete' | 'insert'>, kind: Kind, period: string, sourceUrl: string, unmatched: string[]): Promise<void> {
  await tx.delete(disclosureFiles).where(and(eq(disclosureFiles.kind, kind), eq(disclosureFiles.period, period)));
  await tx.insert(disclosureFiles).values({ sourceUrl, kind, period, unmatched });
}

/** Replace one year's register with `entries` (already matched to member codes). */
export async function replaceInterestsYear(
  year: number,
  sourceUrl: string,
  entries: Array<{ memberCode: string; entry: InterestsEntry }>,
  unmatched: string[],
  tdIds: Map<string, number>,
  database: Db = db,
): Promise<void> {
  const rows = entries.flatMap(({ memberCode, entry }) =>
    entry.categories.map((c) => ({ memberCode, tdId: tdIds.get(memberCode) ?? null, registerYear: year, category: c.number, declared: c.text, sourceUrl })),
  );
  await database.transaction(async (tx) => {
    await tx.delete(tdInterests).where(eq(tdInterests.registerYear, year));
    for (const batch of chunks(rows)) await tx.insert(tdInterests).values(batch);
    await recordFile(tx, 'interests', `${year}-01-01`, sourceUrl, unmatched);
  });
}

/** Replace a month's payments with those read from its (newest) file. */
export async function replaceAllowanceFile(
  sourceUrl: string,
  month: string,
  payments: Array<{ memberCode: string; payment: PsaPayment; position: number }>,
  unmatched: string[],
  tdIds: Map<string, number>,
  database: Db = db,
): Promise<void> {
  const rows = payments.map(({ memberCode, payment: p, position }) => ({
    sourceUrl,
    position,
    memberCode,
    tdId: tdIds.get(memberCode) ?? null,
    month,
    title: p.title,
    taaBand: p.taaBand,
    narrative: p.narrative,
    datePaid: p.datePaid,
    amountCents: p.amountCents,
  }));
  await database.transaction(async (tx) => {
    // By month, not by file: a re-published month replaces the earlier file's rows.
    await tx.delete(tdAllowancePayments).where(eq(tdAllowancePayments.month, month));
    for (const batch of chunks(rows)) await tx.insert(tdAllowancePayments).values(batch);
    await recordFile(tx, 'allowances', month, sourceUrl, unmatched);
  });
}

/** A TD's declarations in the newest register that lists them. NULL when none does. */
export async function tdInterestsOf(tdId: number, database: Db = db): Promise<TdInterests | null> {
  const [latest] = await database
    .select({ year: tdInterests.registerYear, sourceUrl: tdInterests.sourceUrl })
    .from(tdInterests)
    .where(eq(tdInterests.tdId, tdId))
    .orderBy(desc(tdInterests.registerYear))
    .limit(1);
  if (!latest) return null;
  const rows = await database
    .select({ category: tdInterests.category, declared: tdInterests.declared })
    .from(tdInterests)
    .where(and(eq(tdInterests.tdId, tdId), eq(tdInterests.registerYear, latest.year)))
    .orderBy(tdInterests.category);
  return { year: latest.year, sourceUrl: latest.sourceUrl, categories: rows.map((r) => ({ number: r.category, declared: r.declared })) };
}

/** A TD's allowance payments by month. NULL before any file is read. */
export async function tdAllowancesOf(tdId: number, database: Db = db): Promise<TdAllowances | null> {
  const files = (
    await database
      .select({ month: sql<string>`${disclosureFiles.period}::text`, unmatched: disclosureFiles.unmatched })
      .from(disclosureFiles)
      .where(eq(disclosureFiles.kind, 'allowances'))
  ).sort((a, b) => (a.month < b.month ? -1 : 1));
  if (files.length === 0) return null;
  const range = { from: files[0].month, to: files[files.length - 1].month };
  const published = new Set(files.map((f) => f.month));
  // Months in the range with no file at all were not published (October 2025, as of
  // September 2026) — which is not the same as "not paid".
  const unpublishedMonths: string[] = [];
  for (let m = range.from; m < range.to; m = nextMonth(m)) if (!published.has(m)) unpublishedMonths.push(m);

  const months = await database
    .select({ month: sql<string>`${tdAllowancePayments.month}::text`, amountCents: sql<number>`sum(${tdAllowancePayments.amountCents})::int` })
    .from(tdAllowancePayments)
    .where(eq(tdAllowancePayments.tdId, tdId))
    .groupBy(tdAllowancePayments.month)
    .orderBy(desc(tdAllowancePayments.month));
  const paid = new Set(months.map((m) => m.month));

  // A published month with no row for this TD is "not paid" only if its file matched every
  // name; if it had an unmatched name, that name could be this TD.
  const [stats] = await database.select({ since: tdParliamentStats.memberSince }).from(tdParliamentStats).where(eq(tdParliamentStats.tdId, tdId));
  const sinceMonth = stats ? `${stats.since.slice(0, 7)}-01` : range.from;
  const uncertainMonths = files.filter((f) => f.month >= sinceMonth && !paid.has(f.month) && f.unmatched.length > 0).map((f) => f.month);

  return {
    from: range.from,
    to: range.to,
    unpublishedMonths,
    uncertainMonths,
    totalCents: months.reduce((n, m) => n + Number(m.amountCents), 0),
    months: months.map((m) => ({ month: m.month, amountCents: Number(m.amountCents) })),
  };
}

function nextMonth(first: string): string {
  const [y, m] = first.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
