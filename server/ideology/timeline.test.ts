/**
 * userTimeline is built in one pass over the votes. It must give exactly what the full
 * recompute per day gave before (kept below as the reference), on a realistic history.
 */
import { describe, expect, it, vi } from 'vitest';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { QUIZ_QUESTIONS } from '@shared/quiz';
import type { QuizResultRow } from '@shared/schema/quiz';
import { scoreQuiz } from '../quiz/score';
import type { UserVoteVector } from '../voting';
import { sessionDateFor } from '../voting/summary';

vi.mock('../voting', () => ({ listUserVoteVectors: vi.fn(async () => []), questionsWithPositions: vi.fn(async () => []) }));
vi.mock('../stances/repository', () => ({ mappedStancesOn: vi.fn(async () => []) }));
vi.mock('./repository', async () => {
  const { IDEOLOGY_DIMENSIONS } = await import('@shared/ideology');
  return { vectorOf: (row: Record<string, number>) => Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, row[d]])) };
});

const { timelineOf, userProfileOf } = await import('./service');

/**
 * The last instant of an Irish calendar day, found by stepping an hour at a time (Irish midnight
 * always falls on a whole UTC hour): slow but obviously right.
 */
function lastInstantOf(date: string): Date {
  let t = Date.parse(`${date}T00:00:00Z`) - 2 * 3_600_000;
  while (sessionDateFor(new Date(t)) <= date) t += 3_600_000;
  return new Date(t - 1);
}

/** The implementation before the one-pass rewrite: a full recompute at the end of each (Irish) day. */
function timelineBefore(quizzes: QuizResultRow[], votes: UserVoteVector[]) {
  const day = (d: Date) => sessionDateFor(d);
  const days = Array.from(new Set<string>([...quizzes.map((q) => day(q.createdAt)), ...votes.map((v) => day(v.votedAt))])).sort();
  return days.map((date) => ({ date, vector: userProfileOf(quizzes, votes, lastInstantOf(date))!.vector }));
}

/** Deterministic pseudo-random numbers (mulberry32), so a failure reproduces. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.parse('2026-06-01T00:00:00Z');
const HOUR = 3_600_000;

function history(seed: number, voteCount: number, quizCount: number) {
  const next = random(seed);
  const at = () => new Date(START + Math.floor(next() * 90 * 24) * HOUR + Math.floor(next() * HOUR));
  const votes: UserVoteVector[] = Array.from({ length: voteCount }, (_, i) => ({
    questionId: i + 1,
    optionKey: 'option_a',
    // Most options speak to two or three axes; the rest are 0 ("silent").
    vector: Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, next() < 0.35 ? Math.round((next() * 4 - 2) * 100) / 100 : 0])) as UserVoteVector['vector'],
    weight: Math.round((0.2 + next() * 1.8) * 100) / 100,
    confidence: next() < 0.5 ? null : Math.round(next() * 100) / 100,
    votedAt: at(),
  })).sort((a, b) => a.votedAt.getTime() - b.votedAt.getTime());
  const quizzes: QuizResultRow[] = Array.from({ length: quizCount }, (_, i) => {
    const answers = QUIZ_QUESTIONS.filter((_, n) => n === i || next() < 0.4).map((q) => ({ questionId: q.id, answerIndex: Math.floor(next() * q.answers.length) }));
    return { id: i + 1, userId: 'u', answers, plan: null, ...scoreQuiz(answers).vector, ideology: 'x', description: 'x', createdAt: at() };
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { quizzes, votes };
}

describe('timelineOf', () => {
  it('equals a full recompute per day, point for point', () => {
    for (const [seed, voteCount, quizCount] of [[1, 400, 4], [2, 60, 0], [3, 0, 3], [4, 250, 1], [5, 1, 1]] as const) {
      const { quizzes, votes } = history(seed, voteCount, quizCount);
      const before = timelineBefore(quizzes, votes);
      expect(before.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(timelineOf(quizzes, votes), `seed ${seed}`).toEqual(before);
    }
  });

  it('is empty with no quiz and no vote', () => {
    expect(timelineOf([], [])).toEqual([]);
  });

  it('puts a vote on the Irish day it was cast, as the daily session does (A17)', () => {
    const vote = (iso: string, economic: number): UserVoteVector => ({
      questionId: 1,
      optionKey: 'option_a',
      vector: { ...Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, 0])), economic } as UserVoteVector['vector'],
      weight: 1,
      confidence: null,
      votedAt: new Date(iso),
    });
    // 00:30 on 2 July in Dublin (summer time) is 23:30 UTC on 1 July; 00:30 on 2 December is 00:30 UTC.
    const summer = timelineOf([], [vote('2026-07-01T20:00:00Z', 2), vote('2026-07-01T23:30:00Z', -2)]);
    expect(summer.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(summer[0]!.vector.economic).toBeGreaterThan(0);
    expect(summer[1]!.vector.economic).toBeCloseTo(0);
    expect(timelineOf([], [vote('2026-12-01T23:30:00Z', 2)]).map((p) => p.date)).toEqual(['2026-12-01']);
  });
});
