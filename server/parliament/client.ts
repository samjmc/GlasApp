/**
 * api.oireachtas.ie, typed. The only module that talks to the Oireachtas.
 *
 * Two API facts that the code before this rebuild got wrong, both measured:
 *   - Filter by member with `member_id=<full member uri>`. `member=` is silently ignored,
 *     so it returns the whole house and every TD looked identical.
 *   - Restrict to the Dáil with `chamber_type=house&chamber=dail`. `chamber=dail` alone
 *     still returns joint committees for debates.
 */
import { isoDay, type RawBill, type RawDivision, type RawQuestion } from './parse';
import { addDays } from './window';

const BASE_URL = 'https://api.oireachtas.ie/v1';
const TIMEOUT_MS = 60_000;
const RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** A 4xx: the request itself is wrong, so retrying cannot help. */
class ClientError extends Error {}
/** The current Dáil. Bump at the next general election. */
export const CURRENT_DAIL = 34;
/** Path segment of this Dáil's committee URIs (joint committees included). */
const DAIL_COMMITTEE_PATH = `/committee/dail/${CURRENT_DAIL}/`;
/** Offices whose holder chairs the house and does not vote. */
export const PRESIDING_OFFICES = ['Ceann Comhairle'] as const;

export type Fetcher = (url: string) => Promise<Response>;

export interface RosterMember {
  memberCode: string;
  fullName: string;
  party: string | null;
  constituency: string | null;
  /** Start of this member's seat in the current Dáil, YYYY-MM-DD. */
  memberSince: string;
  /** Holds a presiding office now (does not vote). */
  isPresiding: boolean;
  /** Offices held now (Taoiseach, Minister for …, Minister of State …), with start dates. */
  offices: Array<{ title: string; since: string | null }>;
  /** Committee memberships in the current Dáil, past and present, with their dates. */
  committees: RosterCommittee[];
}

export interface RosterCommittee {
  uri: string;
  name: string;
  committeeType: string | null;
  role: string | null;
  start: string;
  end: string | null;
}

/** A committee sitting from the `/debates?chamber_type=committee` listing. */
export interface CommitteeSittingListing {
  uri: string;
  date: string;
  committeeUri: string;
  committeeName: string;
  xmlUri: string | null;
}

/** The API refuses `skip` beyond this, and caps its counts at it. */
export const API_MAX_RESULTS = 10_000;

export class OireachtasClient {
  constructor(
    private readonly fetcher: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
    private readonly retryDelayMs = RETRY_DELAY_MS,
  ) {}

