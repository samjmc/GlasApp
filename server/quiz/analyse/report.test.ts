import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector } from '@shared/ideology';
import { symmetricQuestion } from '../testing/respondents';
import { analyse } from './analyse';
import type { ExclusionReason, Respondent } from './exposures';
import { countCell, renderReport, reportDir, totalCell } from './report';

const NONE: Record<ExclusionReason, number> = { 'no-answers': 0, unscorable: 0, incomplete: 0, 'unknown-exposure': 0 };
const BANK = [symmetricQuestion(1, 'economic')]; // answers −2.5 −1.25 +1.25 +2.5
const AT = new Date(2026, 8, 25, 14, 30, 5);

/** Respondents with Q1 as base, `counts[i]` of them choosing answer i. */
function choosing(counts: number[]): Respondent[] {
  return counts.flatMap((n, answer) =>
    Array.from({ length: n }, () => ({ base: new Map([[1, answer]]), followUp: new Map<number, number>(), vector: emptyIdeologyVector() })),
  );
}

/** One "## " section of the report, by its number. */
function section(md: string, n: number): string {
  const start = md.indexOf(`\n## ${n}. `);
  const end = md.indexOf('\n## ', start + 1);
  return md.slice(start, end === -1 ? undefined : end);
}

const rowOf = (text: string, id: number) => text.split('\n').find((line) => line.startsWith(`| Q${id} |`))!;

describe('renderReport', () => {
  it('prints <10 for an answer chosen by 3 people, and neither the 3 nor its share', () => {
    const row = rowOf(section(renderReport(analyse(choosing([3, 61, 40, 46]), BANK, NONE), AT), 3), 1);
    expect(row).toContain('A1 −2.5: <10 ·');
    expect(row).not.toMatch(/\b3\b/);
    expect(row).not.toMatch(/\b2%/); // 3 of 150
    expect(row).toContain('A2 −1.25: 60 (41%)');
  });

  it('rounds counts to the nearest 5 and totals to the nearest 10', () => {
    expect([countCell(23), countCell(9), countCell(10), totalCell(187), totalCell(9)]).toEqual(['25', '<10', '10', '190', '<10']);
    const md = renderReport(analyse(choosing([23, 54, 55, 55]), BANK, NONE), AT);
    const row = rowOf(section(md, 3), 1);
    expect(row).toBe('| Q1 | economic | 190 | A1 −2.5: 25 (12%) · A2 −1.25: 55 (29%) · A3 +1.25: 55 (29%) · A4 +2.5: 55 (29%) |');
    expect(md).toContain('N=190');
    expect(md).not.toMatch(/\b(23|187)\b/);
  });

  it('puts the findings first, worst first, and prints each section under its gate as insufficient data', () => {
    // 100 people all on A1: one dominant answer, three dead ones; too few for pairs or correlations.
    const md = renderReport(analyse(choosing([100, 0, 0, 0]), BANK, NONE), AT);
    const order = [1, 2, 3, 4, 5, 6].map((n) => md.indexOf(`\n## ${n}. `));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
    const findings = section(md, 1);
    expect(findings.indexOf('**dead** Q1')).toBeGreaterThan(0);
    expect(findings.indexOf('**dead** Q1')).toBeLessThan(findings.indexOf('**dominant** Q1'));
    expect(findings).toContain('**dominant** Q1 (economic): A1 −2.5 chosen by 100% of N=100 base exposures');

    const empty = renderReport(analyse(choosing([2, 1, 1, 1]), BANK, NONE), AT);
    expect(section(empty, 1)).toContain('No flags.');
    expect(rowOf(section(empty, 3), 1)).toContain('insufficient data (n=<10, need 100 base exposures)');
    expect(rowOf(section(empty, 2), 1)).toContain('insufficient data (n=0, need 2 qualifying pairs)');
    expect(section(empty, 5)).toContain('insufficient data (n=<10, need 100 respondents)');
  });
});

describe('reportDir', () => {
  it('names the folder by local time, without a colon', () => {
    expect(reportDir(AT)).toBe('reports/quiz-analysis/20260925-143005');
    expect(reportDir(AT)).not.toContain(':');
  });
});
