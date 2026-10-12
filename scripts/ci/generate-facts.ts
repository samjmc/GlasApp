/**
 * Generated facts: the routes, jobs and environment variables the code really has, written
 * to docs/generated/ so a pull request shows when they change.
 *
 *   npx tsx scripts/ci/generate-facts.ts            write the files
 *   npx tsx scripts/ci/generate-facts.ts --check    fail if any file is missing or stale
 *
 * Output is sorted and has no timestamps, so the same code always gives the same bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectEnv, renderEnv } from './facts-env';
import { collectJobs, renderJobs } from './facts-jobs';
import { collectRoutes, renderRoutes } from './facts-routes';
import { FACTS_DIR, GENERATE_COMMAND } from './facts-common';
import { ensureGeneratedFile } from './generated-file';
import { listFiles } from './source-files';

export interface FactsResult {
  /** Repo-relative path to the text it should hold. */
  files: Map<string, string>;
  /** Anything the generators could not resolve. Not empty means the output cannot be trusted. */
  issues: string[];
}

export function buildFacts(root: string, files: string[] = listFiles(root)): FactsResult {
  const routes = collectRoutes(root, files);
  const jobs = collectJobs(root, files);
  const env = collectEnv(root, files);
  return {
    files: new Map([
      [`${FACTS_DIR}/routes.md`, renderRoutes(routes)],
      [`${FACTS_DIR}/jobs.md`, renderJobs(jobs)],
      [`${FACTS_DIR}/env.md`, renderEnv(env)],
    ]),
    issues: [...routes.issues, ...jobs.issues, ...env.issues],
  };
}

/** Write (or with `check`, compare) every file. Returns every problem found, not just the first. */
export async function ensureFacts(root: string, check: boolean, files?: string[]): Promise<string[]> {
  const { files: expected, issues } = buildFacts(root, files);
  if (issues.length > 0) return issues.map((i) => `cannot generate facts: ${i}`);

  const problems: string[] = [];
  for (const [rel, source] of expected) {
    try {
      await ensureGeneratedFile({ path: path.join(root, rel), source, check, generateCommand: GENERATE_COMMAND });
    } catch (cause) {
      problems.push((cause as Error).message);
    }
  }
  // A file left behind by a generator that no longer exists would never be refreshed.
  const dir = path.join(root, FACTS_DIR);
  if (check && fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!expected.has(`${FACTS_DIR}/${name}`)) problems.push(`${FACTS_DIR}/${name} is not produced by any generator. Delete it.`);
    }
  }
  return problems;
}

async function main(argv: string[]): Promise<number> {
  const check = argv.includes('--check');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const problems = await ensureFacts(root, check);
  if (problems.length > 0) {
    console.error(`Generated facts: ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    return 1;
  }
  console.log(check ? `Generated facts are current (${FACTS_DIR}/).` : `Generated facts written to ${FACTS_DIR}/.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
