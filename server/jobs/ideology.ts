/**
 * Ideology rebuilds, and the Dáil division readings (server/ideology/divisions.ts).
 * Only the modes marked "model" call an LLM, and they refuse to run without one.
 *
 *   npm run ideology -- --recalculate                          rebuild every profile from evidence
 *   npm run ideology -- --divisions --dry-run [--limit 20]     model: read divisions, print them, write nothing
 *   npm run ideology -- --divisions [--limit N]                model: read those that need it → division_ideology
 *   npm run ideology -- --divisions --reclassify [--limit N]   model: … and re-read old-prompt or corrected ones
 *   npm run ideology -- --divisions --audit [--resample N]     readings vs the lobbies; model only with --resample
 *   npm run ideology -- --divisions --evidence-only            readings + votes → TD evidence, recompute TDs and parties
 *
 * Reading divisions never touches evidence: `--evidence-only` (or the nightly run) does that.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { shutdown } from '../db';
import { classifyDivisions, recalculateAll, runDivisionAudit, syncDivisionEvidence, unknownTdCount, type DivisionReading } from '../ideology';
import { isLLMConfigured } from '../services/aiService';

const USAGE =
  'Usage: npm run ideology -- --recalculate | --divisions [--dry-run] [--reclassify] [--limit N] | --divisions --audit [--resample N] | --divisions --evidence-only';
/** A dry run reads this many divisions unless told otherwise (≈ $0.03; see docs/plans/quiz-improvements/01). */
export const DRY_RUN_LIMIT = 20;

const FLAGS = ['--recalculate', '--divisions', '--dry-run', '--reclassify', '--limit', '--audit', '--resample', '--evidence-only'];
const VALUE_FLAGS = ['--limit', '--resample'];

export type JobArgs =
  | { mode: 'recalculate' }
  | { mode: 'classify'; dryRun: boolean; reclassify: boolean; limit: number | null }
  | { mode: 'audit'; resample: number }
  | { mode: 'evidence' };

/** Every flag is checked: a mistyped one must not fall through to a paid classification. */
export function parseArgs(argv: string[]): JobArgs {
  const has = (flag: string) => argv.includes(flag);
  argv.forEach((arg, i) => {
    if (VALUE_FLAGS.includes(argv[i - 1])) return;
    if (!FLAGS.includes(arg)) throw new Error(`Unknown flag ${arg}. ${USAGE}`);
  });
  const count = (flag: string) => {
    const at = argv.indexOf(flag);
    if (at === -1) return null;
    const n = Number(argv[at + 1]);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} needs a positive whole number. ${USAGE}`);
    return n;
  };
  const only = (flags: string[], mode: string) => {
    const stray = flags.find(has);
    if (stray) throw new Error(`${stray} goes only with ${mode}. ${USAGE}`);
  };

  if (has('--recalculate')) {
    if (argv.length > 1) throw new Error(`Give one of --recalculate or --divisions. ${USAGE}`);
    return { mode: 'recalculate' };
  }
  if (!has('--divisions')) throw new Error(USAGE);
  if (has('--audit') && has('--evidence-only')) throw new Error(`Give one of --audit or --evidence-only. ${USAGE}`);
  if (has('--audit')) {
    only(['--dry-run', '--reclassify', '--limit'], 'reading divisions');
    return { mode: 'audit', resample: count('--resample') ?? 0 };
  }
  only(['--resample'], '--audit');
  if (has('--evidence-only')) {
    only(['--dry-run', '--reclassify', '--limit'], 'reading divisions');
    return { mode: 'evidence' };
  }
  const dryRun = has('--dry-run');
  return { mode: 'classify', dryRun, reclassify: has('--reclassify'), limit: count('--limit') ?? (dryRun ? DRY_RUN_LIMIT : null) };
}

/** The division's page on oireachtas.ie, from its id; null for an id of another shape. */
export function oireachtasVoteUrl(divisionId: string): string | null {
  const m = divisionId.match(/^dail-(\d+)-(\d{4}-\d{2}-\d{2})-vote_(\d+)$/);
  return m ? `https://www.oireachtas.ie/en/debates/vote/dail/${m[1]}/${m[2]}/${m[3]}/` : null;
}

