import { describe, expect, it } from 'vitest';
import { summariseParty, weightsFromRanking } from './score';

describe('weightsFromRanking', () => {
  it('gives n points to the first of n categories and 1 to the last, normalised to 1', () => {
    const w = weightsFromRanking(['housing', 'health', 'climate']);
    expect(w.housing).toBeCloseTo(3 / 6);
    expect(w.health).toBeCloseTo(2 / 6);
    expect(w.climate).toBeCloseTo(1 / 6);
    expect(Object.values(w).reduce((a, b) => a + b!, 0)).toBeCloseTo(1);
  });

  it('is empty for an empty ranking', () => {
    expect(weightsFromRanking([])).toEqual({});
  });
});

describe('summariseParty', () => {
  const pledges = [
    { status: 'delivered' as const, category: 'housing' as const },
    { status: 'delivered' as const, category: 'health' as const },
    { status: 'broken' as const, category: 'housing' as const },
    { status: 'in_progress' as const, category: 'climate' as const },
    { status: 'unassessed' as const, category: 'climate' as const },
  ];

  it('counts every status and rates only resolved pledges', () => {
    const s = summariseParty('Party X', pledges, null);
    expect(s.total).toBe(5);
    expect(s.byStatus).toMatchObject({ delivered: 2, broken: 1, in_progress: 1, unassessed: 1, not_started: 0, superseded: 0 });
    expect(s.deliveryRate).toBeCloseTo(2 / 3);
    expect(s.weightedDeliveryRate).toBeNull();
  });

  it('weights resolved pledges by category priority', () => {
    // housing 0.75, health 0.25: delivered = 0.75 + 0.25, resolved = 0.75*2 + 0.25.
    const s = summariseParty('Party X', pledges, { housing: 0.75, health: 0.25 });
    expect(s.weightedDeliveryRate).toBeCloseTo(1 / 1.75);
  });

  it('has no rate at all until something is resolved: unassessed is not a failure', () => {
    const s = summariseParty('Party Y', [{ status: 'unassessed', category: 'housing' }], { housing: 1 });
    expect(s.deliveryRate).toBeNull();
    expect(s.weightedDeliveryRate).toBeNull();
  });

  it('ignores categories nobody ranked in the weighted rate', () => {
    const s = summariseParty('Party Z', [{ status: 'broken', category: 'climate' }], { housing: 1 });
    expect(s.deliveryRate).toBe(0);
    expect(s.weightedDeliveryRate).toBeNull();
  });
});
