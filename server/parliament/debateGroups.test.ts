/**
 * Grouping sections into debates, from headings as the Official Report prints them (every
 * title below is copied from the stored record).
 */
import { describe, expect, it } from 'vitest';
import { groupDebates, isResumed, kindOf, moverOf, normaliseTitle, type GroupedDebate, type MoverContext, type SectionInput } from './debateGroups';

const section = (id: string, date: string, title: string, parentId: string | null = null, parentTitle: string | null = null): SectionInput => ({
  id: `dail-${date}-${id}`,
  date,
  title,
  parentId: parentId ? `dail-${date}-${parentId}` : null,
  parentTitle,
});

describe('normaliseTitle', () => {
  it('drops the resumed marker in English and Irish, wherever it sits', () => {
    expect(normaliseTitle('Energy Policy: Motion (Resumed) [Private Members]')).toBe('Energy Policy: Motion [Private Members]');
    expect(normaliseTitle('Ceisteanna ar Sonraíodh Uain Dóibh (Atógáil) - Priority Questions (Resumed)')).toBe(
      'Ceisteanna ar Sonraíodh Uain Dóibh - Priority Questions',
    );
    expect(isResumed('Disability (Amendment) Bill 2026: Second Stage (Resumed)')).toBe(true);
    expect(isResumed('Disability (Amendment) Bill 2026: Second Stage')).toBe(false);
  });

  it('straightens quotes and dashes, so one heading always compares equal', () => {
    expect(normaliseTitle('Ceisteanna ó na Comhaltaí Eile – Other Members’ Questions')).toBe("Ceisteanna ó na Comhaltaí Eile - Other Members' Questions");
  });
});

