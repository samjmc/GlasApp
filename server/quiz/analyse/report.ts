/**
 * The item analysis as ONE Markdown report of aggregates. Pure.
 *
 * Small cells are suppressed so a report cannot show a lone respondent's other answers, and
 * rounding blunts differencing between two runs: a count under MIN_REPORT_CELL prints "<10"
 * and hides its share; other counts are rounded to the nearest 5, totals and N to the nearest
 * 10, shares to whole percent. Reports go under reports/ (gitignored) and are never committed:
 * the repo is public.
 */
import type { AnalysisResult, Finding, GateUnit, QuestionAnalysis } from './analyse';
import { EXCLUSION_REASONS, type ExclusionReason } from './exposures';
import {
  DOMINANT_SHARE,
  LOW_ALPHA,
  MIN_BASE_EXPOSURES_ITEM,
  MIN_PAIRS_PER_ITEM,
  MIN_PAIR_COEXPOSURES,
  MIN_REPORT_CELL,
  MIN_USERS_DIMENSION_CORR,
  ONE_CONSTRUCT_R,
  WEAK_ITEM_R,
} from './thresholds';

/** A count of people: "<10" under MIN_REPORT_CELL, else the nearest 5. */
export function countCell(n: number): string {
  return n < MIN_REPORT_CELL ? `<${MIN_REPORT_CELL}` : String(Math.round(n / 5) * 5);
}