  /** GET with retries on network errors and 5xx. A 4xx will not improve, so it throws at once. */
  private async request(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const res = await this.fetcher(url);
        if (res.ok) return res;
        if (res.status < 500) throw new ClientError(`Oireachtas ${res.status} for ${url}`);
        lastError = new Error(`Oireachtas ${res.status} for ${url}`);
      } catch (error) {
        if (error instanceof ClientError) throw error;
        lastError = error;
      }
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt));
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    return (await (await this.request(`${BASE_URL}${path}?${qs}`)).json()) as T;
  }

  /** Every member of the current Dáil whose seat has not ended. */
  async roster(): Promise<RosterMember[]> {
    const body = await this.get<{ results?: Array<{ member: RawMember }> }>('/members', {
      chamber: 'dail',
      house_no: CURRENT_DAIL,
      limit: 500,
    });
    return (body.results ?? []).map((r) => toRosterMember(r.member)).filter((m): m is RosterMember => m !== null);
  }

  /** Every Dáil division held from `from` to `to` inclusive (YYYY-MM-DD). */
  async divisions(from: string, to: string): Promise<RawDivision[]> {
    const out: RawDivision[] = [];
    const limit = 1000;
    for (let skip = 0; ; skip += limit) {
      const body = await this.get<{ results?: Array<{ division: RawDivision }> }>('/divisions', {
        chamber_type: 'house',
        chamber: 'dail',
        date_start: from,
        date_end: to,
        limit,
        skip,
      });
      const page = (body.results ?? []).map((r) => r.division);
      out.push(...page);
      if (page.length < limit) return out;
    }
  }

  /**
   * The Dáil sitting days in a range, each with its Akoma Ntoso transcript URL. A day can
   * be listed before its transcript is published; its `xmlUri` is then NULL.
   */
  async debateDays(from: string, to: string): Promise<Array<{ date: string; xmlUri: string | null }>> {
    const days: Array<{ date: string; xmlUri: string | null }> = [];
    const limit = 1000;
    for (let skip = 0; ; skip += limit) {
      const body = await this.get<{ results?: Array<{ debateRecord?: RawDebateRecord }> }>('/debates', {
        chamber_type: 'house',
        chamber: 'dail',
        date_start: from,
        date_end: to,
        limit,
        skip,
      });
      const page = body.results ?? [];
      for (const r of page) {
        const date = r.debateRecord?.date;
        if (date) days.push({ date, xmlUri: r.debateRecord?.formats?.xml?.uri ?? null });
      }
      if (page.length < limit) return days;
    }
  }

  /** The transcript for one sitting day, as XML text. */
  async transcript(xmlUri: string): Promise<string> {
    return (await this.request(xmlUri)).text();
  }

  /**
   * Every parliamentary question put from `from` to `to`, without answers. The API will not
   * page past 10,000 results, so a window that big is split in two until each half fits.
   */
  async questions(from: string, to: string): Promise<RawQuestion[]> {
    const head = await this.get<{ head?: { counts?: { questionCount?: number } } }>('/questions', {
      date_start: from,
      date_end: to,
      limit: 1,
    });
    const total = head.head?.counts?.questionCount;
    if (typeof total !== 'number') throw new Error(`No question count for ${from}..${to}`);
    if (total >= API_MAX_RESULTS) {
      if (from === to) throw new Error(`${API_MAX_RESULTS}+ questions on ${from}; the API cannot page them`);
      const mid = midpoint(from, to);
      return [...(await this.questions(from, mid)), ...(await this.questions(addDays(mid, 1), to))];
    }
    const out: RawQuestion[] = [];
    const limit = 1000;
    for (let skip = 0; ; skip += limit) {
      const body = await this.get<{ results?: Array<{ question: RawQuestion }> }>('/questions', {
        date_start: from,
        date_end: to,
        limit,
        skip,
      });
      const page = (body.results ?? []).map((r) => r.question);
      out.push(...page);
      if (page.length < limit) break;
    }
    // A short read would store a month with too few questions and call it complete.
    if (out.length < total) throw new Error(`Read ${out.length} of ${total} questions for ${from}..${to}`);
    return out;
  }

  /** Every bill with activity since `from`: the whole current term in one or two pages. */
  async bills(from: string): Promise<RawBill[]> {
    const out: RawBill[] = [];
    const limit = 1000;
    for (let skip = 0; ; skip += limit) {
      const body = await this.get<{ results?: Array<{ bill: RawBill }> }>('/legislation', { date_start: from, limit, skip });
      const page = (body.results ?? []).map((r) => r.bill);
      out.push(...page);
      if (page.length < limit) return out;
    }
  }

  /** Dáil and joint committee sittings in a range, each with its transcript URL when published. */
  async committeeSittings(from: string, to: string): Promise<CommitteeSittingListing[]> {
    const out: CommitteeSittingListing[] = [];
    const limit = 1000;
    for (let skip = 0; ; skip += limit) {
      const body = await this.get<{ results?: Array<{ debateRecord?: RawCommitteeRecord }> }>('/debates', {
        chamber_type: 'committee',
        date_start: from,
        date_end: to,
        limit,
        skip,
      });
      const page = body.results ?? [];
      for (const r of page) {
        const d = r.debateRecord;
        // Seanad-only committees have no TD members; skip them.
        if (!d?.uri || !d.date || !d.house?.uri || d.house.houseCode !== 'dail') continue;
        out.push({
          uri: d.uri,
          date: d.date,
          committeeUri: d.house.uri,
          committeeName: d.house.showAs ?? d.chamber?.showAs ?? 'Committee',
          xmlUri: d.formats?.xml?.uri ?? null,
        });
      }
      if (page.length < limit) return out;
    }
  }
}

