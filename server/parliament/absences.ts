/**
 * Documented absences: leave a TD or their party announced publicly. The Oireachtas records
 * no reason for an absence, so each entry needs a public source, and nothing is inferred
 * from the record itself. `npm run parliament:silences` lists long silences to look into.
 *
 * To add one: append to DOCUMENTED_ABSENCES with the member code, the dates the source gives,
 * a reason from AbsenceReason, and the source URL. Keep medical detail out of the note.
 * absences.test.ts validates every entry.
 */
import { absenceReason, type AbsenceReason } from '@shared/schema/parliament';

export interface DocumentedAbsence {
  memberCode: string;
  from: string;
  /** NULL while the leave is ongoing. */
  to: string | null;
  reason: AbsenceReason;
  source: string;
  note: string | null;
}

export const DOCUMENTED_ABSENCES: DocumentedAbsence[] = [
  {
    memberCode: 'Holly-Cairns.D.2020-02-08',
    from: '2024-11-29',
    to: '2025-09-16',
    reason: 'parental_leave',
    source: 'https://www.irishexaminer.com/news/arid-41651087.html',
    note:
      'Maternity leave from the birth of her child on polling day, 29 Nov 2024. The source (13 Jun 2025) says she ' +
      'returns in September; the end date is the day before her first vote or speech that month (17 Sept 2025).',
  },
  {
    memberCode: 'Richard-Boyd-Barrett.D.2011-03-09',
    from: '2025-04-08',
    to: '2025-11-03',
    reason: 'medical_leave',
    source: 'https://www.pbp.ie/richard-boyd-barrett-3/',
    note:
      'Leave for medical treatment, announced 8 Apr 2025 to start that week. He returned to the Dáil on 4 Nov 2025: ' +
      'https://dublinpeople.com/news/southside/articles/2025/11/12/rbb-dail-return/',
  },
  {
    memberCode: "Patrick-O'Donovan.D.2011-03-09",
    from: '2026-07-07',
    to: '2026-08-30',
    reason: 'medical_leave',
    source: 'https://www.irishtimes.com/politics/2026/08/27/minister-for-communications-patrick-odonovan-to-return-to-duties-after-illness/',
    note: 'Became unwell on 7 Jul 2026 and returned to work on 31 Aug 2026.',
  },
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Check every entry. Throws naming the first bad one, so a typo fails the tests, not a score. */
export function validateAbsences(entries: DocumentedAbsence[]): DocumentedAbsence[] {
  const seen = new Set<string>();
  entries.forEach((e, i) => {
    const where = `absence ${i} (${e.memberCode || 'no member code'})`;
    if (!e.memberCode) throw new Error(`${where}: memberCode is required`);
    if (!ISO_DAY.test(e.from)) throw new Error(`${where}: from must be YYYY-MM-DD`);
    if (e.to !== null && !ISO_DAY.test(e.to)) throw new Error(`${where}: to must be YYYY-MM-DD or null`);
    if (e.to !== null && e.to < e.from) throw new Error(`${where}: to is before from`);
    if (!(absenceReason.enumValues as readonly string[]).includes(e.reason)) {
      throw new Error(`${where}: reason must be one of ${absenceReason.enumValues.join(', ')}`);
    }
    if (!/^https:\/\/\S+$/.test(e.source)) throw new Error(`${where}: source must be an https URL`);
    const key = `${e.memberCode}\u0000${e.from}`;
    if (seen.has(key)) throw new Error(`${where}: a second entry starting ${e.from}`);
    seen.add(key);
  });
  return entries;
}
