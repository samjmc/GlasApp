/**
 * Documentation drift check. Collects every problem, prints them all, exits 1 if there is any.
 *
 *   npx tsx scripts/ci/check-doc-facts.ts
 *
 *   - every relative markdown link points at a file or folder that exists
 *   - every `npm run <name>` in the docs is a script in package.json
 *   - every environment variable the server reads is listed in .env.example (or is on the
 *     allowlist below, which can only shrink: a name that gets documented must come off it)
 *
 * Old drift that needs a decision is listed in KNOWN_DOC_DRIFT with a reason. Anything new fails.
 *
 * It prints how much it checked, and fails if it checked no links, so a pass cannot be vacuous.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectEnv } from './facts-env';
import { FACTS_DIR } from './facts-common';
import { listFiles, readText } from './source-files';

/** Markdown the check reads: the root docs, agent notes and everything under docs/. */
const DOC_FILE = /^(?:README\.md|ARCHITECTURE\.md|CLAUDE\.md|\.claude\/.+\.md|docs\/.+\.md)$/;

/**
 * Variables the server reads that .env.example does not list. They are optional or
 * deliberate: job-secret aliases (ADMIN_API_SECRET is the documented one), scheduler
 * switches, a Redis cache, a log level, a pool size, and test and robot database URLs.
 * Add a name to .env.example and delete it here; a new undocumented one fails the check.
 */
export const ENV_MISSING_FROM_EXAMPLE: readonly string[] = [
  'ADMIN_SECRET',
  'CRON_SECRET',
  'DB_POOL_MAX',
  'DEBATE_ITEMS',
  'DIVISION_STANCES',
  'JOB_SECRET',
  'LOG_LEVEL',
  'QUESTION_ITEMS',
  'REDIS_URL',
  'ROBOTS_SOURCE_DATABASE_URL',
  'TEST_DATABASE_URL',
];

/**
 * Documents with broken links or dead `npm run` names that need a decision, not a mechanical
 * fix. Every link and npm issue in a listed file is tolerated. A file with no issue left must
 * come off the list, so the list only shrinks.
 */
export const KNOWN_DOC_DRIFT: ReadonlyArray<{ file: string; why: string }> = [
  { file: 'README.md', why: 'Links MIGRATION_SUMMARY.md, which is gone, and LICENSE, which was never committed; the migration checklist around the first link is stale too.' },
  { file: 'docs/plans/news-ingestion-rebuild.md', why: 'Lists `npm run update-news` in the table of code this rebuild deleted, so the name is meant to be gone.' },
];

export interface DocCheck {
  issues: string[];
  counts: {
    markdownFiles: number;
    links: number;
    npmRuns: number;
    serverEnvVars: number;
    allowlisted: number;
    knownDocIssues: number;
  };
}

/** Blank out fenced code and inline code (same length, newlines kept) so links in code are not links. */
export function withoutCode(markdown: string): string {
  let fence: string | null = null;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = /^\s{0,3}(```+|~~~+)/.exec(line)?.[1];
      if (fence) {
        if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
        return ' '.repeat(line.length);
      }
      if (marker) {
        fence = marker;
        return ' '.repeat(line.length);
      }
      return line.replace(/(`+)[^`\n]*?\1/g, (m) => ' '.repeat(m.length));
    })
    .join('\n');
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Link destinations in a markdown text: inline, reference definitions, and HTML href/src. */
export function linkTargets(markdown: string): Array<{ target: string; line: number }> {
  const text = withoutCode(markdown);
  const found: Array<{ target: string; line: number }> = [];
  const patterns = [
    /!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g,
    /^[ ]{0,3}\[[^\]\n]+\]:\s*<?(\S+?)>?(?:\s|$)/gm,
    /\b(?:href|src)="([^"\n]+)"/g,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) found.push({ target: m[1]!, line: lineOf(text, m.index!) });
  return found;
}

/** The repo-relative path a link means, or null when it is not a local file link. */
export function resolveLink(fromFile: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//') || target.startsWith('#')) return null;
  let rel = target.split('#')[0]!.split('?')[0]!;
  if (!rel) return null;
  try {
    rel = decodeURI(rel);
  } catch {
    // keep it as written
  }
  const joined = rel.startsWith('/') ? rel.slice(1) : path.posix.join(path.posix.dirname(fromFile), rel);
  return path.posix.normalize(joined).replace(/\/$/, '');
}

export function linkIssues(root: string, files: string[], docs: string[]): { issues: string[]; checked: number } {
  const known = new Set(files);
  const folders = new Set<string>(['.']);
  for (const f of files) for (let d = path.posix.dirname(f); d !== '.' && !folders.has(d); d = path.posix.dirname(d)) folders.add(d);

  const issues: string[] = [];
  let checked = 0;
  for (const doc of docs) {
    for (const { target, line } of linkTargets(readText(root, doc))) {
      const resolved = resolveLink(doc, target);
      if (resolved === null) continue;
      checked++;
      if (resolved.startsWith('..')) issues.push(`${doc}:${line}: link leaves the repository: ${target}`);
      else if (!known.has(resolved) && !folders.has(resolved)) issues.push(`${doc}:${line}: broken link ${target} (no ${resolved})`);
    }
  }
  return { issues, checked };
}

export function npmRunIssues(root: string, docs: string[], scripts: ReadonlySet<string>): { issues: string[]; checked: number } {
  const issues: string[] = [];
  let checked = 0;
  for (const doc of docs) {
    // Generated files name the regenerate command, which exists only once it is wired into package.json.
    // Their freshness is checked by generate-facts --check instead.
    if (doc.startsWith(`${FACTS_DIR}/`)) continue;
    const text = readText(root, doc);
    for (const m of text.matchAll(/\bnpm\s+run(?:\s+-{1,2}[\w-]+)*\s+([A-Za-z0-9_][\w:.-]*)/g)) {
      const name = m[1]!.replace(/[.:,;]+$/, '');
      checked++;
      if (!scripts.has(name)) issues.push(`${doc}:${lineOf(text, m.index!)}: \`npm run ${name}\` is not a script in package.json`);
    }
  }
  return { issues, checked };
}

