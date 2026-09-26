/**
 * What TDs publicly declare and are paid, from the Oireachtas's own PDFs: the Register of
 * Members' Interests and the Parliamentary Standard Allowance payments. Stored per source
 * file, so a published file is read once.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { tdAllowancePayments, tdInterests } from '@shared/schema/parliament';
import type { TdAllowances, TdInterests } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { InterestsEntry } from '../sources/interests';
import type { PsaPayment } from '../sources/psa';
import { chunks } from './util';

/** Source files already stored, so the sync reads only new ones. */
export async function storedDisclosureSources(database: Db = db): Promise<Set<string>> {
  const [interests, payments] = await Promise.all([
    database.selectDistinct({ url: tdInterests.sourceUrl }).from(tdInterests),
    database.selectDistinct({ url: tdAllowancePayments.sourceUrl }).from(tdAllowancePayments),
  ]);
  return new Set([...interests, ...payments].map((r) => r.url));
}

/** Replace one year's register with `entries` (already matched to member codes). */
export async function replaceInterestsYear(
  year: number,
  sourceUrl: string,
  entries: Array<{ memberCode: string; entry: InterestsEntry }>,
  tdIds: Map<string, number>,
  database: Db = db,
): Promise<void> {
  const rows = entries.flatMap(({ memberCode, entry }) =>
    entry.categories.map((c) => ({ memberCode, tdId: tdIds.get(memberCode) ?? null, registerYear: year, category: c.number, declared: c.text, sourceUrl })),
  );
  await database.transaction(async (tx) => {
    await tx.delete(tdInterests).where(eq(tdInterests.registerYear, year));
    for (const batch of chunks(rows)) await tx.insert(tdInterests).values(batch);
  });
}

/** Replace a month's payments with those read from its (newest) file. */
export async function replaceAllowanceFile(
  sourceUrl: string,
  month: string,
  payments: Array<{ memberCode: string; payment: PsaPayment; position: number }>,
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

/** A TD's allowance payments by month. NULL before any file is stored. */
export async function tdAllowancesOf(tdId: number, database: Db = db): Promise<TdAllowances | null> {
  const published = (await database.selectDistinct({ month: sql<string>`${tdAllowancePayments.month}::text` }).from(tdAllowancePayments))
    .map((r) => r.month)
    .sort();
  if (published.length === 0) return null;
  const range = { from: published[0], to: published[published.length - 1] };
  // Months in the range with no file at all were not published (October 2025, as of
  // September 2026) — which is not the same as "not paid".
  const unpublishedMonths: string[] = [];
  for (let m = range.from; m < range.to; m = nextMonth(m)) if (!published.includes(m)) unpublishedMonths.push(m);
  const months = await database
    .select({ month: sql<string>`${tdAllowancePayments.month}::text`, amountCents: sql<number>`sum(${tdAllowancePayments.amountCents})::int` })
    .from(tdAllowancePayments)
    .where(eq(tdAllowancePayments.tdId, tdId))
    .groupBy(tdAllowancePayments.month)
    .orderBy(desc(tdAllowancePayments.month));
  return {
    from: range.from,
    to: range.to,
    unpublishedMonths,
    totalCents: months.reduce((n, m) => n + Number(m.amountCents), 0),
    months: months.map((m) => ({ month: m.month, amountCents: Number(m.amountCents) })),
  };
}

function nextMonth(first: string): string {
  const [y, m] = first.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
