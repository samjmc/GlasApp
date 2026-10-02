/**
 * `report`: what the manifesto answers would do to the party match targets. Pure; the job reads
 * the stored party rows read-only and passes them in.
 *
 * Per party: the manifesto vector m and coverage c, the baseline, the stored row t (the TD mean)
 * and the read-time blend. A dimension where m is far from the baseline at high coverage is
 * flagged for the reviewer. The party order for three fixed users (all −10, all +10, all 0)
 * shows whether the blend reshuffles the results page.
 */
import { IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT, type IdeologyVector } from '@shared/ideology';
import type { PartyQuizSheet } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import { alignment } from '../ideology/alignment';
import { partyBaseline, partyKey } from '../ideology/partyBaselines';
import { blendPartyTarget, manifestoPosition } from './position';

export const FLAG_GAP = 6;
export const FLAG_COVERAGE = 0.5;

export interface PartyRow {
  party: string;
  vector: IdeologyVector;
}

/** `party,<dimension>,...` on the −10..+10 scale, + = right-coded. Unknown columns are ignored. */
export function parseChesCsv(text: string): Map<string, Partial<IdeologyVector>> {
  const [header, ...lines] = text.replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split(',').map((c) => c.trim()));
  const out = new Map<string, Partial<IdeologyVector>>();
  for (const cells of lines) {
    const values: Partial<IdeologyVector> = {};
    header!.forEach((name, i) => {
      const d = IDEOLOGY_DIMENSIONS.find((x) => x === name);
      const v = Number(cells[i]);
      if (d && cells[i] !== '' && Number.isFinite(v)) values[d] = v;
    });
    out.set(partyKey(cells[0]!), values);
  }
  return out;
}

const num = (x: number) => String(Math.round(x * 100) / 100);

export function partyReport(input: {
  sheets: PartyQuizSheet[];
  bank: QuizQuestion[];
  rows: PartyRow[];
  ches?: Map<string, Partial<IdeologyVector>>;
}): string {
  const { sheets, bank, rows, ches } = input;
  const out: string[] = ['Read-only: the stored party rows are not changed. t = stored party row (TD mean).', ''];
  const labels = new Map<string, string>();
  for (const p of [...rows.map((r) => r.party), ...sheets.map((s) => s.party)]) if (!labels.has(partyKey(p))) labels.set(partyKey(p), p);

  const parties = Array.from(labels.values()).map((party) => {
    const baseline = partyBaseline(party);
    const t = rows.find((r) => partyKey(r.party) === partyKey(party))?.vector ?? baseline;
    const pos = manifestoPosition(party, sheets, bank);
    // Until plan 03 says which dimensions a party with no baseline has measured, treat none as measured.
    const blend = t ? blendPartyTarget(t, pos, baseline ? 'all' : new Set()).vector : null;
    return { party, baseline, t, pos, blend };
  });
  const withPos = parties.filter((p) => p.pos);
  if (withPos.length === 0) out.push('No party has an approved, current manifesto answer yet.', '');

  const flags: string[] = [];
  if (withPos.length) {
    out.push('## Positions', '', '| Party | Dimension | m | c | baseline | t | blend | check |', '|---|---|---|---|---|---|---|---|');
    for (const { party, baseline, t, pos, blend } of withPos) {
      for (const d of IDEOLOGY_DIMENSIONS) {
        const m = pos!.vector[d];
        const c = pos!.coverage[d];
        const flagged = baseline !== null && c >= FLAG_COVERAGE && Math.abs(m - baseline[d]) >= FLAG_GAP;
        if (flagged) flags.push(`- ${party} ${d}: m ${m.toFixed(1)}, baseline ${num(baseline![d])}, c ${c.toFixed(2)}`);
        const cells = [party, d, m.toFixed(1), c.toFixed(2), baseline ? num(baseline[d]) : '-', t ? num(t[d]) : '-', blend ? num(blend[d]) : '-', flagged ? 'CHECK' : ''];
        out.push(`| ${cells.join(' | ')} |`);
      }
    }
    out.push('', `## Coverage (approved answered items / bank questions)`, '', `| Party | answered/asked | ${IDEOLOGY_DIMENSIONS.join(' | ')} |`, `|---|---|${IDEOLOGY_DIMENSIONS.map(() => '---|').join('')}`);
    for (const { party, pos } of withPos) {
      out.push(`| ${party} | ${pos!.answeredCount}/${pos!.askedCount} | ${IDEOLOGY_DIMENSIONS.map((d) => pos!.coverage[d].toFixed(2)).join(' | ')} |`);
    }
    out.push('', `## Flags (|m - baseline| >= ${FLAG_GAP} at c >= ${FLAG_COVERAGE})`, '', ...(flags.length ? flags : ['None.']));
  }

  out.push('', '## Party order for fixed users', '');
  const ranked = parties.filter((p) => p.t && p.blend);
  for (const [label, value] of [['all -10', -IDEOLOGY_LIMIT], ['all +10', IDEOLOGY_LIMIT], ['all 0', 0]] as const) {
    const user = Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, value])) as IdeologyVector;
    const order = (pick: (p: (typeof ranked)[number]) => IdeologyVector) =>
      ranked
        .map((p) => ({ party: p.party, score: alignment(user, pick(p)) }))
        .sort((a, b) => b.score - a.score)
        .map((p) => `${p.party} (${p.score})`)
        .join(', ');
    out.push(`- ${label}: before ${order((p) => p.t!)}; after ${order((p) => p.blend!)}`);
  }

  if (ches) {
    out.push('', '## CHES comparison', '');
    for (const { party, pos } of withPos) {
      const ref = ches.get(partyKey(party));
      if (!ref) continue;
      for (const d of IDEOLOGY_DIMENSIONS) {
        if (ref[d] === undefined || pos!.coverage[d] === 0) continue;
        out.push(`- ${party} ${d}: m ${pos!.vector[d].toFixed(1)}, CHES ${num(ref[d]!)}, difference ${(pos!.vector[d] - ref[d]!).toFixed(1)}`);
      }
    }
  }
  return `${out.join('\n')}\n`;
}