describe('kindOf', () => {
  it.each([
    ["Ceisteanna ó Cheannairí - Leaders' Questions", 'leaders_questions'],
    ['Ceisteanna ar Sonraíodh Uain Dóibh - Priority Questions', 'questions'],
    ['Ceisteanna Eile - Other Questions', 'questions'],
    ['Ceisteanna ar Pholasaí nó ar Reachtaíocht - Questions on Policy or Legislation', 'questions'],
    ["Ceisteanna ó na Comhaltaí Eile - Other Members' Questions", 'questions'],
    ['Saincheisteanna Tráthúla - Topical Issue Debate', 'topical_issue'],
    ['Ábhair Shaincheisteanna Tráthúla - Topical Issue Matters', 'procedural'],
    ['An tOrd Gnó - Order of Business', 'procedural'],
    ['Gnó na Dála - Business of Dáil', 'procedural'],
    ['Teachtaireacht ón Seanad - Message from Seanad', 'procedural'],
    ['Message from Select Committee', 'procedural'],
    ['Estimates for Public Services 2026', 'procedural'],
    ['Revised Estimates for Public Services 2026 - Message from Select Committee', 'procedural'],
    ['Visit of Chinese Delegation', 'procedural'],
    ['Taoiseach a Ainmniú - Nomination of Taoiseach', 'motion'],
    ['Energy Policy: Motion [Private Members]', 'motion'],
    ['Ministerial Rota for Parliamentary Questions: Motion', 'motion'],
    ['Financial Resolutions: Motions', 'motion'],
    ['Middle East: Statements', 'statements'],
    ['Disability (Amendment) Bill 2026: Second Stage', 'bill_stage'],
    ['Waste Management (Single Household Waste Collection Service) Bill 2026: Second Stage [Private Members]', 'bill_stage'],
    ['Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages', 'bill_stage'],
    ['Housing (Miscellaneous Provisions) Bill 2025: Report and Final Stages', 'bill_stage'],
    ['Courts Bill 2025: From the Seanad', 'bill_stage'],
    ['Non-Binary and Intersex Recognition Bill 2026: First Stage', 'procedural'],
    ['Disability (Amendment) Bill 2026: Referral to Select Committee [Private Members]', 'procedural'],
    ['Environment (Miscellaneous Provisions) Bill 2025: Instruction to Committee', 'procedural'],
    // Found on the first full-term run, 2026-10-04.
    ['Seachtain na Gaeilge: Ráitis', 'statements'],
    ['Ministers and Secretaries (Attorney General) Bill 2023: An Dara Céim [Comhaltaí Príobháideacha]', 'bill_stage'],
    ['Údarás na Gaeltachta (Amendment) Bill 2024: Céim an Choiste', 'bill_stage'],
    ['Meastacháin i gcomhair Seirbhísí Poiblí 2025: Teachtaireacht ó Roghchoiste', 'procedural'],
    ['Finance Bill 2025: Financial Resolutions', 'procedural'],
    ['Financial Resolutions 2025', 'motion'],
    ['Financial Resolution No. 1: Mineral Oil Tax', 'motion'],
    ['Supplementary Estimates for Public Services 2025: Leave to Introduce', 'procedural'],
    ['Committee on Standing Orders and Dáil Reform: Appointment of Members', 'procedural'],
    ['Health (Regulation of Termination of Pregnancy) (Amendment) Bill 2023: Restoration to Order Paper', 'procedural'],
    ['Address by H.E. Volodymyr Zelenskyy, President of Ukraine', 'procedural'],
    ['Adjournment of Dáil', 'procedural'],
    ["Minute's Silence in Memory of Garda Kevin Flatley", 'procedural'],
    ['Financial Resolution No.1: Mineral Oil Tax', 'motion'],
    // Budget 2027 (2026-10-07): no full stop after "No", and a dash instead of a colon.
    ['Financial Resolution No 6: Excise (Natural Gas Carbon Tax)', 'motion'],
    ['Financial Resolution No 7: Excise (Solid Fuel Carbon Tax)', 'motion'],
    ['Financial Resolution No. 4: Excise - Tobacco Products Tax', 'motion'],
    ['Financial Resolution No. 5 - Excise - Mineral Oil Tax', 'motion'],
    ['Financial Resolution No. 8 - General', 'motion'],
    ['Budget Statement 2026', 'statements'],
    ['Appointment of Taoiseach and Nomination of Members of Government', 'motion'],
    ['Tithíocht Gaeltachta: Tairiscint [Comhaltaí Príóbháideacha]', 'motion'],
    ['Industrial Development (Amendment) and Miscellaneous Provisions Bill 2026: Report Stage and Final Stage', 'bill_stage'],
    ['Údarás na Gaeltachta (Amendment) Bill 2024: An Tuarascáil agus an Chéim Dheiridh', 'bill_stage'],
    ['Flood Insurance Bill 2021: Order for Committee Stage [Private Members]', 'procedural'],
    ['Galway West By-election: Issue of Writ', 'procedural'],
    ['Message from the Standing Business Committee of Dáil Éireann', 'procedural'],
    ['Ainmniú Iarrthóirí agus Ceann Comhairle a thoghadh - Selection of Candidate and Election of Ceann Comhairle', 'procedural'],
    ['Ainmniú Iarrthóirí agus Leas-Cheann Comhairle a thoghadh - Selection of Candidate and Election of Leas-Cheann Comhairle', 'procedural'],
    ['Toghadh Uachtaráin - Election of President', 'procedural'],
    ['Personal Explanation by Member', 'procedural'],
    ['Visit of Albanian Delegation: Something New', 'other'],
    ['Untitled', 'other'],
  ] as const)('%s → %s', (title, kind) => {
    expect(kindOf(normaliseTitle(title))).toBe(kind);
  });
});

