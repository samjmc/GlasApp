import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { envReadsIn, exampleNames } from './facts-env';
import { firstDocLine } from './facts-jobs';
import { collectRoutes } from './facts-routes';
import { buildFacts, ensureFacts } from './generate-facts';
import { listFiles } from './source-files';

const ROOT = path.resolve(__dirname, '..', '..');
const made: string[] = [];
afterAll(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function repo(files: Record<string, string>): { root: string; files: string[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facts-'));
  made.push(root);
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return { root, files: listFiles(root, { useGit: false }) };
}

// Built from parts so this file never spells a full environment read.
const ENV = `${'process'}${'.env'}`;

const AUTH = `
export const requireAuth: RequestHandler = async () => {};
export const optionalAuth: RequestHandler = async () => {};
export const requireAdmin: RequestHandler = async () => {};
export const requireJob: RequestHandler = async () => {};
`;

const APP = {
  'server/auth/index.ts': AUTH,
  'server/index.ts': "app.get('/health', (req, res) => { res.send('ok'); });\n",
  'server/routes.ts': `
import { optionalAuth, requireJob } from './auth';
import itemsRouter from './routes/items';
import jobsRouter from './routes/jobs';
import { aRouter, bRouter } from './two/routes';
export async function registerRoutes(app) {
  app.use(optionalAuth);
  app.use('/api/items', itemsRouter);
  app.use('/api/jobs', requireJob, jobsRouter);
  app.use('/api/a', aRouter);
  app.use('/api/b', bRouter);
}
`,
  'server/routes/items.ts': `
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth';
const router = Router();
/**
 * Example in a comment:
 *   router.get('/commented', handler)
 */
router.get('/', (req, res) => {});
router.post('/', requireAuth, async (req, res) => {});
router.delete('/:id', requireAuth, requireAdmin, removeItem);
export default router;
`,
  'server/routes/jobs.ts': `
import { Router } from 'express';
import { requireAdmin } from '../auth';
const router = Router();
router.use(requireAdmin);
router.post('/run', async (req, res) => {});
export default router;
`,
  'server/two/routes.ts': `
import { Router } from 'express';
export const aRouter = Router();
export const bRouter = Router();
aRouter.get('/x', (req, res) => {});
bRouter.get('/y', (req, res) => {});
`,
};

const rows = (root: string, files: string[]) =>
  collectRoutes(root, files).routes.map((r) => `${r.method} ${r.path} ${r.access} [${r.guards.join(',')}]`);

describe('route inventory', () => {
  it('finds each route once, with mount, router-level and inline guards', () => {
    const { root, files } = repo(APP);
    expect(collectRoutes(root, files).issues).toEqual([]);
    expect(rows(root, files)).toEqual([
      'GET /api/a/x public []',
      'GET /api/b/y public []',
      'GET /api/items public []',
      'POST /api/items auth [requireAuth]',
      'DELETE /api/items/:id admin [requireAuth,requireAdmin]',
      'POST /api/jobs/run job [requireJob,requireAdmin]',
      'GET /health public []',
    ]);
  });

  it('does not count an example route in a doc comment', () => {
    const { root, files } = repo(APP);
    expect(rows(root, files).join('\n')).not.toMatch(/commented/);
  });

  it('mounts one router of a two-router file without the other', () => {
    const { root, files } = repo(APP);
    const paths = collectRoutes(root, files).routes.map((r) => r.path);
    expect(paths).not.toContain('/api/a/y');
    expect(paths).not.toContain('/api/b/x');
  });

  it('reports a router file that nothing mounts', () => {
    const { root, files } = repo({ ...APP, 'server/orphan.ts': "const router = Router();\nrouter.get('/z', (req, res) => {});\n" });
    expect(collectRoutes(root, files).issues).toEqual(['server/orphan.ts: 1 route call(s) that no mount in server/routes.ts reaches']);
  });

  it('reports a second router in a mounted file that nothing mounts', () => {
    const { root, files } = repo({
      ...APP,
      'server/routes.ts': APP['server/routes.ts'].replace("  app.use('/api/b', bRouter);\n", ''),
    });
    expect(collectRoutes(root, files).issues).toEqual(['server/two/routes.ts: router bRouter has 1 route call(s) but no mount reaches it']);
  });

  it('reports a mount it cannot resolve instead of dropping its routes', () => {
    const { root, files } = repo({
      ...APP,
      'server/routes.ts': APP['server/routes.ts'].replace("app.use('/api/a', aRouter);", "app.use('/api/a', makeRouter());"),
    });
    expect(collectRoutes(root, files).issues.join('\n')).toMatch(/cannot resolve the router for app\.use\("\/api\/a"/);
  });

  it('reports a route call whose path it cannot read', () => {
    const { root, files } = repo({
      ...APP,
      'server/routes/items.ts': APP['server/routes/items.ts'] + "router.get(PATH, (req, res) => {});\n",
    });
    expect(collectRoutes(root, files).issues.join('\n')).toMatch(/server\/routes\/items\.ts: 4 route call\(s\) but 3 parsed/);
  });

  it('reports a new guard in server/auth that it does not know the meaning of', () => {
    const { root, files } = repo({ ...APP, 'server/auth/index.ts': AUTH + 'export const requireStaff: RequestHandler = async () => {};\n' });
    expect(collectRoutes(root, files).issues.join('\n')).toMatch(/guard requireStaff has no entry in ACCESS_BY_GUARD/);
  });

  it('reports a guard it still knows that server/auth stopped exporting', () => {
    const { root, files } = repo({ ...APP, 'server/auth/index.ts': AUTH.replace(/export const requireJob.*\n/, '') });
    expect(collectRoutes(root, files).issues.join('\n')).toMatch(/lists requireJob, which server\/auth\/index\.ts no longer exports/);
  });

  it('finds the real app routes, with the real guards', () => {
    const facts = collectRoutes(ROOT, listFiles(ROOT));
    expect(facts.issues).toEqual([]);
    const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;
    const byKey = new Map(facts.routes.map((r) => [key(r), r]));
    // A scan that matched nothing would pass; these pin it to the routes the app mounts.
    expect(facts.routes.length).toBeGreaterThan(70);
    expect(byKey.get('GET /health')?.access).toBe('public');
    expect(byKey.get('GET /api/auth/health')?.access).toBe('public');
    expect(byKey.get('POST /api/pledges')?.access).toBe('admin');
    expect(byKey.get('POST /api/cache/clear')?.access).toBe('job');
    expect(byKey.get('POST /api/daily-session/complete')?.access).toBe('auth');
    // The two voting routers share one file and must not leak into each other's prefix.
    expect(byKey.has('POST /api/votes/complete')).toBe(false);
    expect(facts.guardNames.sort()).toEqual(['optionalAuth', 'requireAdmin', 'requireAuth', 'requireJob']);
  });
});

describe('job facts', () => {
  it('reads the first line of a block comment, a // run and a # run', () => {
    expect(firstDocLine('/**\n * Rebuild the scores.\n * More.\n */\nimport x from "y";')).toBe('Rebuild the scores.');
    expect(firstDocLine('// Sync the roster.\n// More.\nimport x from "y";')).toBe('Sync the roster.');
    expect(firstDocLine('#!/usr/bin/env bash\n# Check git safety.\nset -e\n')).toBe('Check git safety.');
    expect(firstDocLine('import x from "y";\n')).toBe('');
  });
});

describe('env facts', () => {
  it('reads dot, bracket, destructured, injected and VITE reads, and notes dynamic ones', () => {
    const src = [
      `const a = ${ENV}.ALPHA;`,
      `const b = ${ENV}['BETA'];`,
      `const { GAMMA, DELTA: d = 1 } = ${ENV};`,
      `function f(env: NodeJS.ProcessEnv) { return env.EPSILON + env['ZETA']; }`,
      `const v = import.meta.env.VITE_ETA;`,
      `const dyn = ${ENV}[key];`,
    ].join('\n');
    const { names, dynamic } = envReadsIn(src);
    expect(names.sort()).toEqual(['ALPHA', 'BETA', 'DELTA', 'EPSILON', 'GAMMA', 'VITE_ETA', 'ZETA']);
    expect(dynamic).toBe(true);
  });

  it('does not read `env.X` in a file that takes no environment', () => {
    expect(envReadsIn('const s = config.env.NOPE + env.ALSO_NOT;').names).toEqual([]);
  });

  it('does not read lower-case or built-in import.meta.env names', () => {
    expect(envReadsIn(`${ENV}.npm_package_version; import.meta.env.DEV;`).names).toEqual([]);
  });

  it('lists names in .env.example, commented out or not, and no prose', () => {
    expect(exampleNames('# Copy to .env\nFOO=1\n# BAR=\n  BAZ=x # note\nnot_a_var=1\n')).toEqual(['BAR', 'BAZ', 'FOO']);
  });
});

describe('generated facts files', () => {
  const FIXTURE = {
    ...APP,
    'package.json': JSON.stringify({ scripts: { 'job:run': 'tsx server/jobs/run.ts', build: 'vite build' } }),
    'server/jobs/run.ts': '/**\n * Run the job.\n */\nexport {};\n',
    '.env.example': 'SUPABASE_URL=\n',
    'server/env.ts': `export const url = ${ENV}.SUPABASE_URL;\n`,
  };

  it('writes the three files, then --check passes', async () => {
    const { root, files } = repo(FIXTURE);
    expect(await ensureFacts(root, false, files)).toEqual([]);
    for (const name of ['routes.md', 'jobs.md', 'env.md']) {
      const text = fs.readFileSync(path.join(root, 'docs/generated', name), 'utf8');
      expect(text).toContain('Generated by `npm run facts` — do not edit');
    }
    expect(await ensureFacts(root, true, files)).toEqual([]);
  });

  it('is deterministic: two runs give the same bytes', () => {
    const { root, files } = repo(FIXTURE);
    const a = buildFacts(root, files).files;
    const b = buildFacts(root, files).files;
    expect([...a]).toEqual([...b]);
  });

  it('--check fails when a generated file is edited by hand, and says how to regenerate', async () => {
    const { root, files } = repo(FIXTURE);
    await ensureFacts(root, false, files);
    const target = path.join(root, 'docs/generated/jobs.md');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8') + 'hand edit\n');
    const problems = await ensureFacts(root, true, files);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/jobs\.md is missing or stale\. Run `npm run facts`/);
  });

  it('--check fails when a generated file is missing', async () => {
    const { root, files } = repo(FIXTURE);
    await ensureFacts(root, false, files);
    fs.rmSync(path.join(root, 'docs/generated/env.md'));
    expect((await ensureFacts(root, true, files))[0]).toMatch(/env\.md is missing or stale/);
  });

  it('--check fails when a route is added and the facts are not regenerated', async () => {
    const { root, files } = repo(FIXTURE);
    await ensureFacts(root, false, files);
    fs.appendFileSync(path.join(root, 'server/routes/items.ts'), "router.put('/:id', requireAuth, async (req, res) => {});\n");
    const problems = await ensureFacts(root, true, files);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/routes\.md is missing or stale/);
  });

  it('--check fails when a file is left in the folder that no generator produces', async () => {
    const { root, files } = repo(FIXTURE);
    await ensureFacts(root, false, files);
    fs.writeFileSync(path.join(root, 'docs/generated/old.md'), 'leftover\n');
    expect((await ensureFacts(root, true, files))[0]).toMatch(/old\.md is not produced by any generator/);
  });

  it('refuses to write anything when a generator could not resolve something', async () => {
    const { root, files } = repo({ ...FIXTURE, 'server/orphan.ts': "const router = Router();\nrouter.get('/z', () => {});\n" });
    const problems = await ensureFacts(root, false, files);
    expect(problems[0]).toMatch(/cannot generate facts: server\/orphan\.ts/);
    expect(fs.existsSync(path.join(root, 'docs/generated'))).toBe(false);
  });

  it('reports a package.json script that runs a file that is not there', async () => {
    const { root, files } = repo({ ...FIXTURE, 'package.json': JSON.stringify({ scripts: { ghost: 'tsx server/jobs/ghost.ts' } }) });
    expect((await ensureFacts(root, false, files))[0]).toMatch(/script "ghost" runs server\/jobs\/ghost\.ts, which does not exist/);
  });
});
