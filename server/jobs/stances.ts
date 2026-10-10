/**
 * Rebuild TD stance evidence from the news, in one run:
 *   1. delete the deleted scoring panel's `article` evidence (an LLM's guess, never checked);
 *   2. re-read canonical articles of the last N days that ALREADY have a daily-vote question,
 *      and record their accepted stances (extract → verify → Jev position check → map → save → evidence);
 *   3. recalculate every ideology profile.
 * It never makes a question: a new one would carry today's date and flood the daily sessions.
 * Needs an LLM key (extract and map are model calls) and JEV_API_KEY + CLOUDFLARE_ACCOUNT_ID
 * (the position check). `--dry-run` makes the calls and counts,
 * but writes nothing.
 *
 *   npm run stances -- --rebuild [--days 180] [--dry-run]
 *
 * Dáil divisions as stances (docs/plans/quiz-improvements/01c). Only the modes marked "model"
 * call an LLM, and they refuse to run without one:
 *
 *   npm run stances -- --divisions --dry-run [--limit 20] [--window D]   model: read, print, write nothing
 *   npm run stances -- --divisions [--limit N] [--window D]              model: readings → division_readings
 *   npm run stances -- --divisions --reclassify [--limit N] [--window D] model: … and re-read stale, re-match matched
 *
 * --window D is how many days either side of a vote a daily-vote question may be dated and still
 * count as a candidate (default 60, MATCH_WINDOW_DAYS). The nightly run never passes it.
 *   npm run stances -- --divisions --audit                               the matches vs the lobbies; every match listed
 *   npm run stances -- --divisions --sync                                readings → td_stances (PUBLIC), evidence, profiles
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AUDIT_UNSCORED_DIMENSIONS } from '@shared/divisionMeaning';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { shutdown } from '../db';
import { deleteTdEvidence, recalculateAll } from '../ideology';
import { isLLMConfigured } from '../services/aiService';
import {
  classifyDivisions,
  emptyStanceStats,
  isJevConfigured,
  positionProbability,
  rebuildArticles,
  recordStances,
  runDivisionAudit,
  syncDivisionStances,
  toCandidate,
  type DivisionReading,
} from '../stances';
import { completeJson, questionForArticle } from '../voting';
import { oireachtasVoteUrl } from '../parliament';

const DEFAULT_DAYS = 180;
const USAGE =
  'Usage: npm run stances -- --rebuild [--days 180] [--dry-run] | --divisions [--dry-run] [--window D] [--reclassify] [--limit N] | --divisions --audit | --divisions --sync';

export function parseArgs(argv: string[]): { days: number; dryRun: boolean } {
  if (!argv.includes('--rebuild')) throw new Error(USAGE);
  const at = argv.indexOf('--days');
  const days = at === -1 ? DEFAULT_DAYS : Number(argv[at + 1]);
  if (!Number.isInteger(days) || days <= 0) throw new Error(`--days needs a positive whole number. ${USAGE}`);
  return { days, dryRun: argv.includes('--dry-run') };
}

// ---------------------------------------------------------------------------
// --divisions
// ---------------------------------------------------------------------------

/** A dry run reads this many divisions unless told otherwise (≈ $0.03; see 01c §10). */
export const DRY_RUN_LIMIT = 20;
const DIVISION_FLAGS = ['--divisions', '--dry-run', '--reclassify', '--limit', '--window', '--audit', '--sync'];
const VALUE_FLAGS = ['--limit', '--window'];

export type DivisionArgs =
  | { mode: 'classify'; dryRun: boolean; reclassify: boolean; limit: number | null; windowDays: number | null }
  | { mode: 'audit' }
  | { mode: 'sync' };