const leans = (lean: Record<string, number>) =>
  IDEOLOGY_DIMENSIONS.filter((d) => lean[d]).map((d) => `${d} ${lean[d] > 0 ? '+' : ''}${lean[d]}`).join(', ') || 'none';
const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : 'n/a');

function printReading(r: DivisionReading, log: (line: string) => void): void {
  log(`${r.divisionId}  ${r.date}  ${r.subject ?? 'no subject'}  [${r.status}]`);
  const c = r.classification;
  if (c) {
    log(`  Tá means: ${c.taMeans || '(not given)'}`);
    log(`  Tá: ${leans(c.taLean)} | Níl: ${leans(c.nilLean)}`);
    log(`  confidence ${c.confidence}, salience ${c.salience}, Níl weight ${c.nilWeight}`);
  }
  if (r.error) log(`  ${r.error}`);
  const url = oireachtasVoteUrl(r.divisionId);
  if (url) log(`  ${url}`);
}

export async function run(argv: string[], log: (line: string) => void = console.log): Promise<void> {
  const args = parseArgs(argv);

  if (args.mode === 'recalculate') {
    const summary = await recalculateAll();
    log(
      `Re-scored ${summary.quizzesRescored} stored quiz result(s). ` +
        `Recalculated ${summary.users} users, ${summary.tds} TDs and ${summary.parties} parties.`,
    );
    if (unknownTdCount()) log(`${unknownTdCount()} evidence item(s) named an unknown TD.`);
    return;
  }

  if (args.mode === 'evidence') {
    const s = await syncDivisionEvidence();
    log(`Wrote ${s.rows} evidence row(s) from ${s.divisions} division(s); recomputed ${s.tds} TDs and ${s.parties} parties.`);
    return;
  }

  const needsModel = args.mode === 'classify' || args.resample > 0;
  if (needsModel && !isLLMConfigured()) throw new Error('No LLM key is configured, so no division can be read. Nothing was changed.');

  if (args.mode === 'audit') {
    const { audit, resample } = await runDivisionAudit({ resample: args.resample });
    log(`Audit: ${audit.divisions} division(s) checked; the reading agrees with the lobbies on ${audit.agree} of ${audit.total} (${pct(audit.agree, audit.total)}). Target: 75% or more.`);
    for (const d of IDEOLOGY_DIMENSIONS) {
      const c = audit.byDimension[d];
      if (c?.total) log(`  ${d}: ${c.agree} of ${c.total} (${pct(c.agree, c.total)})`);
    }
    if (audit.worst.length) log(`The ${audit.worst.length} that disagree most:`);
    for (const w of audit.worst) {
      log(`${w.divisionId}  ${w.taMeans ?? ''}`);
      for (const d of w.disagreements) log(`  ${d.dimension}: Tá ${d.taLean}, Níl ${d.nilLean}, Tá lobby − Níl lobby ${d.gap}`);
      const url = oireachtasVoteUrl(w.divisionId);
      if (url) log(`  ${url}`);
    }
    if (resample) {
      log(`Resample: ${resample.divisions} division(s) read again; ${resample.stable} of ${resample.total} leaning dimensions kept their sign (${pct(resample.stable, resample.total)}), ${resample.failed} failed, ${resample.promptTokens} prompt + ${resample.completionTokens} completion tokens.`);
      for (const d of IDEOLOGY_DIMENSIONS) {
        const c = resample.byDimension[d];
        if (c.total) log(`  ${d}: ${c.stable} of ${c.total}`);
      }
    }
    return;
  }

  const s = await classifyDivisions({ limit: args.limit, dryRun: args.dryRun, reclassify: args.reclassify });
  for (const r of s.readings) if (args.dryRun || r.status === 'failed') printReading(r, log);
  const statuses = Object.entries(s.statuses).map(([status, n]) => `${status} ${n}`).join(', ');
  log(
    `${args.dryRun ? '[dry run, nothing written] ' : ''}Read ${s.read} of ${s.pending} division(s) needing a reading: ${statuses}. ` +
      `${s.calls} model call(s), ${s.promptTokens} prompt + ${s.completionTokens} completion tokens.`,
  );
  if (!args.dryRun) log('Evidence is unchanged: run `npm run ideology -- --divisions --evidence-only` to apply the readings.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(process.argv.slice(2))
    .then(() => shutdown())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error(error);
      await shutdown();
      process.exit(1);
    });
}