/** The day halfway between two YYYY-MM-DD dates (rounded down). */
function midpoint(from: string, to: string): string {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return new Date(a + Math.floor((b - a) / 86_400_000 / 2) * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Raw shapes (only the fields read here)
// ---------------------------------------------------------------------------
interface DateRange {
  start?: string | null;
  end?: string | null;
}

export interface RawMember {
  memberCode?: string;
  fullName?: string;
  memberships?: Array<{
    membership: {
      house?: { houseCode?: string; houseNo?: string };
      dateRange?: DateRange;
      parties?: Array<{ party?: { showAs?: string; dateRange?: DateRange } }>;
      represents?: Array<{ represent?: { showAs?: string } }>;
      offices?: Array<{ office?: { officeName?: { showAs?: string }; dateRange?: DateRange } }>;
      committees?: Array<{
        uri?: string;
        committeeName?: Array<{ nameEn?: string }>;
        committeeType?: string[];
        role?: { title?: string; dateRange?: DateRange } | null;
        memberDateRange?: DateRange;
      }>;
    };
  }>;
}

interface RawDebateRecord {
  date?: string;
  formats?: { xml?: { uri?: string | null } | null };
}

interface RawCommitteeRecord extends RawDebateRecord {
  uri?: string;
  house?: { uri?: string; showAs?: string; houseCode?: string } | null;
  chamber?: { showAs?: string } | null;
}

/** Pure: one API member → a roster entry, or null when they hold no current Dáil seat. */
export function toRosterMember(member: RawMember): RosterMember | null {
  const seat = member.memberships
    ?.map((m) => m.membership)
    .find((m) => m.house?.houseCode === 'dail' && m.house?.houseNo === String(CURRENT_DAIL) && !m.dateRange?.end);
  if (!seat || !member.memberCode || !member.fullName || !seat.dateRange?.start) return null;

  // A member who changed party has several entries; the open-ended one is current.
  const parties = seat.parties ?? [];
  const party = (parties.find((p) => !p.party?.dateRange?.end) ?? parties[parties.length - 1])?.party?.showAs ?? null;

  const isPresiding = (seat.offices ?? []).some(
    (o) => !o.office?.dateRange?.end && (PRESIDING_OFFICES as readonly string[]).includes(o.office?.officeName?.showAs ?? ''),
  );

  const offices = (seat.offices ?? [])
    .filter((o) => o.office?.officeName?.showAs && !o.office.dateRange?.end)
    .map((o) => ({ title: o.office!.officeName!.showAs!, since: isoDay(o.office!.dateRange?.start) }));

  // The seat lists committees of earlier terms and of the Seanad too (measured: 12 of 696),
  // and memberships that ended before this seat began (14). Only this Dáil's committees,
  // held during this seat, say anything about this TD's attendance.
  const seatStart = isoDay(seat.dateRange.start) ?? seat.dateRange.start;
  const committees = (seat.committees ?? []).flatMap((c) => {
    const start = isoDay(c.memberDateRange?.start);
    const end = isoDay(c.memberDateRange?.end);
    const name = c.committeeName?.[0]?.nameEn;
    if (!c.uri || !start || !name || !c.uri.includes(DAIL_COMMITTEE_PATH)) return [];
    if (end !== null && end <= seatStart) return [];
    return [{
      uri: c.uri,
      name,
      committeeType: c.committeeType?.[0] ?? null,
      // A role (chair, vice-chair) can end while the membership goes on.
      role: (!c.role?.dateRange?.end && c.role?.title) || null,
      start,
      end,
    }];
  });

  return {
    memberCode: member.memberCode,
    fullName: member.fullName.trim(),
    party,
    constituency: seat.represents?.[0]?.represent?.showAs ?? null,
    memberSince: seat.dateRange.start,
    isPresiding,
    offices,
    committees,
  };
}
