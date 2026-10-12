/**
 * The files a fact generator or doc check looks at: tracked files plus untracked files that
 * are not ignored, so a new file counts before it is staged. Paths are repo-relative, with
 * forward slashes, sorted.
 *
 * Using git's list (not a directory walk) also keeps node_modules out, and means "does this
 * file exist" is answered with the same case-sensitive paths GitHub and the Linux CI see.
 * Windows' file system would say yes to a link with the wrong case.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function walk(root: string, dir = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(root, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

export function listFiles(root: string, options: { useGit?: boolean } = {}): string[] {
  if (options.useGit !== false) {
    try {
      const raw = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      });
      const files = raw.split('\0').filter((f) => f && fs.existsSync(path.join(root, f)));
      return [...new Set(files)].sort();
    } catch {
      // Not a git checkout: fall through to a walk.
    }
  }
  return walk(root).sort();
}

export const isTestFile = (rel: string): boolean =>
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel) || rel.startsWith('test/') || rel.includes('/test/');

export const readText = (root: string, rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');
