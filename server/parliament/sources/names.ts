/**
 * Match a name printed in an Oireachtas PDF ("MACLOCHLAINN, Pádraig", "Nash, Gerald") to a
 * roster member. The PDFs carry no member code, so this is by name, and it never guesses:
 *   1. exact: the full name, ignoring accents, case, spaces and honorifics;
 *   2. else by surname (whole trailing words) AND the first letter of the first name
 *      ("Gerald" for Ged, "Joseph" for Joe), if exactly one roster member has both — within
 *      the constituency when the file gives one. The initial stops "CONNOLLY, Catherine" (a
 *      former TD) from becoming the current John Connolly;
 *   3. else the same, allowing ONE changed letter in the surname when the first name is
 *      identical ("Newsome Drennen, Natasha" in the allowance files). Only a changed letter:
 *      an added or dropped one would let "Jim Ryan" become "Jim O'Ryan";
 *   4. else no match, which the caller reports.
 * A non-exact match is reported as such: the caller must not store it if another printed
 * name in the same file already leads to that member.
 *
 * Measured 2026-09-26 on the 2024 and 2025 registers and 22 months of allowance files:
 * every non-exact match was the right member (checked by hand).
 */
import { normaliseName } from '../parse';

export interface RosterName {
  memberCode: string;
  fullName: string;
  constituency: string | null;
}

export interface NameMatch {
  memberCode: string;
  exact: boolean;
}

const compact = (s: string) => normaliseName(s).replace(/\s+/g, '');
const place = (s: string | null) => (s ? compact(s) : null);

/** True when a and b have the same length and differ in at most one letter. */
function oneLetterApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
  return true;
}

export function makeNameMatcher(roster: RosterName[]) {
  const byFull = new Map<string, string | null>();
  const whereOf = new Map<string, string | null>();
  for (const m of roster) {
    const key = compact(m.fullName);
    byFull.set(key, byFull.has(key) && byFull.get(key) !== m.memberCode ? null : m.memberCode);
    whereOf.set(m.memberCode, place(m.constituency));
  }
  // A surname matches whole trailing words of the roster name, so "MACLOCHLAINN" finds
  // "Mac Lochlainn" but "Ryan" never finds "O'Ryan". Apostrophes join words here.
  const keyed = roster.map((m) => {
    const words = normaliseName(m.fullName.replace(/['’]/g, '')).split(' ');
    const tails = words.slice(1).map((_, i) => words.slice(i + 1).join(''));
    return { memberCode: m.memberCode, tails, first: words[0] ?? '', where: place(m.constituency) };
  });

  return (name: { surname: string; forenames: string; constituency?: string | null }): NameMatch | null => {
    const where = place(name.constituency ?? null);
    // Same name, different constituency (a register entry for another Michael Murphy) is not exact.
    const full = byFull.get(compact(`${name.forenames} ${name.surname}`));
    if (full && (where === null || whereOf.get(full) === where)) return { memberCode: full, exact: true };
    const surname = compact(name.surname.replace(/['’]/g, ''));
    const first = normaliseName(name.forenames).split(' ')[0] ?? '';
    if (!surname || !first) return null;
    const inPlace = keyed.filter((m) => where === null || m.where === where);
    const bySurname = inPlace.filter((m) => m.tails.includes(surname) && m.first.charAt(0) === first.charAt(0));
    if (bySurname.length === 1) return { memberCode: bySurname[0].memberCode, exact: false };
    if (bySurname.length > 1) return null;
    const byTypo = inPlace.filter((m) => m.first === first && m.tails.some((t) => oneLetterApart(t, surname)));
    return byTypo.length === 1 ? { memberCode: byTypo[0].memberCode, exact: false } : null;
  };
}
