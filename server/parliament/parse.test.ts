/**
 * Parsers against real API samples (2025-06-25, trimmed): __fixtures__/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  countQuestions,
  countWords,
  isoDay,
  isPresidingRole,
  normaliseName,
  parseBill,
  parseDivision,
  parseRollCall,
  parseTranscript,
  resolveRollCallNames,
  uriTail,
  type RawBill,
  type RawDivision,
  type RawQuestion,
} from './parse';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const [rawDivision] = JSON.parse(fixture('divisions-2025-06-25.json')) as RawDivision[];

describe('parseDivision', () => {
  const parsed = parseDivision(rawDivision)!;

  it('builds a stable id and links the debate section', () => {
    expect(parsed.division.id).toBe('dail-34-2025-06-25-vote_91');
    expect(parsed.division.debateSectionId).toBe('dail-2025-06-25-dbsect_19');
    expect(parsed.division.subject).toBe('Amendment put');
    expect(parsed.division.outcome).toBe('Lost');
  });

  it('keeps every member and agrees with the official tally', () => {
    expect(parsed.division.taCount).toBe(64);
    expect(parsed.division.nilCount).toBe(82);
    expect(parsed.division.staonCount).toBe(0);
    expect(parsed.votes.filter((v) => v.vote === 'ta')).toHaveLength(64);
    expect(parsed.votes.filter((v) => v.vote === 'nil')).toHaveLength(82);
    expect(new Set(parsed.votes.map((v) => v.memberCode)).size).toBe(146);
  });

  it('keeps non-ASCII member codes intact', () => {
    expect(parsed.votes.map((v) => v.memberCode)).toContain('Seán-Crowe.D.2002-06-06');
  });

  it('never counts one member twice, even if the record lists them in two lobbies', () => {
    const dup = structuredClone(rawDivision);
    dup.tallies!.nilVotes!.members!.push(dup.tallies!.taVotes!.members![0]);
    const votes = parseDivision(dup)!.votes;
    expect(votes).toHaveLength(146);
  });

  it('stores a placeholder outcome as NULL, never as a result', () => {
    expect(parseDivision({ ...rawDivision, outcome: '_' })!.division.outcome).toBeNull();
    expect(parseDivision({ ...rawDivision, outcome: '  ' })!.division.outcome).toBeNull();
    expect(parseDivision({ ...rawDivision, outcome: 'Carried' })!.division.outcome).toBe('Carried');
  });

  it('rejects records it cannot identify, and Seanad divisions', () => {
    expect(parseDivision({ ...rawDivision, voteId: undefined })).toBeNull();
    expect(parseDivision({ ...rawDivision, house: { houseCode: 'seanad', houseNo: '27' } })).toBeNull();
  });
});

describe('parseTranscript', () => {
  const t = parseTranscript(fixture('transcript-2025-06-25.xml'), '2025-06-25');

  it('extracts the sections that have speeches, with their titles', () => {
    expect(t.sections.map((s) => s.id)).toEqual(['dail-2025-06-25-dbsect_2', 'dail-2025-06-25-dbsect_19']);
    expect(t.sections[1].title).toBe('Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages');
    expect(t.sections[1].speechCount).toBe(32);
  });

  it('attributes every speech to a member code, in order, with unique ids', () => {
    expect(t.speeches).toHaveLength(33);
    expect(t.speeches.every((s) => s.memberCode)).toBe(true);
    expect(new Set(t.speeches.map((s) => s.id)).size).toBe(33);
    expect(t.speeches[0]).toMatchObject({ id: 'dail-2025-06-25-dbsect_2/spk_1', memberCode: 'Aidan-Farrelly.D.2024-11-29', position: 0 });
    const sect19 = t.speeches.filter((s) => s.sectionId === 'dail-2025-06-25-dbsect_19');
    expect(sect19.map((s) => s.position)).toEqual(sect19.map((_, i) => i));
  });

  it('flags speeches from the chair and keeps ministers as ordinary speakers', () => {
    const chair = t.speeches.filter((s) => s.isPresiding);
    expect(chair.map((s) => [s.role, s.memberCode])).toEqual([
      ['An Cathaoirleach Gníomhach', 'Aidan-Farrelly.D.2024-11-29'],
      ['An Ceann Comhairle', 'Verona-Murphy.D.2020-02-08'],
      ['An Ceann Comhairle', 'Verona-Murphy.D.2020-02-08'],
      ['An Ceann Comhairle', 'Verona-Murphy.D.2020-02-08'],
    ]);
    expect(t.speeches.some((s) => s.role === 'Minister for Finance' && !s.isPresiding)).toBe(true);
  });

  it('counts words and never stores an empty speech', () => {
    expect(t.speeches.every((s) => s.text.length > 0 && s.wordCount > 0)).toBe(true);
    expect(t.speeches[0].wordCount).toBe(countWords(t.speeches[0].text));
  });

  it('resolves non-ASCII hrefs and survives a stray percent sign', () => {
    const xml = `<akomaNtoso><debate><meta><references>
      <TLCPerson eId="AOS" href="/ie/oireachtas/member/id/Aengus-Ó-Snodaigh.D.2002-06-06" showAs="Aengus Ó Snodaigh"/>
      <TLCPerson eId="BAD" href="/ie/oireachtas/member/id/Odd%ZZ.D.2020-01-01" showAs="Odd"/>
      </references></meta><debateBody><debateSection eId="dbsect_1"><heading>Test</heading>
      <speech by="#AOS" eId="spk_1"><p>Go raibh maith agat.</p></speech>
      <speech by="#BAD" eId="spk_2"><p>Hello.</p></speech>
      <speech by="#NOBODY" eId="spk_3"><p>Interjection.</p></speech>
      <speech by="#AOS" eId="spk_4"><p>  </p></speech>
      </debateSection></debateBody></debate></akomaNtoso>`;
    const out = parseTranscript(xml, '2025-01-01');
    expect(out.speeches.map((s) => s.memberCode)).toEqual(['Aengus-Ó-Snodaigh.D.2002-06-06', 'Odd%ZZ.D.2020-01-01', null]);
    expect(out.sections[0].speechCount).toBe(3);
  });
});

describe('chair speeches without an `as` role', () => {
  // Measured on the live 34th Dáil: the Ceann Comhairle's speeches carry no `as` at all,
  // only "An Ceann Comhairle" in <from>. Missing this let her top the participation table.
  it('reads the chair from the <from> label, ignoring the timestamp and a (Deputy …) suffix', () => {
    const xml = `<akomaNtoso><debate><meta><references>
      <TLCPerson eId="VM" href="/ie/oireachtas/member/id/Verona-Murphy.D.2020-02-08" showAs="Verona Murphy"/>
      <TLCPerson eId="JM" href="/ie/oireachtas/member/id/John-McGuinness.D.1997-06-26" showAs="John McGuinness"/>
      </references></meta><debateBody><debateSection eId="dbsect_1"><heading>Test</heading>
      <speech by="#VM" eId="spk_1"><from>An Ceann Comhairle<recordedTime time="2025-06-25T09:00:00+01:00"/></from><p>Order.</p></speech>
      <speech by="#JM" eId="spk_2"><from>An Leas-Cheann Comhairle (Deputy John McGuinness)</from><p>Order.</p></speech>
      <speech by="#JM" eId="spk_3"><from>Acting Chairman</from><p>Order.</p></speech>
      <speech by="#JM" eId="spk_4"><from>Deputy John McGuinness</from><p>As a TD, I say this.</p></speech>
      </debateSection></debateBody></debate></akomaNtoso>`;
    const out = parseTranscript(xml, '2025-06-25');
    expect(out.speeches.map((s) => [s.role, s.isPresiding])).toEqual([
      ['An Ceann Comhairle', true],
      ['An Leas-Cheann Comhairle', true],
      ['Acting Chairman', true],
      [null, false],
    ]);
  });
});

describe('parseBill', () => {
  const [gov, pmb, lapsed] = (JSON.parse(fixture('bills-sample.json')) as RawBill[]).map((b) => parseBill(b)!);

  it('reads an enacted Government bill: office as sponsor, act number, newest PDF and the memo', () => {
    expect(gov.bill).toMatchObject({
      id: '2025-32',
      source: 'Government',
      status: 'Enacted',
      act: '6/2025',
      mostRecentStage: 'Enacted',
      originHouse: 'Dáil Éireann',
      lastUpdated: '2025-07-09',
      latestVersionPdf: 'https://data.oireachtas.ie/ie/oireachtas/act/2025/6/eng/enacted/a0625.pdf',
      memoPdf: 'https://data.oireachtas.ie/ie/oireachtas/bill/2025/32/eng/memo/b3225d-memo.pdf',
    });
    expect(gov.sponsors).toEqual([{ billId: '2025-32', position: 0, memberCode: null, label: 'Minister for Finance', isPrimary: true }]);
    expect(gov.stages).toHaveLength(10);
    expect(gov.stages[0]).toEqual({ billId: '2025-32', position: 0, stage: 'First Stage', chamber: 'Dáil Éireann', date: '2025-06-12' });
  });

  it("keys each debate like the divisions table, so a bill joins to its Dáil votes", () => {
    expect(gov.debates.map((d) => d.debateSectionId)).toEqual([
      'seanad-2025-07-01-dbsect_14',
      'seanad-2025-06-26-dbsect_11',
      'dail-2025-06-25-dbsect_19', // the section holding division vote_91 in divisions-2025-06-25.json
      'dail-2025-06-18-dbsect_13',
      'dail-2025-06-17-dbsect_17',
    ]);
    expect(parseDivision(rawDivision)!.division.debateSectionId).toBe('dail-2025-06-25-dbsect_19');
  });

  it('keys a committee-stage debate by its committee, so it never joins to a Dáil vote', () => {
    const [rawGov] = JSON.parse(fixture('bills-sample.json')) as RawBill[];
    const committee = 'select_committee_on_finance_public_expenditure_public_service_reform_and_digitalisation_and_taoiseach';
    const withCommittee = {
      ...rawGov,
      debates: [
        ...(rawGov.debates ?? []),
        {
          chamber: { showAs: 'Select Committee on Finance, Public Expenditure, Public Service Reform and Digitalisation, and Taoiseach', uri: `https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/${committee}` },
          date: '2025-06-25',
          // Same section id and date as the Dáil debate holding vote_91: only the house tells them apart.
          debateSectionId: 'dbsect_19',
          showAs: 'Committee Stage',
          uri: `https://data.oireachtas.ie/akn/ie/debateRecord/${committee}/2025-06-25/debate/main`,
        },
      ],
    } as RawBill;
    const keys = parseBill(withCommittee)!.debates.map((d) => d.debateSectionId);
    expect(keys).toContain(`committee-${committee}-2025-06-25-dbsect_19`);
    expect(keys.filter((k) => k === 'dail-2025-06-25-dbsect_19')).toHaveLength(1);
  });

  it('reads a Private Member bill with many sponsors, one primary', () => {
    expect(pmb.bill).toMatchObject({ id: '2026-86', source: 'Private Member', status: 'Current', act: null });
    expect(pmb.sponsors).toHaveLength(74);
    expect(pmb.sponsors.filter((s) => s.isPrimary).map((s) => s.label)).toEqual(['Barry Ward']);
    expect(pmb.sponsors[0].memberCode).toBe('Barry-Ward.S.2020-03-30');
  });

  it('decodes HTML in long titles and tolerates a bill with no memo or debates', () => {
    expect(lapsed.bill.longTitle).not.toMatch(/&nbsp;|<p>/);
    expect(lapsed.bill.longTitle?.endsWith('related matters.')).toBe(true);
    expect(lapsed.bill.memoPdf).toBeNull();
    expect(lapsed.debates).toEqual([]);
  });

  it('rejects a bill it cannot identify', () => {
    expect(parseBill({ uri: 'x', billYear: '2025', shortTitleEn: 'X' })).toBeNull();
  });
});

const roll = parseRollCall(fixture('committee-transcript.xml'));

describe('parseRollCall', () => {
  it('lists each linked member on the roll call once, by member code', () => {
    expect(roll.codes).toHaveLength(10);
    expect(roll.codes.slice(0, 3)).toEqual(['Grace-Boland.D.2024-11-29', 'Eoghan-Kenny.D.2024-11-29', 'Joanna-Byrne.D.2024-11-29']);
    expect(roll.codes).toContain('Séamus-McGrath.D.2024-11-29');
    expect(new Set(roll.codes).size).toBe(roll.codes.length);
  });

  it('returns the names it could not link', () => {
    // The real transcript has no TLCPerson for this member: 1 of the 11 on its roll call.
    expect(roll.unlinkedNames).toEqual(['Deputy Aidan Farrelly']);
  });

  it('is empty, not an error, for a transcript with no roll call', () => {
    expect(parseRollCall('<akomaNtoso><debate><debateBody/></debate></akomaNtoso>')).toEqual({ codes: [], unlinkedNames: [] });
  });
});

describe('resolveRollCallNames', () => {
  const roster = [
    { fullName: 'John Brady', memberCode: 'John-Brady.D.2016-10-03' },
    { fullName: 'Seán Ó Fearghaíl', memberCode: 'Seán-Ó-Fearghaíl.D.1997-06-26' },
    { fullName: 'Michael Healy-Rae', memberCode: 'Michael-Healy-Rae.D.2011-03-09' },
    { fullName: 'Aidan Farrelly', memberCode: 'Aidan-Farrelly.D.2024-11-29' },
    { fullName: 'Pat Murphy', memberCode: 'Pat-Murphy.D.a' },
    { fullName: 'Pat Murphy', memberCode: 'Pat-Murphy.D.b' },
  ];

  it('matches a name by its letters: honorifics, accents, case, the chair line and punctuation ignored', () => {
    const r = resolveRollCallNames(
      ['DEPUTY JOHN BRADY IN THE CHAIR.', 'Deputy Sean O Fearghail', 'Deputy Michael Healy-Rae.'],
      roster,
    );
    expect(r).toEqual({ codes: ['John-Brady.D.2016-10-03', 'Seán-Ó-Fearghaíl.D.1997-06-26', 'Michael-Healy-Rae.D.2011-03-09'], unresolvedTds: 0 });
    // 10 linked + 1 matched by name = the 11 people on the fixture's roll call.
    const byName = resolveRollCallNames(roll.unlinkedNames, roster);
    expect(byName).toEqual({ codes: ['Aidan-Farrelly.D.2024-11-29'], unresolvedTds: 0 });
    expect(new Set([...roll.codes, ...byName.codes]).size).toBe(11);
  });

  it('leaves a name shared by two members unresolved, and counts it as a possible TD', () => {
    expect(resolveRollCallNames(['Deputy Pat Murphy'], roster)).toEqual({ codes: [], unresolvedTds: 1 });
  });

  it('does not count an unmatched Senator: they cannot be one of the TDs', () => {
    expect(resolveRollCallNames(['Senator Mary Seery Kearney', 'Deputy Nobody Here'], roster)).toEqual({ codes: [], unresolvedTds: 1 });
  });
});

describe('normaliseName', () => {
  it('strips honorifics, including "Minister of State", and anything in brackets', () => {
    expect(normaliseName('Minister of State Deputy Kieran O’Donnell')).toBe('kieran o donnell');
    expect(normaliseName('Deputy Mary Butler (Minister of State at the Department of Health)')).toBe('mary butler');
  });
});

describe('countQuestions', () => {
  const { results } = JSON.parse(fixture('questions-page.json')) as { results: Array<{ question: RawQuestion }> };

  it('groups real questions by asker, month, department and type, losing none', () => {
    const rows = countQuestions(results.map((r) => r.question));
    expect(rows.reduce((n, r) => n + r.n, 0)).toBe(25);
    expect(rows).toContainEqual({ memberCode: 'Ivana-Bacik.S.2007-07-23', month: '2025-06-01', department: 'Taoiseach', questionType: 'oral', n: 2 });
  });

  it('keeps oral and written apart and skips questions missing a field', () => {
    const rows = countQuestions([
      { date: '2026-01-31', questionType: 'written', by: { memberCode: 'A' }, to: { showAs: 'Health' } },
      { date: '2026-01-02', questionType: 'written', by: { memberCode: 'A' }, to: { showAs: 'Health' } },
      { date: '2026-01-02', questionType: 'oral', by: { memberCode: 'A' }, to: { showAs: 'Health' } },
      { date: '2026-02-01', questionType: 'written', by: { memberCode: 'A' }, to: { showAs: 'Health' } },
      { date: '2026-01-02', questionType: 'priority', by: { memberCode: 'A' }, to: { showAs: 'Health' } },
      { date: '2026-01-02', questionType: 'oral', by: {}, to: { showAs: 'Health' } },
    ]);
    expect(rows).toEqual(
      expect.arrayContaining([
        { memberCode: 'A', month: '2026-01-01', department: 'Health', questionType: 'written', n: 2 },
        { memberCode: 'A', month: '2026-01-01', department: 'Health', questionType: 'oral', n: 1 },
        { memberCode: 'A', month: '2026-02-01', department: 'Health', questionType: 'written', n: 1 },
      ]),
    );
    expect(rows).toHaveLength(3);
  });
});

describe('isoDay and uriTail', () => {
  it('take the date part and the last path segment', () => {
    expect(isoDay('2025-05-07 00:00:00+00:00')).toBe('2025-05-07');
    expect(isoDay('2025-07-09T09:23:49.950000+00:00')).toBe('2025-07-09');
    expect(isoDay('not a date')).toBeNull();
    expect(isoDay(null)).toBeNull();
    expect(uriTail('https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/committee_of_public_accounts/')).toBe('committee_of_public_accounts');
  });
});

describe('isPresidingRole', () => {
  it('matches the chair roles with or without the article, and nothing else', () => {
    expect(isPresidingRole('An Ceann Comhairle')).toBe(true);
    expect(isPresidingRole('An Leas-Cheann Comhairle')).toBe(true);
    expect(isPresidingRole('An Cathaoirleach Gníomhach')).toBe(true);
    expect(isPresidingRole('Ceann Comhairle')).toBe(true);
    expect(isPresidingRole('Minister for Finance')).toBe(false);
    expect(isPresidingRole(null)).toBe(false);
  });
});