/** Every flag is checked: a mistyped one must not fall through to a paid run. */
export function parseDivisionArgs(argv: string[]): DivisionArgs {
  const has = (flag: string) => argv.includes(flag);
  argv.forEach((arg, i) => {
    if (VALUE_FLAGS.includes(argv[i - 1]!)) return;
    if (!DIVISION_FLAGS.includes(arg)) throw new Error(`Unknown flag ${arg}. ${USAGE}`);
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
  const reading = ['--dry-run', '--reclassify', '--limit', '--window'];

  if (has('--audit') && has('--sync')) throw new Error(`Give one of --audit or --sync. ${USAGE}`);
  if (has('--audit')) {
    only(reading, 'reading divisions');
    return { mode: 'audit' };
  }
  if (has('--sync')) {
    only(reading, 'reading divisions');
    return { mode: 'sync' };
  }
  const dryRun = has('--dry-run');
  return { mode: 'classify', dryRun, reclassify: has('--reclassify'), limit: count('--limit') ?? (dryRun ? DRY_RUN_LIMIT : null), windowDays: count('--window') };
}

function printReading(r: DivisionReading, log: (line: string) => void): void {
  log(`${r.divisionId}  ${r.date}  ${r.subject ?? 'no subject'}  [${r.status}${r.rejectReason ? `: ${r.rejectReason}` : ''}]  kind ${r.divisionKind ?? '-'}`);
  if (r.taMeans) log(`  Tá means: ${r.taMeans}`);
  if (r.blocks.length) log(`  PROPOSAL blocks: ${r.blocks.join(', ')}`);
  if (r.quote) log(`  [${r.quoteBlock}] "${r.quote}"`);
  log(`  ${r.candidates} candidate question(s)`);
  if (r.match) log(`  Question ${r.match.questionId}: ${r.match.question}\n  Tá: ${r.match.ta} | Níl: ${r.match.nil ?? '(none)'} (confidence ${r.match.confidence})`);
  if (r.error) log(`  ${r.error}`);
  const url = oireachtasVoteUrl(r.divisionId);
  if (url) log(`  ${url}`);
}

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : 'n/a');

export async function runDivisions(argv: string[], log: (line: string) => void = console.log): Promise<void> {
  const args = parseDivisionArgs(argv);

  if (args.mode === 'sync') {
    const s = await syncDivisionStances();
    log(
      `Wrote ${s.rows} vote stance(s) from ${s.divisions} matched division(s)${s.skipped ? ` (${s.skipped} skipped: no link)` : ''}, ` +
        `${s.evidence} stance evidence row(s); recomputed ${s.tds} TDs and ${s.parties} parties.`,
    );
    return;
  }

  if (args.mode === 'audit') {
    const { audit, matched } = await runDivisionAudit();
    log(`${matched.length} matched division(s). Read every one:`);
    for (const m of matched) {
      log(`${m.divisionId}  ${m.date}  ${m.subject ?? ''}  kind ${m.divisionKind ?? '-'}  (meaning ${m.meaningConfidence ?? '-'}, match ${m.matchConfidence ?? '-'})`);
      log(`  Tá means: ${m.taMeans ?? ''}`);
      log(`  [${m.quoteBlock}] "${m.quote ?? ''}"`);
      log(`  ${m.question}\n  Tá: ${m.ta ?? '?'} | Níl: ${m.nil ?? '(none)'}`);
      if (m.url) log(`  ${m.url}`);
    }
    log(`Audit: ${audit.divisions} division(s) checked; the options agree with the lobbies on ${audit.agree} of ${audit.total} (${pct(audit.agree, audit.total)}). Target: 75% or more.`);
    for (const d of IDEOLOGY_DIMENSIONS) {
      const c = audit.byDimension[d];
      if (c?.total) log(`  ${d}: ${c.agree} of ${c.total} (${pct(c.agree, c.total)})${AUDIT_UNSCORED_DIMENSIONS.includes(d) ? ' - not scored (government-vs-opposition confound, see divisions.ts)' : ''}`);
    }
    for (const w of audit.worst) log(`  disagrees: ${w.divisionId} on ${w.disagreements.map((x) => x.dimension).join(', ')}`);
    return;
  }

  if (!isLLMConfigured()) throw new Error('No LLM key is configured, so no division can be read. Nothing was changed.');
  const s = await classifyDivisions({ limit: args.limit, dryRun: args.dryRun, reclassify: args.reclassify, windowDays: args.windowDays ?? undefined });
  for (const r of s.readings) if (args.dryRun || r.status === 'failed') printReading(r, log);
  const statuses = Object.entries(s.statuses).map(([status, n]) => `${status} ${n}`).join(', ');
  log(
    `${args.dryRun ? '[dry run, nothing written] ' : ''}Read ${s.read} of ${s.pending} division(s) needing work: ${statuses}. ` +
      `${s.calls} model call(s), ${s.promptTokens} prompt + ${s.completionTokens} completion tokens.`,
  );
  if (!args.dryRun) log('Nothing is public yet: `npm run stances -- --divisions --sync` writes the TD stances.');
}

async function main(): Promise<void> {
  // The division modes first: they check for a model themselves, and need none for --sync or --audit.
  if (process.argv.includes('--divisions')) return runDivisions(process.argv.slice(2));
  const { days, dryRun } = parseArgs(process.argv.slice(2));
  // Checked before the purge: without a model, step 2 records nothing and step 1 has already run.
  if (!isLLMConfigured()) throw new Error('No LLM key is configured, so no stance can be extracted. Nothing was changed.');
  if (!isJevConfigured()) throw new Error('JEV_API_KEY or CLOUDFLARE_ACCOUNT_ID is not set, so no stance can pass the position check. Nothing was changed.');

  const articles = await rebuildArticles(new Date(Date.now() - days * 86_400_000));
  const purged = await deleteTdEvidence('article', dryRun);
  const stats = emptyStanceStats();
  let failed = 0;
  for (const article of articles) {
    try {
      await recordStances({ id: article.id, title: article.title, content: article.content }, article.tds.map(toCandidate), stats, {
        complete: completeJson,
        position: (passage) => positionProbability(passage),
        question: () => questionForArticle(article.id),
        dryRun,
      });
    } catch (error) {
      failed++;
      console.warn(`[stances] article ${article.id} failed:`, error instanceof Error ? error.message : error);
    }
  }

  const prefix = dryRun ? '[dry run, nothing written] ' : '';
  console.log(`${prefix}${dryRun ? 'Would delete' : 'Deleted'} ${purged} article evidence row(s).`);
  console.log(
    `${prefix}${articles.length} article(s) from the last ${days} days: ${stats.extracted} stance(s) extracted, ` +
      `${stats.accepted} accepted, ${stats.mapped} matched to an answer, ${failed} article(s) failed. Rejected: ` +
      `${Object.keys(stats.rejected).map((reason) => `${reason} ${stats.rejected[reason as keyof typeof stats.rejected]}`).join(', ')}.`,
  );
  if (!dryRun) {
    const summary = await recalculateAll();
    console.log(`Recalculated ${summary.users} users, ${summary.tds} TDs and ${summary.parties} parties.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then(() => shutdown())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error(error);
      await shutdown();
      process.exit(1);
    });
}
