/**
 * Every vote recomputes the user's ideology on the server, but the cache never goes stale on its own
 * (staleTime is Infinity). So after a vote the user tapped "See my politics" and saw the old position
 * and matches. The keys a vote makes stale must reach every ideology query, and an article vote must
 * reach today's session. The hooks are read as text: the client has no component test setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { keysStaleAfterVote, queryKeys } from './queryKeys';

/** invalidateQueries({ queryKey }) matches every key that starts with it. */
const reaches = (prefixes: readonly (readonly unknown[])[], key: readonly unknown[]) =>
  prefixes.some((prefix) => JSON.stringify(key.slice(0, prefix.length)) === JSON.stringify(prefix));

describe('keysStaleAfterVote', () => {
  const ideologyKeys = [
    queryKeys.ideology.mine('u1'),
    queryKeys.ideology.myMatches('u1', { economic: 2 }),
    queryKeys.ideology.myMatchesForTd('u1', 7),
    queryKeys.ideology.timeline('u1', 'Fine Gael'),
  ];

  it.each(['daily', 'article'] as const)('a %s vote reaches the position, matches and timeline', (kind) => {
    for (const key of ideologyKeys) expect(reaches(keysStaleAfterVote(kind), key)).toBe(true);
  });

  it("an article vote reaches today's session; a daily vote updates it in place instead", () => {
    const session = queryKeys.dailySession('IE', 'u1');
    expect(reaches(keysStaleAfterVote('article'), session)).toBe(true);
    expect(reaches(keysStaleAfterVote('daily'), session)).toBe(false);
  });

  it('does not throw away unrelated data', () => {
    expect(reaches(keysStaleAfterVote('article'), queryKeys.td.rankings())).toBe(false);
    expect(reaches(keysStaleAfterVote('article'), queryKeys.quiz.mine('u1'))).toBe(false);
  });
});

describe('vote hooks', () => {
  const hooks = fs.readFileSync(path.resolve(__dirname, '../hooks/useDailySession.ts'), 'utf8');

  it('the daily vote, the session finish and the article vote all invalidate', () => {
    expect(hooks.match(/keysStaleAfterVote\("daily"\)/g)?.length).toBe(2);
    expect(hooks.match(/keysStaleAfterVote\("article"\)/g)?.length).toBe(1);
  });

  it('article votes live in the query cache, keyed by article and user', () => {
    const card = fs.readFileSync(path.resolve(__dirname, '../components/PolicyVotePrompt.tsx'), 'utf8');
    expect(card).toMatch(/useArticleVote\(articleId\)/);
    expect(card).not.toMatch(/fetchArticleVote|castArticleVote/);
  });
});
