/**
 * Prints the quiz review sheet (Markdown) for the content gate: per question, its dimension and
 * poles, each answer with its value read as a pole, the premise source and checkboxes.
 *
 *   npm run quiz:review -- --from 28 --ids 4,7,14,15,16 --sources <file.json>
 *
 * --from N    questions with id >= N (default: every question)
 * --ids a,b   these questions as well
 * --sources   a JSON object { "<id>": ["source", …] }. Premise sources live in the PR, next to the
 *             review, not in the bank.
 *
 * Reads the bank only. It must not import server/db, which throws without a database URL.
 */
import { readFileSync } from 'node:fs';
import { DIMENSION_POLES } from '../shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion } from '../shared/quiz';

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const from = Number(option('from') ?? 1);
const extra = (option('ids') ?? '').split(',').filter(Boolean).map(Number);
if (!Number.isInteger(from) || !extra.every(Number.isInteger)) throw new Error('--from and --ids take question ids');
const sourcesFile = option('sources');
const sources: Record<string, string[]> = sourcesFile ? JSON.parse(readFileSync(sourcesFile, 'utf8')) : {};

const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
const cell = (s: string) => s.replace(/\|/g, '\\|');

/** "strong Market", "mild Collective", "neutral": the value read against the question's own poles. */
function readAs(q: QuizQuestion, value: number): string {
  if (value === 0) return 'neutral';
  const poles = DIMENSION_POLES[q.dimension];
  const strong = q.dimension === 'economic' ? 2.5 : 3.33;
  return `${Math.abs(value) >= strong ? 'strong' : 'mild'} ${value > 0 ? poles.positive : poles.negative}`;
}

function sheet(q: QuizQuestion): string {
  const poles = DIMENSION_POLES[q.dimension];
  return [
    `### Q${q.id} · ${poles.label} (− ${poles.negative} / + ${poles.positive})`,
    '',
    `**${q.text}**`,
    '',
    '| Value | Reads as | Answer | Description |',
    '|---|---|---|---|',
    ...q.answers.map((a) => `| ${signed(a.value)} | ${readAs(q, a.value)} | ${cell(a.text)} | ${cell(a.description)} |`),
    '',
    `Premise source: ${(sources[q.id] ?? ['_none given_']).join('; ')}`,
    '',
    '- [ ] Sign: every answer reads as the pole shown',
    '- [ ] One dimension: no answer loads on another dimension',
    '- [ ] Neutral: no party cues, and each option is worded as its supporters would put it',
    '- [ ] Facts: the premise is true and worded to last',
    '',
    'Decision: approve / edit / reject',
  ].join('\n');
}

const chosen = QUIZ_QUESTIONS.filter((q) => q.id >= from || extra.includes(q.id)).sort((a, b) => a.id - b.id);
console.log([`## Quiz review sheet (${chosen.length} questions)`, ...chosen.map(sheet)].join('\n\n'));
