/**
 * Static inventory of every Express route: method, full path and the guards in front of it.
 *
 * Reads the source, never runs the server. Starts where the app does (server/index.ts and
 * server/routes.ts), follows each `app.use(prefix, [guards,] router)` into the router file,
 * and follows nested `router.use(prefix, router)`. Guard names come from what server/auth
 * exports, so a new guard cannot be missed silently.
 *
 * It fails loudly (an `issues` entry) rather than dropping a route: a mount it cannot
 * resolve, a router file nothing mounts, or a file whose route definitions it did not parse.
 */
import fs from 'node:fs';
import path from 'node:path';
import { byText, cell, generatedNotice } from './facts-common';
import { isTestFile, readText } from './source-files';

export type Access = 'public' | 'auth' | 'admin' | 'job';

export interface RouteFact {
  method: string;
  path: string;
  /** The file that defines the route. */
  file: string;
  /** Guards in front of it, outermost first: mount-level, then router-level, then inline. */
  guards: string[];
  access: Access;
}

export interface MountFact {
  prefix: string;
  file: string;
  guards: string[];
  routes: number;
}

export interface RouteFacts {
  routes: RouteFact[];
  mounts: MountFact[];
  /** Guards in server/auth that carry no access meaning of their own (they never block). */
  globalGuards: string[];
  guardNames: string[];
  issues: string[];
}

const AUTH_FILE = 'server/auth/index.ts';
const ROUTES_FILE = 'server/routes.ts';
const MAIN_FILE = 'server/index.ts';

/** What each guard exported by server/auth means for a caller. A guard missing here is an issue. */
const ACCESS_BY_GUARD: Record<string, Access | null> = {
  requireAuth: 'auth',
  requireAdmin: 'admin',
  requireJob: 'job',
  optionalAuth: null, // attaches a user when there is a token; never blocks
};
const ACCESS_RANK: Access[] = ['public', 'auth', 'admin', 'job'];
const METHODS = 'get|post|put|patch|delete|all';

interface ImportRef {
  file: string | null;
  /** The name the other file exports it under, or 'default'. */
  exported: string;
}

const exists = (root: string, rel: string): boolean => {
  try {
    return fs.statSync(path.join(root, rel)).isFile();
  } catch {
    return false;
  }
};

function resolveImport(root: string, fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec.replace(/\.js$/, '')));
  for (const candidate of [`${base}.ts`, `${base}/index.ts`, base]) if (exists(root, candidate)) return candidate;
  return null;
}

function parseImports(root: string, file: string, src: string): Map<string, ImportRef> {
  const map = new Map<string, ImportRef>();
  const re = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const [, def, named, spec] = m;
    const target = resolveImport(root, file, spec!);
    if (def) map.set(def, { file: target, exported: 'default' });
    if (named) {
      for (const part of named.split(',')) {
        const seg = part.trim().replace(/^type\s+/, '');
        if (!seg) continue;
        const [orig, alias] = seg.split(/\s+as\s+/).map((s) => s.trim());
        map.set(alias || orig!, { file: target, exported: orig! });
      }
    }
  }
  return map;
}

/** Names that hold a Router in this file: `router` plus any `const x = Router()`. */
function routerVars(src: string): string[] {
  const names = new Set(['router']);
  for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*(?::\s*[\w.]+)?\s*=\s*(?:express\.)?Router\(/g)) names.add(m[1]!);
  return [...names].sort();
}

