/**
 * Requests a page does not need: the TD profile loaded every tab's data on open, the search box in
 * the top bar of every page downloaded the full TD, party and constituency lists before anyone
 * used it, and the TD list was fetched under two keys. Read as text: the client has no component
 * test setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(SRC, ...parts), 'utf8');

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('TD profile', () => {
  const page = read('pages', 'TDProfilePage.tsx');

  it.each(['votes', 'debates', 'news'])("the %s tab's query waits until the tab is open", (tab) => {
    expect(page).toContain(`&& tab === '${tab}'`);
  });

  it('the tabs are controlled, so the open tab is known', () => {
    expect(page).toMatch(/<Tabs value=\{tab\} onValueChange=\{setTab\}/);
  });
});

describe('global search', () => {
  const search = read('components', 'GlobalSearch.tsx');

  it('loads nothing until the box is focused or typed in', () => {
    expect(search).toMatch(/const enabled = isIreland && wanted;/);
    expect(search.match(/setWanted\(true\)/g)?.length).toBe(2);
  });

  it('takes the TD list from the shared query', () => {
    expect(search).toMatch(/useAllTDs\(enabled\)/);
  });
});

describe('the TD list', () => {
  it('is fetched in one place only', () => {
    const fetchers = files(SRC)
      .filter((file) => fs.readFileSync(file, 'utf8').includes('"/api/scores/tds"') || fs.readFileSync(file, 'utf8').includes("'/api/scores/tds'"))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));
    expect(fetchers).toEqual(['components/home/useAllTDs.ts']);
  });
});
