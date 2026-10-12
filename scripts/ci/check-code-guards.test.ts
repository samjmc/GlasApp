import { describe, expect, it } from 'vitest';
import { RULES, deadRules, findViolations, report, stripComments, type Rule } from './check-code-guards';

const rule = (fragment: string): Rule => {
  const found = RULES.filter((r) => r.label.includes(fragment));
  if (found.length !== 1) throw new Error(`expected exactly one rule matching "${fragment}", got ${found.length}`);
  return found[0];
};

/** Lines (as file:line) the single rule reports for one sample file. */
const hits = (fragment: string, filePath: string, content: string) =>
  findViolations([{ path: filePath, content }], [rule(fragment)]).map((v) => v.where);

// Each row: the rule, a path in its scope, a sample it must flag (on the given line), and one it must not.
const CASES: Array<{ name: string; fragment: string; path: string; bad: string; badLine: number; clean: string }> = [
  {
    name: 'regex dotAll flag',
    fragment: 'dotAll',
    path: 'server/x.test.ts',
    bad: 'const ok = 1;\nexpect(fn).toThrow(/cannot filter.*stored grain/s);\n',
    badLine: 2,
    clean: 'expect(fn).toThrow(/cannot filter[\\s\\S]*stored grain/);\nconst r = /a/gi;\n',
  },
  {
    name: 'Math.random in server code',
    fragment: 'Math.random',
    path: 'server/auth/code.ts',
    bad: 'export const code = () => String(Math.floor(Math.random() * 1e6));\n',
    badLine: 1,
    clean: "import { randomInt } from 'node:crypto';\nexport const code = () => String(randomInt(1e6));\n",
  },
  {
    name: 'pino-http outside httpLogger',
    fragment: 'pino-http',
    path: 'server/app.ts',
    bad: "import pinoHttp from 'pino-http';\napp.use(pinoHttp({ logger }));\n",
    badLine: 2,
    clean: "import { httpLogger } from './utils/httpLogger';\napp.use(httpLogger);\n",
  },
  {
    name: 'log call printing the URL or headers',
    fragment: 'log call',
    path: 'server/routes/x.ts',
    bad: 'try {\n} catch (e) {\n  console.error(`[x] ${req.method} ${req.originalUrl} failed`, e);\n}\n',
    badLine: 3,
    clean: 'console.error(`[x] ${req.method} ${req.path} failed`, e);\nconst host = req.headers.host;\n',
  },
  {
    name: 'deleted identity source',
    fragment: 'deleted identity',
    path: 'server/routes/x.ts',
    bad: 'const id = (req as any).session?.userId ?? null;\n',
    badLine: 1,
    clean: 'const id = req.user?.id ?? null;\nconst c = { session: 1 };\n',
  },
  {
    name: 'raw HTML sink in the client',
    fragment: 'raw HTML sink',
    path: 'client/src/components/X.tsx',
    bad: 'export const X = () => <div dangerouslySetInnerHTML={{ __html: html }} />;\n',
    badLine: 1,
    clean: 'export const X = () => <div>{text}</div>;\n',
  },
  {
    name: 'bare fetch in server/news',
    fragment: 'bare fetch',
    path: 'server/news/page.ts',
    bad: 'const res = await fetch(articleUrl);\n',
    badLine: 1,
    clean: "const res = await safeFetch(articleUrl);\nconst r = await globalThis.fetch ? 1 : 0;\n",
  },
  {
    name: 'anon key outside supabase.ts',
    fragment: 'SUPABASE_ANON_KEY',
    path: 'server/db.ts',
    bad: "const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;\n",
    badLine: 1,
    clean: "import { serviceRoleKey } from './auth/supabase';\nconst key = serviceRoleKey(env);\n",
  },
];

