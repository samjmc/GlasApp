/**
 * Every environment variable the code reads, with the files that read it and whether
 * `.env.example` documents it.
 *
 * Only `.env.example` is ever opened. It is a template with no secrets.
 *
 * What counts as a read (tests are skipped: they set variables, they do not depend on them):
 *   - a named read of the process environment, in dot or quoted-bracket form, or a destructure of it
 *   - an `env` member in a file that takes the environment as an argument (a typed `env` parameter)
 *   - a `VITE_` member of `import.meta.env` in the client
 * A read through a variable names no variable, so it is listed apart.
 *
 * This file is scanned like any other, so its comments never spell a read out in full.
 */
import { byText, cell, generatedNotice } from './facts-common';
import { isTestFile, readText } from './source-files';

export type EnvScope = 'server' | 'client' | 'tooling';

export interface EnvVarFact {
  name: string;
  scope: EnvScope[];
  files: string[];
  inExample: boolean;
}

export interface EnvFacts {
  vars: EnvVarFact[];
  /** Variables `.env.example` lists that no scanned file reads. */
  unreadInExample: string[];
  /** Files that read the environment through a variable, so their names cannot be listed. */
  dynamicReads: string[];
  issues: string[];
}

const NAME = '[A-Z][A-Z0-9_]*';
const QUOTED = '[\'"`]';

/** Built from parts so no source line in this repo spells the full dotted form of a read. */
const PROCESS_ENV = 'process' + '\\.env';

const PATTERNS = {
  dot: new RegExp(`${PROCESS_ENV}\\.(${NAME})\\b`, 'g'),
  bracket: new RegExp(`${PROCESS_ENV}\\[\\s*${QUOTED}(${NAME})${QUOTED}\\s*\\]`, 'g'),
  destructure: new RegExp(`\\{([^{}]*)\\}\\s*=\\s*${PROCESS_ENV}\\b`, 'g'),
  dynamic: new RegExp(`${PROCESS_ENV}\\[\\s*[A-Za-z_$]`, 'g'),
  injectedDot: new RegExp(`(?<![.\\w$])env\\.(${NAME})\\b`, 'g'),
  injectedBracket: new RegExp(`(?<![.\\w$])env\\[\\s*${QUOTED}(${NAME})${QUOTED}\\s*\\]`, 'g'),
  vite: new RegExp(`import\\.meta\\.env\\.(VITE_[A-Z0-9_]+)\\b`, 'g'),
};

/** A file that takes the environment as an argument: a Node environment type, or a typed `env` parameter. */
const TAKES_ENV = /ProcessEnv|\benv\??\s*:\s*[A-Z]/;

/** Directories scanned, plus root-level config files. */
const SCANNED = /^(?:server|shared|scripts|client\/src)\//;
const ROOT_CONFIG = /^[^/]+\.(?:ts|mjs|cjs|js)$/;

export const scopeOf = (file: string): EnvScope =>
  file.startsWith('client/') ? 'client' : file.startsWith('server/') || file.startsWith('shared/') ? 'server' : 'tooling';

/** Names a file reads, and whether it also reads through a variable. */
export function envReadsIn(source: string): { names: string[]; dynamic: boolean } {
  const names = new Set<string>();
  const add = (re: RegExp): void => {
    for (const m of source.matchAll(re)) names.add(m[1]!);
  };
  add(PATTERNS.dot);
  add(PATTERNS.bracket);
  add(PATTERNS.vite);
  for (const m of source.matchAll(PATTERNS.destructure)) {
    for (const part of m[1]!.split(',')) {
      const key = /^\s*([A-Z][A-Z0-9_]*)\b/.exec(part)?.[1];
      if (key) names.add(key);
    }
  }
  if (TAKES_ENV.test(source)) {
    add(PATTERNS.injectedDot);
    add(PATTERNS.injectedBracket);
  }
  return { names: [...names], dynamic: new RegExp(PATTERNS.dynamic.source).test(source) };
}

/** Names `.env.example` assigns, commented out or not. */
export function exampleNames(text: string): string[] {
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = new RegExp(`^\\s*#?\\s*(${NAME})=`).exec(line);
    if (m) names.add(m[1]!);
  }
  return [...names].sort(byText);
}

export function collectEnv(root: string, files: string[]): EnvFacts {
  const issues: string[] = [];
  const byName = new Map<string, Set<string>>();
  const dynamicReads: string[] = [];

  for (const file of files) {
    if (isTestFile(file) || !/\.(?:ts|tsx|mjs|cjs|js)$/.test(file)) continue;
    if (!SCANNED.test(file) && !ROOT_CONFIG.test(file)) continue;
    const { names, dynamic } = envReadsIn(readText(root, file));
    for (const name of names) {
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name)!.add(file);
    }
    if (dynamic) dynamicReads.push(file);
  }

  let example: string[] = [];
  if (files.includes('.env.example')) example = exampleNames(readText(root, '.env.example'));
  else issues.push('.env.example: not found');
  const documented = new Set(example);

  const vars: EnvVarFact[] = [...byName.entries()]
    .map(([name, set]) => {
      const list = [...set].sort(byText);
      return {
        name,
        files: list,
        scope: [...new Set(list.map(scopeOf))].sort(byText) as EnvScope[],
        inExample: documented.has(name),
      };
    })
    .sort((a, b) => byText(a.name, b.name));

  return {
    vars,
    unreadInExample: example.filter((n) => !byName.has(n)),
    dynamicReads: dynamicReads.sort(byText),
    issues,
  };
}

export function renderEnv(facts: EnvFacts): string {
  const server = facts.vars.filter((v) => v.scope.includes('server'));
  const lines = [
    '# Environment variables',
    '',
    generatedNotice('every non-test file under `server/`, `shared/`, `scripts/`, `client/src/` and the root config files'),
    '',
    `${facts.vars.length} variables read; ${server.filter((v) => !v.inExample).length} of the ${server.length} the server reads are not in \`.env.example\`.`,
    '',
    'Scope: `server` = read under `server/` or `shared/`; `client` = `VITE_` variable baked in at build; `tooling` = scripts and config only.',
    '',
    '| Variable | Scope | In `.env.example` | Read by |',
    '|---|---|---|---|',
    ...facts.vars.map(
      (v) => `| \`${v.name}\` | ${v.scope.join(', ')} | ${v.inExample ? 'yes' : 'no'} | ${v.files.map((f) => `\`${cell(f)}\``).join(', ')} |`,
    ),
    '',
    '## In `.env.example` but read by no file',
    '',
    ...(facts.unreadInExample.length > 0 ? facts.unreadInExample.map((n) => `- \`${n}\``) : ['None.']),
    '',
    '## Files that read the environment through a variable',
    '',
    'These name no variable at the read, so the table above can only list the names written elsewhere in the same file.',
    '',
    ...(facts.dynamicReads.length > 0 ? facts.dynamicReads.map((f) => `- \`${f}\``) : ['None.']),
    '',
  ];
  return lines.join('\n');
}