describe('groupDebates', () => {
  it('joins "(Resumed)" sections on later days to the debate they continue', () => {
    const out = groupDebates(
      [
        section('dbsect_20', '2026-09-16', 'Neutrality and Triple Lock: Motion [Private Members]'),
        section('dbsect_31', '2026-09-23', 'Neutrality and Triple Lock: Motion (Resumed) [Private Members]'),
      ],
      [],
    );
    expect(out).toEqual([
      {
        id: 'dail-2026-09-16-dbsect_20',
        kind: 'motion',
        title: 'Neutrality and Triple Lock: Motion [Private Members]',
        billId: null,
        firstDate: '2026-09-16',
        lastDate: '2026-09-23',
        sectionIds: ['dail-2026-09-16-dbsect_20', 'dail-2026-09-23-dbsect_31'],
      },
    ]);
  });

  it('starts a new debate when a heading recurs on another day without "(Resumed)"', () => {
    const out = groupDebates(
      [
        section('dbsect_5', '2026-01-14', 'Ministerial Rota for Parliamentary Questions: Motion'),
        section('dbsect_6', '2026-04-15', 'Ministerial Rota for Parliamentary Questions: Motion'),
      ],
      [],
    );
    expect(out.map((d) => d.id)).toEqual(['dail-2026-01-14-dbsect_5', 'dail-2026-04-15-dbsect_6']);
  });

  it('keeps a "(Resumed)" section whose start is not in the record as its own debate', () => {
    const out = groupDebates([section('dbsect_3', '2024-12-18', 'Programme for Government: Statements (Resumed)')], []);
    expect(out).toMatchObject([{ id: 'dail-2024-12-18-dbsect_3', kind: 'statements', sectionIds: ['dail-2024-12-18-dbsect_3'] }]);
  });

  it('puts question exchanges in the container they sit in, even when the container is not stored', () => {
    const pq = 'Ceisteanna ar Sonraíodh Uain Dóibh - Priority Questions';
    const out = groupDebates(
      [
        section('dbsect_10', '2026-09-24', 'Social Welfare Payments', 'dbsect_8', pq),
        section('dbsect_11', '2026-09-24', 'Social Welfare Code', 'dbsect_8', pq),
        section('dbsect_26', '2026-09-24', 'Rail Accidents', 'dbsect_25', 'Ceisteanna Eile - Other Questions'),
      ],
      [],
    );
    expect(out).toEqual([
      expect.objectContaining({ id: 'dail-2026-09-24-dbsect_8', kind: 'questions', title: pq, sectionIds: ['dail-2026-09-24-dbsect_10', 'dail-2026-09-24-dbsect_11'] }),
      expect.objectContaining({ id: 'dail-2026-09-24-dbsect_25', kind: 'questions', sectionIds: ['dail-2026-09-24-dbsect_26'] }),
    ]);
  });

  it('puts a nested section in its stored parent\'s debate, including a parent that was resumed', () => {
    const out = groupDebates(
      [
        section('dbsect_4', '2026-03-03', 'Courts Bill 2025: Committee Stage'),
        section('dbsect_9', '2026-03-05', 'Courts Bill 2025: Committee Stage (Resumed)'),
        section('dbsect_10', '2026-03-05', 'Section 3', 'dbsect_9', 'Courts Bill 2025: Committee Stage (Resumed)'),
      ],
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0].sectionIds).toEqual(['dail-2026-03-03-dbsect_4', 'dail-2026-03-05-dbsect_9', 'dail-2026-03-05-dbsect_10']);
  });

  it('joins sections with the same heading on the same day, and orders by record position, not text', () => {
    const out = groupDebates(
      [
        section('dbsect_12', '2026-05-06', 'Message from Select Committee'),
        section('dbsect_9', '2026-05-06', 'Message from Select Committee'),
      ],
      [],
    );
    // dbsect_9 comes before dbsect_12 in the record, though "12" < "9" as text.
    expect(out).toMatchObject([{ id: 'dail-2026-05-06-dbsect_9', sectionIds: ['dail-2026-05-06-dbsect_9', 'dail-2026-05-06-dbsect_12'] }]);
  });

  it('links a bill from any of its sections, or from the container a stage sits in; the lowest id for a joint debate', () => {
    const out = groupDebates(
      [
        section('dbsect_2', '2026-02-10', 'Health Bill 2026 and Care Bill 2026: Second Stage'),
        section('dbsect_7', '2026-02-11', 'Courts Bill 2025: Committee Stage'),
        section('dbsect_15', '2026-02-12', 'Section 1', 'dbsect_14', 'Housing Bill 2025: Committee Stage'),
      ],
      [
        { sectionId: 'dail-2026-02-10-dbsect_2', billId: '2026-9' },
        { sectionId: 'dail-2026-02-10-dbsect_2', billId: '2026-10' },
        { sectionId: 'dail-2026-02-11-dbsect_7', billId: '2025-80' },
        { sectionId: 'dail-2026-02-12-dbsect_14', billId: '2025-31' },
        // A link to a section that is not stored and is no container: ignored.
        { sectionId: 'dail-2026-02-13-dbsect_1', billId: '2025-1' },
      ],
    );
    expect(out.map((d) => [d.id, d.billId])).toEqual([
      ['dail-2026-02-10-dbsect_2', '2026-10'],
      ['dail-2026-02-11-dbsect_7', '2025-80'],
      ['dail-2026-02-12-dbsect_14', '2025-31'],
    ]);
  });

  it('gives every stored section exactly one debate', () => {
    const sections = [
      section('dbsect_1', '2026-09-23', "Ceisteanna ó Cheannairí - Leaders' Questions"),
      section('dbsect_2', '2026-09-23', 'Energy Policy: Motion [Private Members]'),
      section('dbsect_3', '2026-09-23', 'Fuel Poverty', 'dbsect_99', null),
      section('dbsect_4', '2026-09-24', 'Energy Policy: Motion (Resumed) [Private Members]'),
    ];
    const out = groupDebates(sections, []);
    const all = out.flatMap((d) => d.sectionIds).sort();
    expect(all).toEqual(sections.map((s) => s.id).sort());
    // A container whose heading was never stored is still a debate, of kind `other`.
    expect(out.find((d) => d.id === 'dail-2026-09-23-dbsect_99')).toMatchObject({ kind: 'other', title: 'Untitled' });
  });
});