describe('code guards: each rule can fail and can pass', () => {
  it('covers every rule', () => {
    expect(CASES.map((c) => rule(c.fragment)).sort((a, b) => a.label.localeCompare(b.label))).toEqual(
      [...RULES].sort((a, b) => a.label.localeCompare(b.label)),
    );
  });

  for (const c of CASES) {
    it(`${c.name}: flags the offending sample at the right line`, () => {
      expect(hits(c.fragment, c.path, c.bad)).toEqual([`${c.path}:${c.badLine}`]);
    });

    it(`${c.name}: passes the clean sample`, () => {
      expect(hits(c.fragment, c.path, c.clean)).toEqual([]);
    });

    it(`${c.name}: ignores the offending text inside a comment`, () => {
      const commented = c.bad
        .split('\n')
        .map((line) => (line ? `// ${line}` : line))
        .join('\n');
      expect(hits(c.fragment, c.path, commented)).toEqual([]);
      expect(hits(c.fragment, c.path, `/*\n${c.bad}*/\n`)).toEqual([]);
    });
  }

  it('a rule only looks at files in its scope', () => {
    expect(hits('Math.random', 'client/src/lib/utils.ts', 'const n = Math.random();\n')).toEqual([]);
    expect(hits('Math.random', 'server/x.test.ts', 'const n = Math.random();\n')).toEqual([]);
    expect(hits('raw HTML sink', 'server/x.ts', 'el.innerHTML = html;\n')).toEqual([]);
  });

  it('an allowlisted file is skipped, and only that file', () => {
    const allowed = Object.keys(rule('Math.random').allow)[0];
    expect(hits('Math.random', allowed, 'const n = Math.random();\n')).toEqual([]);
    expect(hits('Math.random', 'server/other.ts', 'const n = Math.random();\n')).toHaveLength(1);
  });

  it('reports every violation, grouped by rule, with the fix named', () => {
    const out = report(
      findViolations(
        [
          { path: 'server/a.ts', content: 'Math.random();\nMath.random();\n' },
          { path: 'server/b.ts', content: 'Math.random();\n' },
        ],
        [rule('Math.random')],
      ),
    );
    expect(out).toContain('Math.random() in server code (use crypto.randomInt');
    expect(out).toContain('  server/a.ts:1\n  server/a.ts:2\n  server/b.ts:1');
  });
});

describe('dotAll flag: matches regex literals, not division or strings', () => {
  const flagged = (src: string) => hits('dotAll', 'server/x.ts', src).length;

  it.each([
    ['assignment', 'const re = /a.b/s;'],
    ['with other flags', 'const re = /a.b/gis;'],
    ['call argument', 'text.replace(/<!--.*?-->/gs, "");'],
    ['class containing a slash', 'const re = /[/]x.y/s;'],
    ['return', 'return /x.y/s.test(v);'],
    ['RegExp constructor', 'new RegExp("a.b", "s");'],
  ])('flags %s', (_name, src) => {
    expect(flagged(src)).toBe(1);
  });

  it.each([
    ['plain regex', 'const re = /a.b/g;'],
    ['regex with s in the body only', 'const re = /sss/g;'],
    ['division', 'const ratio = total / count / size;'],
    ['division by identifier starting with s', 'const r = a / b / s;'],
    ['path string', 'const p = "api/users/s";'],
    ['url string', 'const u = "https://example.ie/a/s";'],
    ['RegExp constructor without s', 'new RegExp("a.b", "gi");'],
  ])('does not flag %s', (_name, src) => {
    expect(flagged(src)).toBe(0);
  });
});

describe('stripComments', () => {
  it('blanks comments but keeps line numbers', () => {
    const src = 'a;\n/* one\ntwo */\nb; // tail\n// whole line\nc;';
    const out = stripComments(src);
    expect(out.split('\n')).toHaveLength(src.split('\n').length);
    expect(out).not.toContain('one');
    expect(out).not.toContain('tail');
    expect(out).not.toContain('whole');
    expect(out).toContain('c;');
  });

  it('keeps a URL, which has // inside a string', () => {
    expect(stripComments('const u = "https://example.ie";')).toContain('https://example.ie');
  });
});

describe('rule table', () => {
  it('every allowlist entry gives a reason', () => {
    for (const r of RULES) {
      for (const [file, why] of Object.entries(r.allow)) {
        expect(why.length, `${r.label}: ${file}`).toBeGreaterThan(15);
      }
    }
  });

  it('every pattern has the g flag, or matchAll throws', () => {
    for (const r of RULES) expect(r.pattern.global, r.label).toBe(true);
  });

  it('a rule whose scope matches nothing is reported as dead', () => {
    expect(deadRules([{ path: 'README.ts', content: '' }], [rule('Math.random')])).toHaveLength(1);
    expect(deadRules([{ path: 'server/a.ts', content: '' }], [rule('Math.random')])).toHaveLength(0);
  });
});
