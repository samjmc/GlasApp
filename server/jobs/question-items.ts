/**
 * Read question exchanges for items: Q2 of docs/plans/question-sessions.md. Flags and report in
 * itemsJob.ts.
 *
 *   npm run questions:items -- --pilot 100       a fixed sample of 100 exchanges across formats
 *   npm run questions:items -- --debate <id> …   these exchanges ("<section id>#<n>")
 *   npm run questions:items -- --limit 200       the first 200 not read yet, or changed
 *   npm run questions:items -- --all --yes       every exchange (dollars after a version bump)
 */
import 'dotenv/config';
import { repository as repo } from '../parliament';
import { extractQuestions } from '../parliament/questionItems/run';
import { runItemsJob } from './itemsJob';

runItemsJob({
  units: 'question exchanges',
  extract: extractQuestions,
  total: async () => {
    const all = await repo.questionUnits();
    return { count: all.length, words: all.reduce((n, u) => n + u.words, 0) };
  },
});
