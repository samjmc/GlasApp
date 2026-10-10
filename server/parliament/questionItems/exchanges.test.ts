import { describe, expect, it } from 'vitest';
import { splitExchanges, type SectionTurn } from './exchanges';

const GOV = 'gov';
/** [position, member ('CHAIR' for the chair, GOV for an office holder), words] */
const turns = (rows: Array<[number, string, number]>): SectionTurn[] =>
  rows.map(([position, who, words]) => ({ position, memberCode: who === 'CHAIR' ? null : who, isPresiding: who === 'CHAIR', inOffice: who === GOV, words }));
const spans = (xs: ReturnType<typeof splitExchanges>) => xs.map((x) => [x.askers.join('+'), x.fromPosition, x.toPosition]);

describe('splitExchanges: Leaders’ Questions', () => {
  // dail-2026-09-30-dbsect_9, as recorded: McDonald, Cian O'Callaghan, Boyd Barrett, then Gogarty.
  const day = turns([
    [0, 'McDonald', 561], [1, GOV, 618], [2, 'McDonald', 230], [3, GOV, 174], [4, 'CHAIR', 4], [5, 'McDonald', 4], [6, GOV, 2],
    [7, 'McDonald', 4], [8, GOV, 8], [9, 'McDonald', 7], [10, GOV, 26], [11, 'OCallaghan', 491], [12, GOV, 454], [13, 'OCallaghan', 211],
    [14, GOV, 165], [15, 'OCallaghan', 13], [16, GOV, 19], [17, 'OCallaghan', 6], [18, GOV, 45], [19, 'BoydBarrett', 422], [20, GOV, 562],
    [21, 'BoydBarrett', 255], [22, GOV, 183], [23, 'BoydBarrett', 6], [24, GOV, 84], [25, 'Gogarty', 499], [26, GOV, 400],
  ]);

  it('starts an exchange each time the Taoiseach answers a new leader', () => {
    const xs = splitExchanges({ sectionId: 'dail-2026-09-30-dbsect_9', format: 'leaders_questions', date: '2026-09-30', turns: day, pqAskers: [] });
    expect(spans(xs)).toEqual([
      ['McDonald', 0, 10],
      ['OCallaghan', 11, 18],
      ['BoydBarrett', 19, 24],
      ['Gogarty', 25, 26],
    ]);
    expect(xs.map((x) => x.id)).toEqual(['dail-2026-09-30-dbsect_9#1', 'dail-2026-09-30-dbsect_9#2', 'dail-2026-09-30-dbsect_9#3', 'dail-2026-09-30-dbsect_9#4']);
  });

  it('never starts one for a heckle: the member answered is the one who said most', () => {
    const xs = splitExchanges({
      sectionId: 's', format: 'leaders_questions', date: 'd', pqAskers: [],
      turns: turns([[0, 'McDonald', 500], [1, 'BoydBarrett', 5], [2, GOV, 600], [3, 'McDonald', 200], [4, 'Tóibín', 3], [5, GOV, 150]]),
    });
    expect(spans(xs)).toEqual([['McDonald', 0, 5]]);
  });

  it('takes any office holder answering, and a leader who returns later is a new exchange', () => {
    const xs = splitExchanges({
      sectionId: 's', format: 'leaders_questions', date: 'd', pqAskers: [],
      turns: turns([[0, GOV, 50], [1, 'A', 400], [2, GOV, 300], [3, 'B', 400], [4, GOV, 300], [5, 'A', 100], [6, GOV, 80]]),
    });
    // The opening office turn belongs to the first exchange.
    expect(spans(xs)).toEqual([['A', 0, 2], ['B', 3, 4], ['A', 5, 6]]);
  });

  it('keeps a short interjection that drew a reply inside the exchange it interrupted (2025-03-25)', () => {
    const xs = splitExchanges({
      sectionId: 's', format: 'leaders_questions', date: 'd', pqAskers: [],
      turns: turns([[0, 'McDonald', 365], [1, 'McDonald', 217], [2, GOV, 22], [3, 'ÓSnodaigh', 5], [4, GOV, 29], [5, 'BoydBarrett', 3], [6, GOV, 13], [7, 'Bacik', 420], [8, GOV, 380]]),
    });
    expect(spans(xs)).toEqual([['McDonald', 0, 6], ['Bacik', 7, 8]]);
  });

  it('keeps a last question nobody answered, and finds nothing in a section with no members', () => {
    const xs = splitExchanges({ sectionId: 's', format: 'rapid', date: 'd', pqAskers: [], turns: turns([[0, 'A', 80], [1, GOV, 60], [2, 'B', 70]]) });
    expect(spans(xs)).toEqual([['A', 0, 1], ['B', 2, 2]]);
    expect(splitExchanges({ sectionId: 's', format: 'rapid', date: 'd', pqAskers: [], turns: turns([[0, 'CHAIR', 9]]) })).toEqual([]);
  });
});

describe('splitExchanges: oral PQs and Topical Issues', () => {
  it('takes an oral PQ section whole, with the askers /questions gives, a supplementary question included', () => {
    const xs = splitExchanges({
      sectionId: 's', format: 'oral_pq', date: 'd', pqAskers: ['Murphy', 'Bacik', 'Murphy'],
      turns: turns([[0, 'Murphy', 57], [1, GOV, 419], [2, 'Bacik', 158], [3, GOV, 268], [4, 'Healy-Rae', 40], [5, GOV, 30]]),
    });
    expect(spans(xs)).toEqual([['Murphy+Bacik', 0, 5]]);
  });

  it('takes a Topical Issue whole, the asker being the member not in office', () => {
    const xs = splitExchanges({ sectionId: 's', format: 'topical_issue', date: 'd', pqAskers: [], turns: turns([[0, 'CHAIR', 5], [1, 'Ward', 300], [2, GOV, 400], [3, 'Ward', 120], [4, GOV, 90]]) });
    expect(spans(xs)).toEqual([['Ward', 1, 4]]);
  });
});
