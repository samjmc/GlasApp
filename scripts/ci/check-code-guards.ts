/**
 * Code guards. Each "never do X" rule is one regex over tracked source files, with comments
 * stripped, an allowlist of files that carry a reason, and a failure message that names the fix.
 * It turns a rule that lives in prose into a check CI enforces.
 *
 *   npx tsx scripts/ci/check-code-guards.ts
 *
 * Adding a rule: write the regex, run the script, and either fix every hit or allowlist the file
 * with a one-line reason. Never narrow the regex until it stops matching a real violation.
 * An allowlist entry whose file no longer matches its rule fails the check, so lists only shrink.
 *
 * Known limits: a regex cannot tell a string from code, so a banned pattern inside a string
 * literal is reported (allowlist it), and a line comment starting right after a quote is not
 * stripped. The script skips its own files, which name every banned pattern on purpose.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface SourceFile {
  path: string;
  content: string;
}

export interface Rule {
  label: string;
  fix: string;
  scope: (filePath: string) => boolean;
  /** Needs the `g` flag. */
  pattern: RegExp;
  /** File path -> why that file may match. */
  allow: Record<string, string>;
}

export interface Violation {
  rule: Rule;
  /** `file:line` */
  where: string;
}

const isTest = (p: string) => /\.test\.tsx?$/.test(p);
const inServer = (p: string) => p.startsWith('server/') && !isTest(p);
const inClient = (p: string) => p.startsWith('client/src/') && !isTest(p);

