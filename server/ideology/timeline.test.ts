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

vi.mock('../voting', () => ({ listUserVoteVectors: vi.fn(async () => []), questionsWithPositions: vi.fn(async () => []) }));
vi.mock('../stances/repository', () => ({ mappedStancesOn: vi.fn(async () => []) }));
vi.mock('./repository', async () => {
  const { IDEOLOGY_DIMENSIONS } = await import('@shared/ideology');
  return { vectorOf: (row: Record<string, number>) => Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, row[d]])) };
});

const { timelineOf, userProfileOf } = await import('./service');

/** The implementation before the one-pass rewrite: a full recompute at the end of each day. */
function timelineBefore(quizzes: QuizResultRow[], votes: UserVoteVector[]) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const days = Array.from(new Set<string>([...quizzes.map((q) => day(q.createdAt)), ...votes.map((v) => day(v.votedAt))])).sort();
  return days.map((date) => ({ date, vector: userProfileOf(quizzes, votes, new Date(`${date}T23:59:59.999Z`))!.vector }));
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
});