describe('moverOf', () => {
  const debate = (over: Partial<GroupedDebate>): GroupedDebate => ({
    id: 'd',
    kind: 'bill_stage',
    title: 't',
    billId: '2026-1',
    firstDate: '2026-03-01',
    lastDate: '2026-03-01',
    sectionIds: ['s1', 's2'],
    ...over,
  });
  const ctx = (over: Partial<MoverContext> = {}): MoverContext => ({
    primarySponsors: new Map([
      ['2026-1', { memberCode: 'Pat-Member.D.2020-02-08', label: 'Pat Member' }],
      ['2026-2', { memberCode: null, label: 'Minister for Health' }],
    ]),
    offices: [
      { title: 'Minister for Health', memberCode: 'Old-Minister.D.2016-10-03', start: '2025-01-23', end: '2026-01-31' },
      { title: 'Minister for Health', memberCode: 'New-Minister.D.2020-02-08', start: '2026-02-01', end: null },
    ],
    firstSpeakers: new Map([['s2', 'Motion-Mover.D.2024-11-29']]),
    ...over,
  });

  it("names a member sponsor, or the TD in the sponsoring office on the debate's first day", () => {
    expect(moverOf(debate({}), ctx())).toEqual({ memberCode: 'Pat-Member.D.2020-02-08', source: 'bill_sponsor' });
    expect(moverOf(debate({ billId: '2026-2' }), ctx())).toEqual({ memberCode: 'New-Minister.D.2020-02-08', source: 'office_holder' });
    expect(moverOf(debate({ billId: '2026-2', firstDate: '2025-06-01' }), ctx())).toEqual({ memberCode: 'Old-Minister.D.2016-10-03', source: 'office_holder' });
  });

  it('names nobody when the office was empty or the record does not say', () => {
    expect(moverOf(debate({ billId: '2026-2', firstDate: '2024-12-01' }), ctx())).toBeNull();
    expect(moverOf(debate({ billId: '2099-9' }), ctx())).toBeNull();
    expect(moverOf(debate({ billId: null }), ctx())).toBeNull();
  });

  it('takes the first member to speak in a motion, and names no mover for anything else', () => {
    expect(moverOf(debate({ kind: 'motion', billId: null }), ctx())).toEqual({ memberCode: 'Motion-Mover.D.2024-11-29', source: 'first_speaker' });
    expect(moverOf(debate({ kind: 'statements', billId: null }), ctx())).toBeNull();
    expect(moverOf(debate({ kind: 'questions', billId: null }), ctx())).toBeNull();
  });
});