export const RULES: Rule[] = [
  // coding-discipline.md section 6. tsconfig targets a runtime where the `s` flag is a compile
  // error, and tsconfig excludes **.test.ts, so tsc never sees a test that uses it: vitest runs
  // it green. Scans tests for that reason.
  {
    label: 'regex dotAll (s) flag',
    fix: '[\\s\\S] in place of . with the flag',
    scope: () => true,
    pattern:
      /(?:^|[(,=:[!&|?{};]|\breturn|\bcase)\s*\/(?![/*])(?:[^/\\[\n]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimuvy]*s[dgimuvy]*(?![\w$])|\bnew\s+RegExp\([^)]*?,\s*['"`][dgimuvy]*s[dgimuvy]*['"`]\s*\)/gm,
    allow: {},
  },

  // 857901d: phone verification codes were drawn with Math.random. Anything a caller must not
  // be able to guess comes from node:crypto (randomInt, randomBytes).
  {
    label: 'Math.random() in server code',
    fix: 'crypto.randomInt / randomBytes (allowlist the file only with the reason it is not secret)',
    scope: inServer,
    pattern: /\bMath\.random\s*\(/g,
    allow: {
      'server/services/adaptiveScoringEngine.ts': 'simulateScoreDistribution draws simulated votes for a what-if; nothing secret',
      'server/services/aiService.ts': 'retry backoff jitter',
    },
  },

  // #159 (90facf7): pino-http's default request serializer logs the whole URL and every header. A
  // password-reset link (?token_hash=) and an OAuth return (?code=) carry one-time credentials in
  // the query, so anyone reading the logs could redeem them.
  {
    label: 'pino-http configured outside server/utils/httpLogger.ts',
    fix: 'createHttpLogger from server/utils/httpLogger.ts, which logs the path only',
    scope: inServer,
    pattern: /\bpinoHttp\s*[<(]/g,
    allow: {
      'server/utils/httpLogger.ts': 'the one place the request log is configured',
    },
  },

  // Same bug, hand-written form: a log call that prints the full URL (query included) or headers.
  {
    label: 'log call prints req.originalUrl / req.url / req.headers',
    fix: 'req.path (no query string), and never the header object',
    scope: inServer,
    pattern:
      /(?:console\.\w+|\blog(?:ger)?\.\w+|requestLogger\([^)]*\)\.\w+)\([^;]{0,160}?\breq\.(?:originalUrl|url|headers|rawHeaders)\b/g,
    allow: {
      'server/pledges/routes.ts': 'console.error of a failed pledges request; these routes carry no credential in the query',
      'server/voting/routes.ts': 'console.error of a failed voting request; these routes carry no credential in the query',
    },
  },

  // The auth rebuild (docs/auth.md, 6f4c0cc) deleted session auth, Replit auth and the fabricated
  // dev identity. Identity is req.user.id from server/auth/. A read of any of the old shapes
  // returns undefined and silently degrades to "anonymous".
  {
    label: 'read of a deleted identity source (express session, Replit claims, dev-user, old guards)',
    fix: 'req.user.id, and requireAuth / optionalAuth / requireAdmin / requireJob from server/auth',
    scope: (p) => (inServer(p) || (p.startsWith('shared/') && !isTest(p))) && !p.startsWith('server/auth/'),
    pattern:
      /\.session\??\.(?:userId|user\b)|\bclaims\??\.sub\b|\bdev-user-|\b(?:isAuthenticated|replitAuth|sessionMiddleware)\b|['"](?:passport|express-session)['"]/g,
    allow: {},
  },

  // 25e98b2 and 4a30062: Leaflet tooltips are set as innerHTML, and an unescaped constituency
  // name was an XSS sink. Raw HTML sinks in the client go through client/src/lib/escapeHtml.
  {
    label: 'raw HTML sink in the client',
    fix: 'JSX text, or escapeHtml (client/src/lib/escapeHtml.ts) on every interpolated value',
    scope: inClient,
    pattern: /\bdangerouslySetInnerHTML\b|\.innerHTML\s*=|\.insertAdjacentHTML\s*\(|\.(?:bindTooltip|bindPopup)\s*\(/g,
    allow: {
      'client/src/components/OfficialElectoralMap.tsx': 'tooltip HTML is built by createTooltipContent, which escapeHtml()s every value',
    },
  },

  // 95587cc: news page downloads are capped and refuse private hosts on every redirect hop. A bare
  // fetch of a URL that came from an article follows redirects to 169.254.x or localhost.
  {
    label: 'bare fetch() in server/news',
    fix: 'safeFetch from server/news/safeFetch.ts',
    scope: (p) => inServer(p) && p.startsWith('server/news/') && p !== 'server/news/safeFetch.ts',
    pattern: /(?<![.\w$])fetch\s*\(/g,
    allow: {
      'server/news/rss.ts': 'fetches the feed URLs from the operator-set source list, not a URL taken from an article',
    },
  },

  // b6d3072: production fell back to the anon key when SUPABASE_SERVICE_ROLE_KEY was unset, so
  // every "service role" write ran as the anon role. serviceRoleKey() in supabase.ts is the one
  // place that decides, and it throws in production.
  {
    label: 'SUPABASE_ANON_KEY read outside server/auth/supabase.ts',
    fix: 'serviceRoleKey() / the exported client from server/auth/supabase.ts',
    scope: (p) => inServer(p) && p !== 'server/auth/supabase.ts',
    pattern: /\bSUPABASE_ANON_KEY\b/g,
    allow: {
      'server/jobs/robots/guards.ts': 'names the variable in a fixture env for the robots test harness; reads nothing',
    },
  },
];

const blank = (text: string) => text.replace(/[^\n]/g, '');

/** Blanks comments but keeps every newline, so a match's line number is the real one. */
export function stripComments(content: string): string {
  return content
    .replace(/(^|[\s;{(,])(\/\*[\s\S]*?\*\/)/g, (_m, before: string, comment: string) => before + blank(comment))
    .replace(/(^|[\s;])\/\/[^\n]*/g, '$1');
}

export function findViolations(files: SourceFile[], rules: Rule[] = RULES): Violation[] {
  const violations: Violation[] = [];
  for (const rule of rules) {
    for (const file of files) {
      if (!rule.scope(file.path) || Object.hasOwn(rule.allow, file.path)) continue;
      const code = stripComments(file.content);
      for (const m of code.matchAll(rule.pattern)) {
        const line = code.slice(0, m.index).split('\n').length;
        violations.push({ rule, where: `${file.path}:${line}` });
      }
    }
  }
  return violations;
}

/** An allowlist entry whose file is gone or no longer matches its rule. Left in, it would let
 * the next violation in that file through unseen. */
export function staleAllowances(files: SourceFile[], rules: Rule[] = RULES): string[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const stale: string[] = [];
  for (const rule of rules) {
    for (const allowed of Object.keys(rule.allow)) {
      const file = byPath.get(allowed);
      if (!file || !rule.scope(allowed) || !stripComments(file.content).match(rule.pattern)) {
        stale.push(`${rule.label}: ${allowed}`);
      }
    }
  }
  return stale;
}

/** A rule whose scope matches no file checks nothing, usually because a directory was renamed. */
export function deadRules(files: SourceFile[], rules: Rule[] = RULES): Rule[] {
  return rules.filter((rule) => !files.some((file) => rule.scope(file.path)));
}

export function report(violations: Violation[]): string {
  const byRule = new Map<Rule, string[]>();
  for (const v of violations) byRule.set(v.rule, [...(byRule.get(v.rule) ?? []), v.where]);
  return [...byRule]
    .map(([rule, where]) => `${rule.label} (use ${rule.fix} instead):\n${where.map((w) => `  ${w}`).join('\n')}`)
    .join('\n\n');
}

const SELF = /^scripts\/ci\/check-code-guards\./;

function main(): number {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((p) => p && !SELF.test(p) && fs.existsSync(path.join(root, p)));
  const files = tracked.map((p) => ({ path: p, content: fs.readFileSync(path.join(root, p), 'utf8') }));

  if (files.length === 0) {
    console.error('Code guards scanned 0 files. Run from a git checkout.');
    return 1;
  }
  const dead = deadRules(files);
  if (dead.length > 0) {
    console.error(`Rules whose scope matches no file, so they check nothing:\n${dead.map((r) => `  ${r.label}`).join('\n')}`);
    return 1;
  }
  const stale = staleAllowances(files);
  if (stale.length > 0) {
    console.error(`Allowlist entries that no longer match (delete them):\n${stale.map((s) => `  ${s}`).join('\n')}`);
    return 1;
  }
  const violations = findViolations(files);
  if (violations.length > 0) {
    console.error(`Code guards failed (${files.length} files scanned):\n\n${report(violations)}\n`);
    return 1;
  }
  console.log(`${RULES.length} rules checked over ${files.length} files, 0 violations`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
