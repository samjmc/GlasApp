/**
 * Every package.json script that runs a job or a one-off script, with the first line of the
 * target file's top comment. Read from package.json and the files themselves, never typed.
 */
import { byText, cell, generatedNotice } from './facts-common';
import { isTestFile, readText } from './source-files';

export interface JobFact {
  script: string;
  command: string;
  /** The file the command runs, repo-relative. */
  target: string;
  /** First line of the file's top comment, or '' when it has none. */
  summary: string;
}

export interface JobFacts {
  jobs: JobFact[];
  /** Job and script files that no npm script runs. */
  unreferenced: string[];
  issues: string[];
}

/** Where a script's target must live to count as a job. */
const TARGET = /(?:^|[\s"'])((?:server\/jobs|scripts)\/[\w./-]+\.(?:ts|mjs|cjs|js|sh|py))\b/;
/** Files looked at when listing what no script runs: server/jobs/*.ts and scripts/*.<ext>. */
const CANDIDATE = /^(?:server\/jobs\/[^/]+\.ts|scripts\/[^/]+\.(?:ts|mjs|cjs|js|sh|py))$/;

/** First meaningful line of a leading block comment, `//` run or `#` run. */
export function firstDocLine(source: string): string {
  let text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (text.startsWith('#!')) text = text.slice(text.indexOf('\n') + 1);
  text = text.replace(/^\s*\n/, '');

  let body: string[] = [];
  if (text.startsWith('/*')) {
    const end = text.indexOf('*/');
    body = text.slice(2, end < 0 ? undefined : end).split('\n');
  } else if (text.startsWith('//')) {
    body = text.split('\n').filter((l, i, all) => all.slice(0, i + 1).every((x) => x.startsWith('//')));
  } else if (text.startsWith('#')) {
    body = text.split('\n').filter((l, i, all) => all.slice(0, i + 1).every((x) => x.startsWith('#')));
  }
  for (const raw of body) {
    const line = raw.replace(/^\s*(?:\*+|\/\/+|#+)?\s?/, '').replace(/^\*+\s*/, '').trim();
    if (line) return line;
  }
  return '';
}

export function collectJobs(root: string, files: string[]): JobFacts {
  const issues: string[] = [];
  let scripts: Record<string, string> = {};
  try {
    scripts = (JSON.parse(readText(root, 'package.json')) as { scripts?: Record<string, string> }).scripts ?? {};
  } catch {
    issues.push('package.json: cannot read the scripts block');
  }
  const fileSet = new Set(files);

  const jobs: JobFact[] = [];
  for (const [script, command] of Object.entries(scripts)) {
    const target = TARGET.exec(command)?.[1];
    if (!target) continue;
    if (!fileSet.has(target)) {
      issues.push(`package.json: script "${script}" runs ${target}, which does not exist`);
      continue;
    }
    jobs.push({ script, command, target, summary: firstDocLine(readText(root, target)) });
  }
  jobs.sort((a, b) => byText(a.script, b.script));

  const run = new Set(jobs.map((j) => j.target));
  const unreferenced = files.filter((f) => CANDIDATE.test(f) && !isTestFile(f) && !run.has(f)).sort(byText);
  return { jobs, unreferenced, issues };
}

export function renderJobs(facts: JobFacts): string {
  const lines = [
    '# Jobs and scripts',
    '',
    generatedNotice('package.json scripts that run a file under `server/jobs/` or `scripts/`'),
    '',
    `${facts.jobs.length} scripts. The last column is the first line of the target file's top comment.`,
    '',
    '| Script | Command | What it does |',
    '|---|---|---|',
    ...facts.jobs.map((j) => `| \`${cell(j.script)}\` | \`${cell(j.command)}\` | ${cell(j.summary) || '—'} |`),
    '',
    '## Files no npm script runs',
    '',
    'Top-level files in `server/jobs/` and `scripts/` that no script above points at: helpers, or jobs that have to be started by hand.',
    '',
    ...(facts.unreferenced.length > 0 ? facts.unreferenced.map((f) => `- \`${f}\``) : ['None.']),
    '',
  ];
  return lines.join('\n');
}