/** Split on top-level commas, ignoring commas inside brackets and string literals. */
function splitArgs(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      current += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * The text of a route call's arguments up to the handler: stops at the first arrow
 * function, `function` or `async`, or at the call's closing paren. Guards sit before that.
 */
function argsBeforeHandler(src: string, from: number): string {
  let depth = 0;
  let quote: string | null = null;
  let out = '';
  for (let i = from; i < src.length && out.length < 600; i++) {
    const ch = src[i]!;
    if (quote) {
      out += ch;
      if (ch === '\n' && quote !== '`') quote = null;
      else if (ch === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    const startsWord = !/[\w$]/.test(src[i - 1] ?? ' ');
    if (startsWord && /^(?:async|function)\b/.test(src.slice(i, i + 9))) break;
    if (ch === '=' && src[i + 1] === '>') break;
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) {
      depth--;
      if (depth < 0) break;
    }
    out += ch;
  }
  return out;
}

/** Blank out comment lines (same length, so offsets hold): a doc comment may show an example route. */
const maskComments = (src: string): string => src.replace(/^[ \t]*(?:\*|\/\/|\/\*).*$/gm, (line) => ' '.repeat(line.length));

const bareName =(arg: string): string => arg.replace(/\([\s\S]*$/, '').trim();

export function collectRoutes(root: string, files: string[]): RouteFacts {
  const issues: string[] = [];
  const routes: RouteFact[] = [];
  const mounts: MountFact[] = [];
  const scanned = new Set<string>();
  /** Router files reached through a mount, with the router variables read in each. */
  const routerFiles = new Map<string, Set<string>>();

  /** The one router variable a mount refers to; null when it cannot be told apart (read them all). */
  const varsFor = (ref: ImportRef): string[] | null => {
    const src = maskComments(readText(root, ref.file!));
    const name = ref.exported === 'default' ? /export\s+default\s+(\w+)/.exec(src)?.[1] : ref.exported;
    return name && routerVars(src).includes(name) ? [name] : null;
  };

  // Guards: whatever server/auth exports as a RequestHandler.
  const guardNames = exists(root, AUTH_FILE)
    ? [...readText(root, AUTH_FILE).matchAll(/export const (\w+): RequestHandler\b/g)].map((m) => m[1]!)
    : [];
  if (guardNames.length === 0) issues.push(`${AUTH_FILE}: no exported RequestHandler guards found; the guard list cannot be derived`);
  for (const name of guardNames) {
    if (!(name in ACCESS_BY_GUARD)) {
      issues.push(`${AUTH_FILE}: guard ${name} has no entry in ACCESS_BY_GUARD (scripts/ci/facts-routes.ts); add what it means for a caller`);
    }
  }
  for (const name of Object.keys(ACCESS_BY_GUARD)) {
    if (guardNames.length > 0 && !guardNames.includes(name)) {
      issues.push(`scripts/ci/facts-routes.ts: ACCESS_BY_GUARD lists ${name}, which ${AUTH_FILE} no longer exports`);
    }
  }
  const GUARDS = new Set(guardNames);
  const guardsIn = (args: string[]): string[] => args.map(bareName).filter((a) => /^\w+$/.test(a) && GUARDS.has(a));

  const accessOf = (guards: string[]): Access => {
    let best = 0;
    for (const g of guards) {
      const access = ACCESS_BY_GUARD[g];
      if (access) best = Math.max(best, ACCESS_RANK.indexOf(access));
    }
    return ACCESS_RANK[best]!;
  };

  /**
   * Read one file's route definitions. `vars` are the identifiers that hold a router (or `app`).
   * When `followUses` is set, `router.use(prefix, other)` mounts are followed into `other`.
   */
  function scanFile(
    file: string,
    vars: string[] | null,
    prefixes: string[],
    mountGuards: string[],
    followUses: boolean,
    seen: Set<string>,
  ): number {
    const key = `${file}|${prefixes.join(',')}|${mountGuards.join(',')}|${vars?.join(',') ?? ''}`;
    if (seen.has(key)) return 0;
    seen.add(key);
    scanned.add(file);

    const src = maskComments(readText(root, file));
    const imports = parseImports(root, file, src);
    const names = vars ?? routerVars(src);
    if (followUses) {
      if (!routerFiles.has(file)) routerFiles.set(file, new Set());
      for (const n of names) routerFiles.get(file)!.add(n);
    }
    const alt = names.map((v) => v.replace(/\$/g, '\\$')).join('|');

    // File-level `router.use(guard)` applies to routes defined after it; `router.use(prefix, other)` nests.
    const fileGuards: Array<{ pos: number; guards: string[] }> = [];
    const nested: Array<{ pos: number; path: string; guards: string[]; ref: ImportRef }> = [];
    if (followUses) {
      for (const m of src.matchAll(new RegExp(`\\b(?:${alt})\\.use\\(([\\s\\S]*?)\\);`, 'g'))) {
        const args = splitArgs(m[1]!);
        if (args.length === 0) continue;
        const isPath = /^['"`]/.test(args[0]!);
        const rest = isPath ? args.slice(1) : args;
        const guards = guardsIn(rest);
        const routers = rest.filter((a) => /^\w+$/.test(a) && !GUARDS.has(a) && imports.get(a)?.file);
        if (routers.length > 0) {
          for (const r of routers) nested.push({ pos: m.index!, path: isPath ? args[0]!.slice(1, -1) : '', guards, ref: imports.get(r)! });
        } else if (!isPath && guards.length > 0) {
          fileGuards.push({ pos: m.index!, guards });
        }
      }
    }

    // Route definitions.
    const defRe = new RegExp(`\\b(?:${alt})\\.(${METHODS})\\(\\s*(['"\`])([^'"\`]*)\\2\\s*,`, 'g');
    const defs = [...src.matchAll(defRe)];
    const loose = [...src.matchAll(new RegExp(`\\b(?:${alt})\\.(?:${METHODS}|route)\\(`, 'g'))];
    if (loose.length !== defs.length) {
      issues.push(`${file}: ${loose.length} route call(s) but ${defs.length} parsed (a non-literal path or router.route()); extend scripts/ci/facts-routes.ts`);
    }
    for (const d of defs) {
      const pathPart = d[3]!;
      const inline = guardsIn(splitArgs(argsBeforeHandler(src, d.index! + d[0].length)));
      const before = fileGuards.filter((f) => f.pos < d.index!).flatMap((f) => f.guards);
      const guards = [...new Set([...mountGuards, ...before, ...inline])];
      for (const prefix of prefixes) {
        routes.push({
          method: d[1]!.toUpperCase(),
          path: (prefix + (pathPart === '/' ? '' : pathPart)).replace(/\/+/g, '/') || '/',
          file,
          guards,
          access: accessOf(guards),
        });
      }
    }

    let count = defs.length * prefixes.length;
    for (const n of nested) {
      const before = fileGuards.filter((f) => f.pos < n.pos).flatMap((f) => f.guards);
      count += scanFile(
        n.ref.file!,
        varsFor(n.ref),
        prefixes.map((p) => (p + n.path).replace(/\/+/g, '/')),
        [...mountGuards, ...before, ...n.guards],
        true,
        seen,
      );
    }
    return count;
  }

  const seen = new Set<string>();

  // 1. Routes registered straight on `app` in the server entry point (health checks).
  if (exists(root, MAIN_FILE)) scanFile(MAIN_FILE, ['app'], [''], [], false, seen);
  else issues.push(`${MAIN_FILE}: not found`);

  // 2. server/routes.ts: mounts, global guards and registrar functions called with `app`.
  const globalGuards: string[] = [];
  if (!exists(root, ROUTES_FILE)) {
    issues.push(`${ROUTES_FILE}: not found`);
  } else {
    const src = maskComments(readText(root, ROUTES_FILE));
    const imports = parseImports(root, ROUTES_FILE, src);
    scanFile(ROUTES_FILE, ['app'], [''], [], false, seen);

    for (const m of src.matchAll(/\bapp\.use\(([^;]*?)\);/g)) {
      const args = splitArgs(m[1]!);
      if (args.length === 0) continue;
      if (/^['"`]/.test(args[0]!)) {
        const prefix = args[0]!.slice(1, -1);
        const routerVar = args[args.length - 1]!;
        const ref = imports.get(routerVar);
        if (!ref?.file || args.length < 2) {
          issues.push(`${ROUTES_FILE}: cannot resolve the router for app.use("${prefix}", ${args.slice(1).join(', ')})`);
          continue;
        }
        const guards = guardsIn(args.slice(1, -1));
        const count = scanFile(ref.file, varsFor(ref), [prefix], guards, true, seen);
        mounts.push({ prefix, file: ref.file, guards, routes: count });
      } else {
        for (const g of guardsIn(args)) if (!globalGuards.includes(g)) globalGuards.push(g);
      }
    }
    for (const m of src.matchAll(/\b(\w+)\(\s*app\s*\)/g)) {
      const file = imports.get(m[1]!)?.file;
      if (file) scanFile(file, ['app'], [''], [], false, seen);
    }
  }

  // 3a. Cross-check: a mounted file's other routers (a second `Router()` nobody mounts).
  for (const [file, read] of routerFiles) {
    const src = maskComments(readText(root, file));
    for (const name of routerVars(src)) {
      if (read.has(name)) continue;
      const calls = [...src.matchAll(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\.(?:${METHODS}|route)\\(`, 'g'))].length;
      if (calls > 0) issues.push(`${file}: router ${name} has ${calls} route call(s) but no mount reaches it`);
    }
  }

  // 3b. Cross-check: no server file defines routes that the walk above never reached.
  for (const file of files) {
    if (!file.startsWith('server/') || !file.endsWith('.ts') || isTestFile(file) || scanned.has(file)) continue;
    const src = maskComments(readText(root, file));
    const names = [...new Set(['app', ...routerVars(src)])].join('|');
    const found = [...src.matchAll(new RegExp(`\\b(?:${names})\\.(?:${METHODS}|route)\\(`, 'g'))].length;
    if (found > 0) issues.push(`${file}: ${found} route call(s) that no mount in ${ROUTES_FILE} reaches`);
  }

  routes.sort((a, b) => byText(a.path, b.path) || byText(a.method, b.method) || byText(a.file, b.file));
  mounts.sort((a, b) => byText(a.prefix, b.prefix));
  return { routes, mounts, globalGuards, guardNames, issues };
}

export function renderRoutes(facts: RouteFacts): string {
  const { routes, mounts, globalGuards, guardNames } = facts;
  const count = (access: Access): number => routes.filter((r) => r.access === access).length;
  const mutating = routes.filter((r) => r.method !== 'GET');
  const lines = [
    '# HTTP routes',
    '',
    generatedNotice(`${MAIN_FILE}, ${ROUTES_FILE} and every router mounted from them`),
    '',
    `Guards (exported by \`${AUTH_FILE}\`): ${guardNames.map((g) => `\`${g}\``).join(', ')}.`,
    '',
    globalGuards.length > 0
      ? `Applied to every route mounted from \`${ROUTES_FILE}\`: ${globalGuards.map((g) => `\`${g}\``).join(', ')}. It never blocks, so it is not repeated per route.`
      : `No guard is applied globally in \`${ROUTES_FILE}\`.`,
    '',
    'Access: `public` = no blocking guard; `auth` = `requireAuth`; `admin` = `requireAdmin`; `job` = `requireJob` (the job secret, or an admin).',
    '',
    '## Summary',
    '',
    `- Routes: ${routes.length}`,
    `- By access: public ${count('public')}, auth ${count('auth')}, admin ${count('admin')}, job ${count('job')}`,
    `- Routes that change state (not GET): ${mutating.length}, of which public: ${mutating.filter((r) => r.access === 'public').length}`,
    '',
    '## Mounts',
    '',
    '| Prefix | Router file | Mount guards | Routes |',
    '|---|---|---|---|',
    ...mounts.map((m) => `| \`${m.prefix}\` | \`${m.file}\` | ${m.guards.map((g) => `\`${g}\``).join(', ') || '—'} | ${m.routes} |`),
    '',
    '## Routes',
    '',
    '| Method | Path | Access | Guards | Defined in |',
    '|---|---|---|---|---|',
    ...routes.map(
      (r) => `| ${r.method} | \`${cell(r.path)}\` | ${r.access} | ${r.guards.map((g) => `\`${g}\``).join(', ') || '—'} | \`${r.file}\` |`,
    ),
    '',
  ];
  return lines.join('\n');
}