/** A total or N: "<10" under MIN_REPORT_CELL, else the nearest 10. */
export function totalCell(n: number): string {
  return n < MIN_REPORT_CELL ? `<${MIN_REPORT_CELL}` : String(Math.round(n / 10) * 10);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** reports/quiz-analysis/YYYYMMDD-HHmmss in local time: no ':', which Windows paths cannot hold. */
export function reportDir(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `reports/quiz-analysis/${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

const minus = (s: string) => s.replace('-', '−');
const num = (x: number | null) => (x === null ? '—' : minus(x.toFixed(2)));
const label = (q: QuestionAnalysis, i: number) => `A${i + 1} ${q.values[i] > 0 ? '+' : ''}${minus(String(q.values[i]))}`;

function insufficient(g: { n: number; need: number; unit: GateUnit }): string {
  // Pairs are not people; respondent counts are rounded like any other total.
  return `insufficient data (n=${g.unit === 'qualifying pairs' ? g.n : totalCell(g.n)}, need ${g.need} ${g.unit})`;
}

function distribution(q: QuestionAnalysis, counts: number[], total: number): string {
  return counts
    .map((c, i) => `${label(q, i)}: ${c < MIN_REPORT_CELL ? countCell(c) : `${countCell(c)} (${Math.round((100 * c) / total)}%)`}`)
    .join(' · ');
}

function finding(f: Finding, byId: Map<number, QuestionAnalysis>): string {
  switch (f.kind) {
    case 'reversed':
    case 'weak': {
      const q = byId.get(f.questionId)!;
      const why = f.kind === 'reversed' ? 'the whole interval is below 0: its values may run the wrong way' : `under ${WEAK_ITEM_R}: it barely tracks its dimension`;
      return `**${f.kind}** Q${q.id} (${q.dimension}): pooled r ${num(f.r)} (95% CI ${num(f.lo)} to ${num(f.hi)}); ${why}.`;
    }
    case 'dead': {
      const q = byId.get(f.questionId)!;
      return `**dead** Q${q.id} (${q.dimension}): ${label(q, f.answerIndex)} never chosen in N=${totalCell(q.baseExposures)} base exposures (its share is under 3%).`;
    }
    case 'dominant': {
      const q = byId.get(f.questionId)!;
      return `**dominant** Q${q.id} (${q.dimension}): ${label(q, f.answerIndex)} chosen by ${Math.round(100 * f.share)}% of N=${totalCell(q.baseExposures)} base exposures (${Math.round(100 * DOMINANT_SHARE)}% or more).`;
    }
    case 'lowAlpha':
      return `**lowAlpha** (info) ${f.dimension}: base-form alpha ${num(f.alpha)}, under ${LOW_ALPHA}.`;
    case 'oneConstruct':
      return `**oneConstruct** (info) ${f.a} and ${f.b}: disattenuated r ${num(f.disattenuated)} (observed ${num(f.observed)}), at or beyond ±${ONE_CONSTRUCT_R}.`;
  }
}

const EXCLUSION_TEXT: Record<ExclusionReason, string> = {
  'no-answers': 'no answers stored',
  unscorable: 'an id or answer the bank no longer has',
  incomplete: "the answers are not exactly the stored plan's questions",
  'unknown-exposure': 'no plan, and not exactly the 26 legacy questions',
};

export function renderReport(result: AnalysisResult, generatedAt: Date): string {
  const byId = new Map(result.questions.map((q) => [q.id, q]));
  const excluded = EXCLUSION_REASONS.reduce((s, r) => s + result.excluded[r], 0);
  const stamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())} ${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`;
  const out: string[] = [
    '# Quiz item analysis',
    '',
    `Generated ${stamp} (local time) from each signed-in user's latest quiz. Aggregates only: a count under ${MIN_REPORT_CELL} prints \`<${MIN_REPORT_CELL}\` and hides its share; other counts are rounded to the nearest 5, totals and N to the nearest 10.`,
    '',
    `Respondents: N=${totalCell(result.included)} included, ${totalCell(excluded)} excluded (section 6).`,
    '',
    '## 1. Findings',
    '',
  ];
  if (result.findings.length === 0) out.push('No flags. A section under its gate is not checked; it says so below.');
  else out.push('Worst first. Info flags describe a dimension, not a broken question.', '', ...result.findings.map((f) => `- ${finding(f, byId)}`));

  out.push(
    '',
    '## 2. Reliability and item quality',
    '',
    `Alpha is the standardised alpha of the base form every user gets, from the pooled r of the question pairs with ${MIN_PAIR_COEXPOSURES} or more respondents who had both as base. It needs two thirds of the possible pairs.`,
    '',
    '| Dimension | Alpha | Pairs used |',
    '|---|---|---|',
    ...result.dimensions.map((d) =>
      d.alpha.ok ? `| ${d.dimension} | ${num(d.alpha.value.alpha)} | ${d.alpha.value.pairs} of ${d.alpha.value.possible} |` : `| ${d.dimension} | ${insufficient(d.alpha)} | |`,
    ),
    '',
    `Each question's pooled r with the other questions on its dimension, over its qualifying pairs (${MIN_PAIRS_PER_ITEM} or more needed).`,
    '',
    '| Question | Dimension | Base N | Pairs | Pooled r (95% CI) |',
    '|---|---|---|---|---|',
    ...result.questions.map((q) => {
      const head = `| Q${q.id} | ${q.dimension} | ${totalCell(q.baseExposures)} |`;
      if (!q.quality.ok) return `${head} ${insufficient(q.quality)} | |`;
      const { pairs, r, lo, hi } = q.quality.value;
      return `${head} ${pairs} | ${num(r)} (${num(lo)} to ${num(hi)}) |`;
    }),
    '',
    '## 3. Base answer distributions',
    '',
    '| Question | Dimension | Base N | Answers |',
    '|---|---|---|---|',
    ...result.questions.map((q) =>
      q.base.ok ? `| Q${q.id} | ${q.dimension} | ${totalCell(q.baseExposures)} | ${distribution(q, q.base.value, q.baseExposures)} |` : `| Q${q.id} | ${q.dimension} | ${insufficient(q.base)} | |`,
    ),
    '',
    '## 4. Follow-up answer distributions',
    '',
    'Descriptive only. Follow-ups go only to users whose base answers were mixed, so they never feed a flag.',
    '',
  );
  const followed = result.questions.filter((q) => q.followUpExposures > 0);
  if (followed.length === 0) out.push('No follow-up exposures.');
  else {
    out.push(
      '| Question | Dimension | Follow-up N | Answers |',
      '|---|---|---|---|',
      ...followed.map((q) => `| Q${q.id} | ${q.dimension} | ${totalCell(q.followUpExposures)} | ${distribution(q, q.followUp, q.followUpExposures)} |`),
    );
  }

  out.push('', '## 5. Dimension correlations', '');
  if (!result.correlations.ok) out.push(insufficient(result.correlations));
  else {
    out.push(
      `Pearson r of the scored positions (follow-ups included) over N=${totalCell(result.included)} respondents, and that r divided by √(alpha·alpha) of the two dimensions. The scores use more questions than the base form, so a disattenuated r can pass 1.`,
      '',
      '| Dimensions | Observed r | Disattenuated r |',
      '|---|---|---|',
      ...result.correlations.value.map((c) => `| ${c.a}–${c.b} | ${num(c.observed)} | ${num(c.disattenuated)} |`),
    );
  }

  out.push(
    '',
    '## 6. Exclusions and methodology',
    '',
    '| Reason | Rows |',
    '|---|---|',
    ...EXCLUSION_REASONS.map((r) => `| ${r}: ${EXCLUSION_TEXT[r]} | ${countCell(result.excluded[r])} |`),
    '',
    "- Rows: each signed-in user's latest quiz, read in a read-only transaction without user ids or timestamps.",
    '- Base exposures only feed a flag. The base comes from the quiz seed alone, so it is a random sample of each question; follow-ups are not.',
    '- Pair r: Pearson r of the raw answer values over respondents with both questions as base. Pooled on Fisher z with weights n − 3.',
    '- Alpha: standardised alpha, k·r̄ / (1 + (k − 1)·r̄), for the k = 3 questions of the base form, from the pooled pair r.',
    `- Gates: ${MIN_BASE_EXPOSURES_ITEM} base exposures per question; ${MIN_PAIR_COEXPOSURES} co-exposures per pair; ${MIN_PAIRS_PER_ITEM} qualifying pairs per question; ${MIN_USERS_DIMENSION_CORR} respondents for dimension correlations.`,
    `- Flags: reversed = the pooled r's upper 95% bound is below 0; weak = pooled r under ${WEAK_ITEM_R}; dead = an answer never chosen; dominant = one answer at ${Math.round(100 * DOMINANT_SHARE)}% or more; lowAlpha = alpha under ${LOW_ALPHA}; oneConstruct = disattenuated r at or beyond ±${ONE_CONSTRUCT_R}.`,
    '',
    'Why not the obvious statistics:',
    '',
    '| Naive choice | What goes wrong |',
    '|---|---|',
    '| Cronbach alpha on complete cases | Adaptive users never share one item set, so it is undefined. |',
    '| Pool follow-ups with base answers | Follow-ups are selected on mixed answers: a pure-noise question reads as reversed, good ones look weak. |',
    '| Item-rest r under 0.2 | The rest is only 2 base questions; good questions sit inside that noise. |',
    '| Inter-dimension r over 0.7 | Unreliability shrinks r: two identical constructs at alpha 0.5 show about 0.5. |',
    '| N = 30 | The 95% CI of r = 0.2 runs from −0.17 to 0.52. |',
    '| Normalise each answer by its maximum | Pearson r does not change under positive rescaling. |',
    '',
  );
  return out.join('\n');
}
