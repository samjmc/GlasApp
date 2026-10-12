/**
 * Research TD backgrounds from Wikipedia (docs/plans/td-history.md). Manual, not on the cron.
 * Each TD costs at most one model call, and none when its Wikipedia revision is unchanged.
 * `--dry-run` makes every call and prints what it would save, but writes nothing.
 *
 *   npm run td-history -- [--td <id>] [--limit N] [--dry-run] [--force]
 *   npm run td-history -- --delete --td <id> [--reason <text>]   take one TD's background down, and keep it down
 *   npm run td-history -- --force --td <id>      restore a TD that was taken down (lifts the takedown)
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { shutdown } from '../db';
import { chatProviderFrom, isLLMConfigured } from '../services/aiService';
import {
  deleteHistory,
  emptyRejects,
  fetchSitelinks,
  historyCandidates,
  researchTd,
  storedRevisions,
  type PassageReject,
} from '../tdHistory';
import { completeJson, QUESTION_MODEL } from '../voting';

const USAGE = 'Usage: npm run td-history -- [--td <id>] [--limit N] [--dry-run] [--force] | --delete --td <id> [--reason <text>]';
/** Between Wikipedia requests: Wikipedia asks API clients to stay at about one request a second. */
const PAUSE_MS = 1_000;

export interface Args {
  td: number | null;
  limit: number | null;
  dryRun: boolean;
  force: boolean;
  remove: boolean;
  reason: string | null;
}

function positive(argv: string[], flag: string): number | null {
  const at = argv.indexOf(flag);
  if (at === -1) return null;
  const value = Number(argv[at + 1]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${flag} needs a positive whole number. ${USAGE}`);
  return value;
}

export function parseArgs(argv: string[]): Args {
  const known = new Set(['--td', '--limit', '--dry-run', '--force', '--delete', '--reason']);
  argv.forEach((arg, i) => {
    const isValue = i > 0 && (argv[i - 1] === '--td' || argv[i - 1] === '--limit' || argv[i - 1] === '--reason');
    if (!isValue && !known.has(arg)) throw new Error(`Unknown argument ${arg}. ${USAGE}`);
  });
  const at = argv.indexOf('--reason');
  const reason = at === -1 ? null : (argv[at + 1]?.trim() ?? '');
  const args = {
    td: positive(argv, '--td'),
    limit: positive(argv, '--limit'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    remove: argv.includes('--delete'),
    reason,
  };
  if (args.remove && args.td === null) throw new Error(`--delete needs --td <id>. ${USAGE}`);
  if (reason !== null && (!args.remove || !reason)) throw new Error(`--reason goes with --delete and needs some text. ${USAGE}`);
  return args;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.remove) {
    const removed = await deleteHistory(args.td!, args.reason);
    console.log(
      removed
        ? `Deleted the background of TD ${args.td}. Later runs skip this TD; restore it with --force --td ${args.td}.`
        : `TD ${args.td} had no background. Later runs skip this TD; restore it with --force --td ${args.td}.`,
    );
    return;
  }
  if (!isLLMConfigured()) throw new Error('No LLM key is configured, so no passage can be chosen. Nothing was changed.');

  // Only an explicit `--force --td <id>` reaches a TD whose background was taken down.
  const restore = args.force && args.td !== null ? args.td : undefined;
  let tds = await historyCandidates({ restore });
  if (args.td !== null) tds = tds.filter((t) => t.id === args.td);
  if (args.limit !== null) tds = tds.slice(0, args.limit);
  if (tds.length === 0) {
    throw new Error('No active TD with a member code matches (a TD taken down with --delete needs --force --td <id>). Nothing was changed.');
  }

  const titles = await fetchSitelinks(tds.map((t) => t.memberCode));
  const stored = await storedRevisions();
  const model = chatProviderFrom(process.env)?.model ?? QUESTION_MODEL;
  const counts: Record<string, number> = { saved: 0, unchanged: 0, no_match: 0, missing: 0, disambiguation: 0, no_summary: 0, model_failed: 0, suppressed: 0, failed: 0 };
  const rejected = emptyRejects();

  for (const td of tds) {
    const title = titles.get(td.memberCode);
    if (!title) {
      counts.no_match++;
      console.warn(`[td-history] ${td.name}: no Wikipedia article on Wikidata for ${td.memberCode}`);
      continue;
    }
    try {
      const outcome = await researchTd(td, title, {
        complete: completeJson,
        model,
        storedRevision: stored.get(td.id),
        force: args.force,
        restore: restore === td.id,
        dryRun: args.dryRun,
        pause: () => sleep(PAUSE_MS),
      });
      counts[outcome.kind]++;
      if (outcome.kind === 'saved') {
        for (const reason of Object.keys(outcome.rejected) as PassageReject[]) rejected[reason] += outcome.rejected[reason];
        console.log(`[td-history] ${td.name}: ${outcome.passages} passage(s), revision ${outcome.row.sourceRevision}`);
        if (args.dryRun || args.limit !== null || args.td !== null) {
          console.log(`  summary: ${outcome.row.summary}`);
          outcome.row.passages.forEach((p) => console.log(`  - ${p}`));
        }
      } else if (outcome.kind !== 'unchanged') {
        console.warn(`[td-history] ${td.name}: ${outcome.kind} (${title})`);
      }
    } catch (error) {
      counts.failed++;
      console.warn(`[td-history] ${td.name} failed:`, error instanceof Error ? error.message : error);
    }
    await sleep(PAUSE_MS);
  }

  const prefix = args.dryRun ? '[dry run, nothing written] ' : '';
  console.log(
    `${prefix}${tds.length} TD(s): ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}. ` +
      `Rejected passages: ${Object.entries(rejected).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
  );
  if (counts.failed > 0 || counts.model_failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then(() => shutdown())
    .catch(async (error) => {
      console.error(error);
      await shutdown();
      process.exit(1);
    });
}
