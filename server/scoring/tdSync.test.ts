import { describe, expect, it } from 'vitest';
import { memberImageUrl, planTdSync, type ExistingTd, type TdSeed } from './tdSync';

const seed = (over: Partial<TdSeed> & { name: string; memberCode: string }): TdSeed => ({
  party: 'Sinn Féin',
  constituency: 'Dublin Central',
  imageUrl: null,
  ...over,
});

const existing = (over: Partial<ExistingTd> & { id: number; name: string }): ExistingTd => ({
  party: 'Sinn Féin',
  constituency: 'Dublin Central',
  memberCode: null,
  imageUrl: null,
  isActive: true,
  ...over,
});

describe('planTdSync', () => {
  it('inserts members the table does not have', () => {
    const plan = planTdSync([], [seed({ name: 'Mary Lou McDonald', memberCode: 'MLM.D.2011' })]);
    expect(plan.insert).toHaveLength(1);
    expect(plan.update).toEqual([]);
    expect(plan.deactivate).toEqual([]);
  });

  it('matches on member code even when the name changed', () => {
    const rows = [existing({ id: 1, name: 'Mary-Lou McDonald', memberCode: 'MLM.D.2011' })];
    const plan = planTdSync(rows, [seed({ name: 'Mary Lou McDonald', memberCode: 'MLM.D.2011' })]);
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([{ id: 1, seed: expect.objectContaining({ name: 'Mary Lou McDonald' }) }]);
  });

  it('matches on name when the row predates member codes', () => {
    const rows = [existing({ id: 7, name: 'mary lou mcdonald', memberCode: null })];
    const plan = planTdSync(rows, [seed({ name: 'Mary Lou McDonald', memberCode: 'MLM.D.2011' })]);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0].id).toBe(7);
    expect(plan.insert).toEqual([]);
  });

  it('leaves an unchanged, active TD alone', () => {
    const rows = [
      existing({ id: 1, name: 'Simon Harris', party: 'Fine Gael', constituency: 'Wicklow', memberCode: 'SH.D.2011' }),
    ];
    const plan = planTdSync(rows, [
      seed({ name: 'Simon Harris', party: 'Fine Gael', constituency: 'Wicklow', memberCode: 'SH.D.2011' }),
    ]);
    expect(plan).toEqual({ insert: [], update: [], deactivate: [] });
  });

  it('reactivates a TD who is back in the roster', () => {
    const rows = [existing({ id: 3, name: 'Simon Harris', memberCode: 'SH.D.2011', isActive: false })];
    const plan = planTdSync(rows, [seed({ name: 'Simon Harris', memberCode: 'SH.D.2011' })]);
    expect(plan.update).toEqual([{ id: 3, seed: expect.anything() }]);
    expect(plan.deactivate).toEqual([]);
  });

  it('deactivates an active TD the roster no longer lists, and never deletes', () => {
    const rows = [
      existing({ id: 1, name: 'Still Here', memberCode: 'A.D.2020' }),
      existing({ id: 2, name: 'Lost The Seat', memberCode: 'B.D.2016' }),
      existing({ id: 3, name: 'Already Gone', memberCode: 'C.D.2011', isActive: false }),
    ];
    const plan = planTdSync(rows, [seed({ name: 'Still Here', memberCode: 'A.D.2020' })]);
    expect(plan.deactivate).toEqual([2]);
    expect(Object.keys(plan)).toEqual(['insert', 'update', 'deactivate']);
  });

  it('an empty roster changes nothing, so a failed fetch cannot wipe the Dáil', () => {
    const rows = [existing({ id: 1, name: 'Still Here', memberCode: 'A.D.2020' })];
    expect(planTdSync(rows, [])).toEqual({ insert: [], update: [], deactivate: [] });
  });

  it('collapses a roster that lists the same member twice', () => {
    const plan = planTdSync([], [
      seed({ name: 'Mary Lou McDonald', memberCode: 'MLM.D.2011' }),
      seed({ name: 'Mary Lou McDonald', memberCode: 'MLM.D.2011', party: 'Other' }),
    ]);
    expect(plan.insert).toHaveLength(1);
  });

  it('updates the existing TD rather than inserting a duplicate name', () => {
    // Same person, new member code after a re-election: name matches, code does not.
    const rows = [existing({ id: 5, name: 'Verona Murphy', memberCode: 'VM.D.2020' })];
    const plan = planTdSync(rows, [seed({ name: 'Verona Murphy', memberCode: 'VM.D.2024' })]);
    expect(plan.insert).toEqual([]);
    expect(plan.update[0]).toMatchObject({ id: 5 });
  });
});

describe('memberImageUrl', () => {
  it('builds the portrait path and escapes the code', () => {
    expect(memberImageUrl('Mary-Lou-McDonald.D.2011-03-09')).toBe(
      'https://www.oireachtas.ie/en/members/member/Mary-Lou-McDonald.D.2011-03-09/image/',
    );
    expect(memberImageUrl('a b')).toContain('a%20b');
  });
});
