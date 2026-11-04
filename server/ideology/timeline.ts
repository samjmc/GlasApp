/**
 * A user's position over time: one point at the end of each day they took a quiz or voted.
 */
import type { IdeologyVector } from '@shared/ideology';
import type { QuizResultRow } from '@shared/schema/quiz';
import { startOfLocalDay } from '../news/feed';
import { listUserVoteVectors, type UserVoteVector } from '../voting';
import { sessionDateFor } from '../voting/summary';
import { addObservation, copySums, profileOf, startSums } from './model';
import * as repo from './repository';
import { quizObservation, voteObservation } from './userProfile';

export interface TimelinePoint {
  date: string;
  vector: IdeologyVector;
}

/** The user's position at the end of each day on which they took a quiz or voted. */
export async function userTimeline(userId: string): Promise<TimelinePoint[]> {
  const [quizzes, votes] = await Promise.all([repo.listQuizResults(userId), listUserVoteVectors(userId)]);
  return timelineOf(quizzes, votes);
}

/**
 * One pass over the votes, oldest first: each day adds its votes to running sums, then that day's
 * latest quiz on a copy. Votes before the quiz, as userObservations orders them, so the sums
 * are added in the same order and every point equals a full recompute at the end of its day.
 */
export function timelineOf(quizzes: QuizResultRow[], votes: UserVoteVector[]): TimelinePoint[] {
  const days = Array.from(new Set<string>([...quizzes.map((q) => day(q.createdAt)), ...votes.map((v) => day(v.votedAt))])).sort();
  const oldestFirst = [...votes].sort((a, b) => a.votedAt.getTime() - b.votedAt.getTime());
  const voteSums = startSums(null);
  let next = 0;
  return days.map((date) => {
    const until = endOfDay(date);
    const options = { now: until, halfLifeDays: null };
    for (; next < oldestFirst.length && oldestFirst[next]!.votedAt <= until; next++) addObservation(voteSums, voteObservation(oldestFirst[next]!), options);
    const sums = copySums(voteSums);
    const quiz = quizzes.find((q) => q.createdAt <= until);
    if (quiz) addObservation(sums, quizObservation(quiz), options);
    return { date, vector: profileOf(sums).vector };
  });
}

/** Days are Irish calendar days, as the daily sessions and the streak count them. */
const day = (d: Date) => sessionDateFor(d);

/** The last instant of `date` (YYYY-MM-DD) in Europe/Dublin. Noon UTC is always inside that local day. */
function endOfDay(date: string): Date {
  const nextDay = new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000);
  return new Date(startOfLocalDay(nextDay).getTime() - 1);
}