export function envIssues(
  root: string,
  files: string[],
  allowlist: readonly string[],
): { issues: string[]; checked: number; allowlisted: number } {
  const facts = collectEnv(root, files);
  const issues = [...facts.issues];
  const server = facts.vars.filter((v) => v.scope.includes('server'));
  const allowed = new Set(allowlist);
  for (const v of server) {
    if (!v.inExample && !allowed.has(v.name)) {
      issues.push(`${v.files[0]}: ${v.name} is read by the server but is not in .env.example. Add it there (docs/generated/env.md lists every reader).`);
    }
  }
  const serverNames = new Map(server.map((v) => [v.name, v]));
  for (const name of allowlist) {
    const v = serverNames.get(name);
    if (!v) issues.push(`scripts/ci/check-doc-facts.ts: ${name} is on the allowlist but the server no longer reads it. Remove it.`);
    else if (v.inExample) issues.push(`scripts/ci/check-doc-facts.ts: ${name} is now in .env.example. Remove it from the allowlist.`);
  }
  return { issues, checked: server.length, allowlisted: allowlist.length };
}

/** Split doc issues into new ones and those in a file on the known-drift list; flag list entries with nothing left. */
export function applyKnownDrift(
  found: string[],
  known: ReadonlyArray<{ file: string; why: string }>,
): { issues: string[]; tolerated: number } {
  const issues: string[] = [];
  const used = new Set<string>();
  let tolerated = 0;
  for (const issue of found) {
    const entry = known.find((k) => issue.startsWith(`${k.file}:`));
    if (entry) {
      used.add(entry.file);
      tolerated++;
    } else {
      issues.push(issue);
    }
  }
  for (const k of known) {
    if (!used.has(k.file)) issues.push(`scripts/ci/check-doc-facts.ts: ${k.file} has no broken link or dead npm run left. Remove it from KNOWN_DOC_DRIFT.`);
  }
  return { issues, tolerated };
}

export function checkDocFacts(
  root: string,
  files: string[] = listFiles(root),
  allowlist: readonly string[] = ENV_MISSING_FROM_EXAMPLE,
  knownDrift: ReadonlyArray<{ file: string; why: string }> = KNOWN_DOC_DRIFT,
): DocCheck {
  const docs = files.filter((f) => DOC_FILE.test(f));
  const links = linkIssues(root, files, docs);
  let scripts = new Set<string>();
  const issues: string[] = [];
  try {
    scripts = new Set(Object.keys((JSON.parse(readText(root, 'package.json')) as { scripts?: Record<string, string> }).scripts ?? {}));
  } catch {
    issues.push('package.json: cannot read the scripts block');
  }
  const npm = npmRunIssues(root, docs, scripts);
  const env = envIssues(root, files, allowlist);

  const docDrift = applyKnownDrift([...links.issues, ...npm.issues], knownDrift);
  issues.push(...docDrift.issues, ...env.issues);
  // A check that looked at nothing is not a pass.
  if (docs.length === 0) issues.push('no markdown files matched; the doc check looked at nothing');
  if (links.checked === 0) issues.push('checked 0 relative links; the link check looked at nothing');
  if (env.checked === 0) issues.push('found 0 environment variables read by the server; the env check looked at nothing');

  return {
    issues,
    counts: {
      markdownFiles: docs.length,
      links: links.checked,
      npmRuns: npm.checked,
      serverEnvVars: env.checked,
      allowlisted: env.allowlisted,
      knownDocIssues: docDrift.tolerated,
    },
  };
}

function main(): number {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { issues, counts } = checkDocFacts(root);
  console.log(
    `Checked ${counts.markdownFiles} markdown files: ${counts.links} relative links, ${counts.npmRuns} npm run mentions, ` +
      `${counts.serverEnvVars} server env vars (${counts.allowlisted} allowlisted as missing from .env.example). ` +
      `${counts.knownDocIssues} known doc issues tolerated (KNOWN_DOC_DRIFT).`,
  );
  if (issues.length > 0) {
    console.error(`Documentation facts drifted (${issues.length}):\n- ${issues.join('\n- ')}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
