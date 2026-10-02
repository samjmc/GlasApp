/**
 * Party leaders who sat in the current Dáil, with dates and a public source. The Oireachtas
 * records no party leadership, and Wikidata's is incomplete (no Social Democrats or
 * Independent Ireland leader, stale Labour leaders, few dates; measured 2026-09-26), so the
 * list is kept here and reviewed in git.
 *
 * A party leader's time counts as a leadership role, like government office: those divisions
 * are measured against LEADERSHIP_ATTENDANCE_BENCHMARK. Every party is treated alike.
 * To record a change of leader: end the old entry the day before, add the new one, with its
 * source. partyLeaders.test.ts validates every entry.
 */
export interface PartyLeader {
  memberCode: string;
  party: string;
  from: string;
  /** NULL while still leader. */
  to: string | null;
  source: string;
}

/**
 * `from` is the later of the day they became leader and the Dáil's first day (29 Nov 2024):
 * only divisions in this Dáil are counted, so an earlier start changes nothing. Checked
 * 2026-09-26. Not listed: the 100% Redress Party, whose leader no source names.
 */
const DAIL_START = '2024-11-29';

export const PARTY_LEADERS: PartyLeader[] = [
  {
    memberCode: 'Micheál-Martin.D.1989-06-29',
    party: 'Fianna Fáil',
    from: DAIL_START,
    to: null,
    source: 'https://www.irishtimes.com/politics/2026/04/16/fianna-fail-tds-rally-behind-micheal-martin-as-prospect-of-leadership-heave-fades/',
  },
  {
    memberCode: 'Simon-Harris.D.2011-03-09',
    party: 'Fine Gael',
    from: DAIL_START,
    to: null,
    source: 'https://www.irishtimes.com/politics/2024/03/25/simon-harris-rules-out-early-election-after-taking-over-as-fine-gael-leader/',
  },
  {
    memberCode: 'Mary-Lou-McDonald.D.2011-03-09',
    party: 'Sinn Féin',
    from: DAIL_START,
    to: null,
    source: 'https://www.irishtimes.com/politics/2026/04/05/biggest-barrier-to-united-ireland-is-the-government-says-sinn-feins-mary-lou-mcdonald/',
  },
  {
    memberCode: 'Ivana-Bacik.S.2007-07-23',
    party: 'Labour Party',
    from: DAIL_START,
    to: null,
    source: 'https://labour.ie/news/2026/05/29/speech-by-labour-leader-ivana-bacik-td-black-and-irish-professional-network-of-ireland-conference/',
  },
  // Holly Cairns leads the Social Democrats; Cian O'Callaghan was acting leader during her
  // maternity leave (she is on documented leave to 16 Sept 2025, see absences.ts).
  {
    memberCode: "Cian-O'Callaghan.D.2020-02-08",
    party: 'Social Democrats',
    from: DAIL_START,
    to: '2025-09-16',
    source: 'https://dublinpeople.com/news/northsideeast/articles/2026/06/04/cairns-ocallaghan-acting-leader/',
  },
  {
    memberCode: 'Holly-Cairns.D.2020-02-08',
    party: 'Social Democrats',
    from: '2025-09-17',
    to: null,
    source: 'https://www.rte.ie/news/politics/2025/0917/1534006-holly-cairns-return/',
  },
  // People Before Profit–Solidarity has collective leadership; Richard Boyd Barrett is its
  // parliamentary leader, who takes the leader's part in the Dáil (leaders' questions).
  {
    memberCode: 'Richard-Boyd-Barrett.D.2011-03-09',
    party: 'People Before Profit–Solidarity',
    from: DAIL_START,
    to: null,
    source: 'https://dublinpeople.com/news/southside/articles/2024/10/14/rbb-pbp-leader/',
  },
  {
    memberCode: 'Peadar-Tóibín.D.2011-03-09',
    party: 'Aontú',
    from: DAIL_START,
    to: null,
    source: 'https://www.rte.ie/news/politics/2026/0307/1562074-aontu-ard-fheis/',
  },
  {
    memberCode: 'Michael-Collins.D.2016-10-03',
    party: 'Independent Ireland',
    from: DAIL_START,
    to: null,
    source: 'https://www.independentireland.ie/michaelcollins',
  },
  {
    memberCode: "Roderic-O'Gorman.D.2020-02-08",
    party: 'Green Party',
    from: DAIL_START,
    to: null,
    source: 'https://www.irishtimes.com/politics/2025/05/01/roderic-ogorman-re-elected-as-green-party-leader/',
  },
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Check every entry. Throws naming the first bad one. */
export function validatePartyLeaders(entries: PartyLeader[]): PartyLeader[] {
  const seen = new Set<string>();
  entries.forEach((e, i) => {
    const where = `party leader ${i} (${e.memberCode || 'no member code'})`;
    if (!e.memberCode) throw new Error(`${where}: memberCode is required`);
    if (!e.party.trim()) throw new Error(`${where}: party is required`);
    if (!ISO_DAY.test(e.from)) throw new Error(`${where}: from must be YYYY-MM-DD`);
    if (e.to !== null && !ISO_DAY.test(e.to)) throw new Error(`${where}: to must be YYYY-MM-DD or null`);
    if (e.to !== null && e.to < e.from) throw new Error(`${where}: to is before from`);
    if (!/^https:\/\/\S+$/.test(e.source)) throw new Error(`${where}: source must be an https URL`);
    const key = `${e.memberCode}\u0000${e.from}`;
    if (seen.has(key)) throw new Error(`${where}: a second entry starting ${e.from}`);
    seen.add(key);
  });
  // One party has one leader at a time.
  const byParty = new Map<string, PartyLeader[]>();
  for (const e of entries) byParty.set(e.party, [...(byParty.get(e.party) ?? []), e]);
  byParty.forEach((list, party) => {
    const sorted = list.slice().sort((a, b) => (a.from < b.from ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      if (prev.to === null || prev.to >= sorted[i].from) throw new Error(`${party}: two leaders overlap (${prev.memberCode}, ${sorted[i].memberCode})`);
    }
  });
  return entries;
}
