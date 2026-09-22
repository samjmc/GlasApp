/**
 * Parsers against real API samples (2025-06-25, trimmed): __fixtures__/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { countWords, isPresidingRole, parseDivision, parseTranscript, type RawDivision } from './parse';

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
