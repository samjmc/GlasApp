/**
 * Quiz item analysis: one Markdown report of aggregates over each signed-in user's latest quiz
 * (server/quiz/analyse/). Read-only; no user ids leave the database.
 *   npm run quiz:analyse
 * Writes reports/quiz-analysis/<YYYYMMDD-HHmmss>/report.md. reports/ is gitignored and a report
 * is never committed: the repo is public. Prints only the path and rounded counts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { QUIZ_QUESTIONS } from '@shared/quiz';
import { analyse } from '../quiz/analyse/analyse';
import { EXCLUSION_REASONS, toRespondent, type ExclusionReason, type Respondent } from '../quiz/analyse/exposures';
import { loadLatestQuizzes } from '../quiz/analyse/loader';
import { renderReport, reportDir, totalCell } from '../quiz/analyse/report';
import { pool, shutdown } from '../db';

async function main(): Promise<void> {
  parseArgs({ args: process.argv.slice(2), options: {} }); // no options: rejects anything passed
  const respondents: Respondent[] = [];
  const excluded = Object.fromEntries(EXCLUSION_REASONS.map((r) => [r, 0])) as Record<ExclusionReason, number>;
  for (const row of await loadLatestQuizzes(pool)) {
    const out = toRespondent(row, QUIZ_QUESTIONS);
    if (out.ok) respondents.push(out.r);
    else excluded[out.reason] += 1;
  }
  const now = new Date();
  const result = analyse(respondents, QUIZ_QUESTIONS, excluded);
  const dir = reportDir(now);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'report.md');
  fs.writeFileSync(file, renderReport(result, now));
  const total = EXCLUSION_REASONS.reduce((s, r) => s + excluded[r], 0);
  console.log(`Wrote ${file}: ${totalCell(result.included)} included, ${totalCell(total)} excluded, ${result.findings.length} flag(s).`);
}

main()
  .then(() => shutdown())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await shutdown();
    process.exit(1);
  });
