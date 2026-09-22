// Static inventory of every Express route: method, full path, guards (mount-level + inline),
// which isAuthenticated flavour the file imports, and identity/IDOR smells in the handler.
// Usage: node scripts/audit/route-inventory.mjs [--json out.json] [--md out.md]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GUARD_NAMES = new Set([
  'isAuthenticated', 'optionalAuth', 'requireRole', 'requireAdminAccess', 'isAdmin',
]);

function read(p) { return fs.readFileSync(p, 'utf8'); }
function exists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec.replace(/\.js$/, ''));
  for (const c of [base + '.ts', path.join(base, 'index.ts'), base]) if (exists(c)) return c;
  return null;
}

function parseImports(file, src) {
  // var -> { file, named: string|null, source: spec }
  const map = new Map();
  const re = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const [, def, named, spec] = m;
    const target = resolveImport(file, spec);
    if (def) map.set(def, { file: target, named: null, spec });
    if (named) for (const part of named.split(',')) {
      const seg = part.trim(); if (!seg) continue;
      const [orig, alias] = seg.split(/\s+as\s+/).map(s => s.trim());
      map.set(alias || orig, { file: target, named: orig, spec });
    }
  }
  return map;
}

function routerVars(src) {
  const names = new Set(['router']);
  const re = /(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(?:express\.)?Router\(/g;
  let m; while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

function splitArgs(s) {
  // split top-level commas
  const out = []; let depth = 0, cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { cur += ch; if (ch === q && s[i - 1] !== '\\') q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function lineOf(src, idx) { return src.slice(0, idx).split('\n').length; }

const results = [];
const visited = new Set();

function guardFlavour(imports, name) {
  const imp = imports.get(name);
  if (!imp) return name;
  const rel = imp.file ? path.relative(ROOT, imp.file).replace(/\\/g, '/') : imp.spec;
  return `${name}@${rel.replace(/^server\//, '').replace(/\.ts$/, '')}`;
}

function scanRouter(file, prefixes, mountGuards, viaChain) {
  const key = file + '|' + prefixes.join(',') + '|' + mountGuards.join(',');
  if (visited.has(key)) return; visited.add(key);
  const src = read(file);
  const imports = parseImports(file, src);
  const vars = routerVars(src);
  const varAlt = [...vars].map(v => v.replace(/\$/g, '\\$')).join('|');

  // file-level router.use(guard) with no path => applies to routes after it
  const fileGuards = []; // {pos, guards[]}
  const useRe = new RegExp(`\\b(?:${varAlt})\\.use\\(([\\s\\S]*?)\\);`, 'g');
  let m;
  const nestedMounts = [];
  while ((m = useRe.exec(src))) {
    const args = splitArgs(m[1]);
    if (!args.length) continue;
    const first = args[0];
    const isPath = /^['"`]/.test(first);
    const rest = isPath ? args.slice(1) : args;
    const guards = rest.filter(a => /^\w+(\(.*\))?$/.test(a) && GUARD_NAMES.has(a.replace(/\(.*$/, '')));
    const routers = rest.filter(a => /^\w+$/.test(a) && imports.has(a) && imports.get(a).file);
    if (routers.length) {
      for (const r of routers) nestedMounts.push({ pos: m.index, path: isPath ? first.slice(1, -1) : '', guards, file: imports.get(r).file, via: r });
    } else if (!isPath && guards.length) {
      fileGuards.push({ pos: m.index, guards: guards.map(g => guardFlavour(imports, g.replace(/\(.*$/, ''))) });
    }
  }

  // route definitions
  const defRe = new RegExp(`\\b(?:${varAlt})\\.(get|post|put|patch|delete|all)\\(\\s*(['"\`])([^'"\`]*)\\2\\s*,`, 'g');
  const defs = [];
  while ((m = defRe.exec(src))) defs.push({ idx: m.index, method: m[1].toUpperCase(), path: m[3] });
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const end = i + 1 < defs.length ? defs[i + 1].idx : src.length;
    const block = src.slice(d.idx, end);
    // args after path up to the first handler (async/function/paren-arrow)
    const afterPath = block.slice(block.indexOf(',') + 1);
    const handlerStart = afterPath.search(/\basync\b|\bfunction\b|\(\s*req\b|\(\s*_req\b|\(\s*_\s*[,:)]|\breq\s*[,)=]/);
    const pre = handlerStart >= 0 ? afterPath.slice(0, handlerStart) : '';
    const inline = splitArgs(pre).filter(Boolean).map(a => a.replace(/\(.*$/, '')).filter(a => /^\w+$/.test(a));
    const inlineGuards = inline.filter(a => GUARD_NAMES.has(a)).map(g => guardFlavour(imports, g));
    const otherMw = inline.filter(a => !GUARD_NAMES.has(a));
    const fg = fileGuards.filter(f => f.pos < d.idx).flatMap(f => f.guards);
    const body = handlerStart >= 0 ? afterPath.slice(handlerStart) : block;
    const smells = [];
    if (/req\.(body|query|params)\.(userId|user_id|uid|userID)\b/.test(body)) smells.push('userId-from-input');
    if (/req\.(body|query)\.(email|username)\b/.test(body) && !/login|register|verify|reset|forgot/i.test(d.path)) smells.push('email/username-from-input');
    if (/req\.session\??\.userId/.test(body)) smells.push('uses-session.userId');
    if (/req\.user\b/.test(body)) smells.push('uses-req.user');
    if (/getUserFromRequest\(/.test(body)) smells.push('inline-getUserFromRequest');
    if (/\bsupabaseDb\b|\bsupabaseAdmin\b/.test(body)) smells.push('service-role-direct');
    const writes = /\.(insert|update|upsert|delete)\(|\bstorage\.(create|update|delete|save|set|record|add|remove|upsert|mark|increment)\w*\(/.test(body);
    if (writes) smells.push('db-write');
    if (/openai|anthropic|deepseek|generateText|chat\.completions|aiService/i.test(body)) smells.push('ai-call');
    if (/NODE_ENV\s*[!=]==?\s*['"]development['"]/.test(body)) smells.push('dev-branch');
    const effective = [...mountGuards, ...fg, ...inlineGuards];
    for (const prefix of prefixes) {
      results.push({
        method: d.method,
        path: (prefix + (d.path === '/' ? '' : d.path)).replace(/\/+/g, '/') || '/',
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: lineOf(src, d.idx),
        mountGuards, fileGuards: fg, inlineGuards, otherMw, effective,
        guarded: effective.some(g => /^(isAuthenticated|requireRole|requireAdminAccess|isAdmin)/.test(g)),
        optionalOnly: effective.length > 0 && effective.every(g => g.startsWith('optionalAuth')),
        smells, via: viaChain,
      });
    }
  }
  for (const nm of nestedMounts) {
    const fg = fileGuards.filter(f => f.pos < nm.pos).flatMap(f => f.guards);
    scanRouter(nm.file, prefixes.map(p => (p + nm.path).replace(/\/+/g, '/')),
      [...mountGuards, ...fg, ...nm.guards.map(g => guardFlavour(imports, g.replace(/\(.*$/, '')))], viaChain + ' > ' + nm.via);
  }
}

// entry: server/routes.ts app.use("/api/...", [guards,] routerVar)
const entry = path.join(ROOT, 'server/routes.ts');
const entrySrc = read(entry);
const entryImports = parseImports(entry, entrySrc);
const mountRe = /app\.use\(\s*(['"`])([^'"`]+)\1\s*,([^;]*?)\);/g;
let mm; const mountsByFile = new Map();
while ((mm = mountRe.exec(entrySrc))) {
  const prefix = mm[2];
  const args = splitArgs(mm[3]);
  const guards = args.filter(a => GUARD_NAMES.has(a.replace(/\(.*$/, ''))).map(g => guardFlavour(entryImports, g.replace(/\(.*$/, '')));
  const routerVar = args[args.length - 1];
  const imp = entryImports.get(routerVar);
  if (!imp || !imp.file) { console.error(`! unresolved router ${routerVar} for ${prefix}`); continue; }
  scanRouter(imp.file, [prefix], guards, routerVar);
}
// direct app.<method> routes in routes.ts itself
const appDefRe = /\bapp\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]*)\2\s*,([\s\S]*?)\n\s*\}\);/g;
while ((mm = appDefRe.exec(entrySrc))) {
  const inline = splitArgs(mm[4].split(/\basync\b|\(\s*req\b/)[0]).map(a => a.replace(/\(.*$/, '')).filter(a => GUARD_NAMES.has(a));
  results.push({ method: mm[1].toUpperCase(), path: mm[3], file: 'server/routes.ts', line: lineOf(entrySrc, mm.index), mountGuards: [], fileGuards: [], inlineGuards: inline.map(g => guardFlavour(entryImports, g)), otherMw: [], effective: inline, guarded: inline.some(g => g !== 'optionalAuth'), optionalOnly: false, smells: [], via: 'app' });
}

results.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
const args = process.argv.slice(2);
const jsonOut = args[args.indexOf('--json') + 1]; const mdOut = args[args.indexOf('--md') + 1];
if (args.includes('--json')) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));

const mutating = results.filter(r => r.method !== 'GET');
const unguardedMut = mutating.filter(r => !r.guarded);
const lines = [];
lines.push(`# Route inventory (static)`, '', `Total routes: ${results.length}  |  Mutating: ${mutating.length}  |  Mutating with NO auth guard: ${unguardedMut.length}  |  GET: ${results.length - mutating.length}`, '');
const flav = {}; for (const r of results) for (const g of r.effective) flav[g] = (flav[g] || 0) + 1;
lines.push('## Guard flavours in effect', '', ...Object.entries(flav).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`), '');
lines.push('## Mutating routes with NO auth guard', '', '| Method | Path | File | Smells |', '|---|---|---|---|');
for (const r of unguardedMut) lines.push(`| ${r.method} | ${r.path} | ${r.file}:${r.line} | ${r.smells.join(', ')} |`);
lines.push('', '## Mutating routes WITH a guard', '', '| Method | Path | File | Guards | Smells |', '|---|---|---|---|---|');
for (const r of mutating.filter(r => r.guarded)) lines.push(`| ${r.method} | ${r.path} | ${r.file}:${r.line} | ${r.effective.join(' + ')} | ${r.smells.join(', ')} |`);
lines.push('', '## GET routes touching user identity or service role without a guard', '', '| Path | File | Smells |', '|---|---|---|');
for (const r of results.filter(r => r.method === 'GET' && !r.guarded && r.smells.some(s => /userId-from-input|session|service-role|ai-call/.test(s)))) lines.push(`| ${r.path} | ${r.file}:${r.line} | ${r.smells.join(', ')} |`);
const md = lines.join('\n');
if (args.includes('--md')) fs.writeFileSync(mdOut, md); else console.log(md);
console.error(`routes=${results.length} mutating=${mutating.length} unguardedMutating=${unguardedMut.length}`);
