import { describe, expect, it } from 'vitest';
import type { DebateItemView, TdQuestionRecord } from '@shared/parliamentApi';
import { itemLabel, securedText } from './recordCopy';

const item = (over: Partial<DebateItemView>): DebateItemView => ({
  kind: 'specific_claim',
  claimType: null,
  quote: 'q',
  speaker: 'Ann Opp',
  to: null,
  crossesHouse: false,
  replyNoPoints: null,
  addressee: null,
  due: null,
  ...over,
});

describe('itemLabel', () => {
  it('names a claim by its type, when it has one', () => {
    expect(itemLabel(item({ claimType: 'named_source' }), 'speaker')).toBe('Claim · named source');
    expect(itemLabel(item({}), 'speaker')).toBe('Claim');
  });

  it('says when a concession or a reply scores nothing, from either side', () => {
    const concession = item({ kind: 'concession', to: 'Bob Min' });
    expect(itemLabel(concession, 'speaker')).toBe('Concession to Bob Min (same side)');
    expect(itemLabel({ ...concession, crossesHouse: true }, 'target')).toBe('Ann Opp conceded');
    expect(itemLabel({ ...concession, to: null }, 'target')).toBe('Ann Opp conceded (same side, no points)');
    const reply = item({ kind: 'response', to: 'Bob Min', replyNoPoints: 'conceded' });
    expect(itemLabel(reply, 'speaker')).toBe('Reply to Bob Min (scored as a concession)');
    expect(itemLabel({ ...reply, replyNoPoints: null }, 'target')).toBe('Ann Opp took up their point');
    expect(itemLabel({ ...reply, replyNoPoints: 'closing_speech', to: null }, 'speaker')).toBe('Reply to another speaker (closing speech, no points)');
  });

  it('gives a question its addressee and a promise its time, when said', () => {
    expect(itemLabel(item({ kind: 'question', addressee: 'the Minister' }), 'speaker')).toBe('Question to the Minister');
    expect(itemLabel(item({ kind: 'commitment', due: 'by June' }), 'speaker')).toBe('Promise · by June');
    expect(itemLabel(item({ kind: 'commitment' }), 'speaker')).toBe('Promise');
  });
});

describe('securedText', () => {
  const f = (over: Partial<TdQuestionRecord['formats'][number]>) =>
    ({ format: 'oral_pq', asked: 12, askedAcross: 12, securedExchanges: 3, points: 6, followUps: 1, perTen: 2.5, cohortP75: 3, cohortSize: 40, ...over }) as TdQuestionRecord['formats'][number];

  it('counts commitments secured, naming the questions asked across the House when they are fewer', () => {
    expect(securedText(f({}))).toBe('a specific commitment secured in 3');
    expect(securedText(f({ askedAcross: 10 }))).toBe('a specific commitment secured in 3 of the 10 asked across the House');
    expect(securedText(f({ askedAcross: 0, securedExchanges: 0 }))).toBe('all from the government side, where commitments are not counted');
  });
});
