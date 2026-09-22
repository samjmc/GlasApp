/**
 * The invariant: every route that changes something is behind a guard.
 *
 * This is a static read of the route files, not a running server, so it cannot be
 * satisfied by mocks and does not rot when a handler's internals change. It replaces
 * `auth-bypass-prevention.test.ts`, which simulated the Replit dev bypass and asserted
 * that an unauthenticated caller SHOULD be accepted in development — behaviour this
 * rebuild deleted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(SERVER, 'routes');
const GUARDS = ['requireAuth', 'requireAdmin', 'requireJob', 'optionalAuth'];

/**
 * Routes that change state but are deliberately open. Each needs a reason, and the
 * reason has to be about the caller not needing an account — not about it being
 * inconvenient to fix.
 */
const PUBLIC_WRITES: Array<{ file: string; path: string; why: string }> = [
  { file: '../routes.ts', path: '/api/quiz-results', why: 'anonymous visitors can take the quiz' },
  { file: '../routes.ts', path: '/api/multidimensional-quiz-results', why: 'anonymous visitors can take the quiz' },
  { file: 'chatRoutes.ts', path: '/', why: 'public assistant; rate limited' },
  { file: 'politicianChatRoutes.ts', path: '/politician', why: 'public assistant; rate limited' },
  { file: 'politicianChatRoutes.ts', path: '/feedback', why: 'feedback on a public answer' },
  { file: 'ai/analysis.ts', path: '/complete-analysis', why: 'public quiz analysis; rate limited' },
  { file: 'ai/analysis.ts', path: '/context-analysis', why: 'public quiz analysis; rate limited' },
  { file: 'ai/analysis.ts', path: '/explanation', why: 'public quiz analysis; rate limited' },
  { file: 'ai/analysis.ts', path: '/analyze-text', why: 'public quiz analysis; rate limited' },
  { file: 'ai/analysis.ts', path: '/analyze-bulk', why: 'public quiz analysis; rate limited' },
  { file: 'quiz/index.ts', path: '/assistant', why: 'public quiz assistant; rate limited' },
  { file: 'storytellingRoutes.ts', path: '/:constituencyName', why: 'public constituency story cache' },
  { file: 'regionRoutes.ts', path: '/select', why: 'anonymous visitors choose a region' },
  { file: 'political/parties.ts', path: '/matches', why: 'POST only because the quiz dimensions are a body; it computes and writes nothing' },
];

/**
 * Routers guarded where they are mounted in routes.ts, e.g.
 * `app.use("/api/admin/x", requireJob, router)`. The guard is real but lives outside
 * the router file, so the per-file scan cannot see it.
 */
function mountGuardedRouters(): Set<string> {
  const src = fs.readFileSync(path.join(SERVER, 'routes.ts'), 'utf8');
  const imports = new Map<string, string>();
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+["']\.\/routes\/([^"']+)["']/g)) {
    imports.set(m[1], m[2].replace(/\.js$/, ''));
  }
  const guarded = new Set<string>();
  for (const m of src.matchAll(/app\.use\(\s*["'][^"']+["']\s*,\s*([^)]+)\)/g)) {
    const args = m[1].split(',').map((a) => a.trim());
    if (!args.some((a) => GUARDS.includes(a))) continue;
    for (const a of args) {
      const file = imports.get(a);
      if (file) guarded.add(file.endsWith('.ts') ? file : `${file}.ts`);
    }
  }
  return guarded;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

interface Route {
  file: string;
  method: string;
  path: string;
  guarded: boolean;
}

/** Every `router.<method>('path', ...)` and `app.<method>('path', ...)` in a file. */
function routesIn(file: string): Route[] {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROUTES_DIR, file).replace(/\\/g, '/');
  const found: Route[] = [];
  // Guards applied to a whole router at mount time, e.g. router.use(requireJob).
  const mountGuard = GUARDS.some((g) => new RegExp(`\\.use\\(\\s*${g}\\b`).test(src));

  const re = /\b(?:router|app)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]*)\2\s*,([\s\S]{0,200}?)(?:async|\(\s*req|function|\breq\b\s*[,)=])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [, method, , routePath, between] = m;
    found.push({
      file: rel,
      method: method.toUpperCase(),
      path: routePath,
      guarded: mountGuard || GUARDS.some((g) => new RegExp(`\\b${g}\\b`).test(between)),
    });
  }
  return found;
}

const MOUNT_GUARDED = mountGuardedRouters();
const allRoutes = walk(ROUTES_DIR)
  .flatMap(routesIn)
  .map((r) => {
    // `admin/foo.ts` is guarded when routes.ts mounts it behind a guard; so is
    // `admin/foo/index.ts` when the directory itself is mounted that way.
    const asDir = r.file.replace(/\/index\.ts$/, '');
    return MOUNT_GUARDED.has(r.file) || MOUNT_GUARDED.has(asDir) || MOUNT_GUARDED.has(`${asDir}.ts`)
      ? { ...r, guarded: true }
      : r;
  })
  .concat(routesIn(path.join(SERVER, 'routes.ts')));

describe('route guard coverage', () => {
  it('finds routes to check (a scan that matched nothing would pass vacuously)', () => {
    expect(allRoutes.length).toBeGreaterThan(80);
    expect(allRoutes.filter((r) => r.method !== 'GET').length).toBeGreaterThan(20);
  });

  it('every mutating route is guarded or on the public allowlist, with a reason', () => {
    const allowed = new Set(PUBLIC_WRITES.map((p) => `${p.file} ${p.path}`));
    const unguarded = allRoutes
      .filter((r) => r.method !== 'GET' && !r.guarded)
      .filter((r) => !allowed.has(`${r.file} ${r.path}`))
      .map((r) => `${r.method} ${r.path}  (${r.file})`);

    expect(unguarded, `Unguarded mutating routes:\n${unguarded.join('\n')}`).toEqual([]);
  });

  it('the public allowlist has no stale entries', () => {
    const real = new Set(allRoutes.map((r) => `${r.file} ${r.path}`));
    const stale = PUBLIC_WRITES.filter((p) => !real.has(`${p.file} ${p.path}`)).map((p) => `${p.file} ${p.path}`);
    expect(stale, `Allowlisted routes that no longer exist:\n${stale.join('\n')}`).toEqual([]);
  });

  it('every allowlist entry explains itself', () => {
    for (const entry of PUBLIC_WRITES) expect(entry.why.length).toBeGreaterThan(10);
  });
});

describe('no second identity source', () => {
  const serverFiles = walk(SERVER).filter((f) => !f.includes(`${path.sep}auth${path.sep}`));

  it('nothing reads an express session', () => {
    const offenders = serverFiles.filter((f) => /req\.session/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SERVER, f)), 'Session auth was removed').toEqual([]);
  });

  it('nothing reads Replit OIDC claims', () => {
    const offenders = serverFiles.filter((f) => /claims\??\.\s*sub/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SERVER, f)), 'Replit auth was removed').toEqual([]);
  });

  it('no code fabricates a development identity', () => {
    const offenders = serverFiles.filter((f) => /dev-user-\d+/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SERVER, f))).toEqual([]);
  });

  it('no handler takes a user id from the request body', () => {
    const offenders: string[] = [];
    for (const f of serverFiles) {
      const src = fs.readFileSync(f, 'utf8');
      if (/req\.body\.userId|userId:\s*z\.(number|string)\(\)/.test(src)) offenders.push(path.relative(SERVER, f));
    }
    expect(offenders, 'Identity comes from the verified token, never the payload').toEqual([]);
  });
});
