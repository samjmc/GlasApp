/**
 * Test discovery guard. Every test file in git must be run by exactly one runner, and every
 * file a runner finds must be in git. A test file that matches no runner's include glob is
 * never run, and the suite still goes green.
 *
 * Asks the runners themselves (`vitest list`, `playwright test --list`) instead of copying
 * their globs, so a config change cannot make this guard agree with a broken config.
 * Playwright loads its config to list, so TEST_DATABASE_URL must be set (any value; --list
 * starts no server).
 *
 *   npx tsx scripts/ci/check-test-discovery.ts
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

export interface Discovery {
  /** Repo-relative paths with forward slashes. */
  tracked: string[];
  vitest: string[];
  playwright: string[];
}

export function findings({ tracked, vitest, playwright }: Discovery): string[] {
  const errors: string[] = [];
  const runs = new Map<string, string[]>();
  for (const [runner, files] of [['vitest', vitest], ['playwright', playwright]] as const) {
    for (const file of files) runs.set(file, [...(runs.get(file) ?? []), runner]);
  }
  const known = new Set(tracked);
  for (const file of tracked) {
    const runners = runs.get(file) ?? [];
    if (runners.length === 0) errors.push(`${file}: in git but no test runner runs it`);
    if (runners.length > 1) errors.push(`${file}: run by both ${runners.join(' and ')}`);
  }
  for (const file of runs.keys()) {
    if (!known.has(file)) errors.push(`${file}: a runner runs it but it is not in git`);
  }
  return errors;
}

// The runners' own entry files, started with this node: no npx, so no shell on Windows.
const CLI = { vitest: 'node_modules/vitest/vitest.mjs', playwright: 'node_modules/@playwright/test/cli.js' };

function run(root: string, cli: string, args: string[]): string {
  return execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function main(): number {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  // --others: a new test file counts before it is committed, so the guard works locally too.
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => TEST_FILE.test(file) && !file.startsWith('node_modules/'));

  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'glas-discovery-')), 'vitest.json');
  run(root, CLI.vitest, ['list', '--filesOnly', `--json=${out}`, '--root', '.']);
  const vitest = (JSON.parse(fs.readFileSync(out, 'utf8')) as { file: string }[]).map((t) =>
    relative(root, path.resolve(t.file)),
  );

  const report = JSON.parse(run(root, CLI.playwright, ['test', '--list', '--reporter=json'])) as {
    config: { rootDir: string };
    suites: { file: string }[];
  };
  const playwright = report.suites.map((s) => relative(root, path.resolve(report.config.rootDir, s.file)));

  console.log(`git ${tracked.length} test files; vitest runs ${vitest.length}, playwright runs ${playwright.length}`);
  const errors = findings({ tracked, vitest, playwright });
  if (tracked.length === 0) errors.push('git lists no test files: the guard checked nothing');
  for (const e of errors) console.log(`::error::${e}`);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
