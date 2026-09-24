/**
 * api.oireachtas.ie, typed. The only module that talks to the Oireachtas.
 *
 * Two API facts that the code before this rebuild got wrong, both measured:
 *   - Filter by member with `member_id=<full member uri>`. `member=` is silently ignored,
 *     so it returns the whole house and every TD looked identical.
 *   - Restrict to the Dáil with `chamber_type=house&chamber=dail`. `chamber=dail` alone
 *     still returns joint committees for debates.
 */
import type { RawDivision } from './parse';

const BASE_URL = 'https://api.oireachtas.ie/v1';
const MEMBER_URI_PREFIX = 'https://data.oireachtas.ie/ie/oireachtas/member/id/';
const TIMEOUT_MS = 60_000;
const RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** A 4xx: the request itself is wrong, so retrying cannot help. */
class ClientError extends Error {}
/** The current Dáil. Bump at the next general election. */
export const CURRENT_DAIL = 34;
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
}

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

  /** Questions the member ASKED (a minister answering is not counted), split by type. */
  async questionCounts(memberCode: string, from: string, to: string): Promise<{ oral: number; written: number }> {
    const count = async (qtype: 'oral' | 'written') => {
      const body = await this.get<{ head?: { counts?: { questionCount?: number } } }>('/questions', {
        member_id: memberUri(memberCode),
        qtype,
        date_start: from,
        date_end: to,
        limit: 1,
      });
      const n = body.head?.counts?.questionCount;
      if (typeof n !== 'number') throw new Error(`No question count for ${memberCode}`);
      return n;
    };
    return { oral: await count('oral'), written: await count('written') };
  }
}

export function memberUri(memberCode: string): string {
  return MEMBER_URI_PREFIX + memberCode;
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
    };
  }>;
}

interface RawDebateRecord {
  date?: string;
  formats?: { xml?: { uri?: string | null } | null };
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

  return {
    memberCode: member.memberCode,
    fullName: member.fullName.trim(),
    party,
    constituency: seat.represents?.[0]?.represent?.showAs ?? null,
    memberSince: seat.dateRange.start,
    isPresiding,
  };
}
