import { beforeEach, describe, expect, it, vi } from 'vitest';

const llm = vi.hoisted(() => ({ replies: [] as Array<string | Error>, prompts: [] as string[], operations: [] as string[] }));
vi.mock('../services/aiService', () => ({
  callChatCompletion: vi.fn(async (params: { messages: Array<{ content: string }> }, options: { operation: string }) => {
    llm.prompts.push(params.messages[1].content);
    llm.operations.push(options.operation);
    const reply = llm.replies.shift() ?? '{"items":[]}';
    if (reply instanceof Error) throw reply;
    return { choices: [{ message: { content: reply } }] };
  }),
}));

const { EVENT_MATCH_MAX_ITEMS, assignCanonicals, buildEventPrompt, matchEvents, parseEvents } = await import('./events');

const at = (iso: string) => new Date(iso);

describe('parseEvents', () => {
  const ids = new Set([12, 40]);

  it('keeps a known candidate id and an in-range earlier index', () => {
    const reply = JSON.stringify({ items: [{ i: 0, event: 12, same_as: null }, { i: 1, event: null, same_as: 0 }] });
    expect(parseEvents(reply, 2, ids)).toEqual([
      { event: 12, sameAs: null },
      { event: null, sameAs: 0 },
    ]);
  });

  it('an unknown id, an out-of-range or self index, or a malformed entry is no match', () => {
    const reply = JSON.stringify({
      items: [{ i: 0, event: 99, same_as: 0 }, { i: 1, event: '12', same_as: null }, { i: 5, event: 12 }, null],
    });
    expect(parseEvents(reply, 2, ids)).toEqual([
      { event: null, sameAs: null },
      { event: null, sameAs: null },
    ]);
    expect(parseEvents(JSON.stringify({ items: [{ i: 1, same_as: 7 }] }), 2, ids)[1]).toEqual({ event: null, sameAs: null });
  });

  it('prose or a wrong shape is no match for every item; code fences are fine', () => {
    expect(parseEvents('I cannot tell', 1, ids)).toEqual([{ event: null, sameAs: null }]);
    expect(parseEvents('{"items":"none"}', 1, ids)).toEqual([{ event: null, sameAs: null }]);
    expect(parseEvents('```json\n{"items":[{"i":0,"event":40}]}\n```', 1, ids)).toEqual([{ event: 40, sameAs: null }]);
  });
});

describe('buildEventPrompt', () => {
  it('lists candidates by id and new items by index, with the summary when there is one', () => {
    expect(
      buildEventPrompt(
        [{ index: 3, title: 'TDs back budget', summary: null }],
        [{ id: 12, title: 'Dáil passes budget', summary: 'The Dáil voted 88 to 70.' }],
      ),
    ).toBe('CANDIDATES\n[#12] "Dáil passes budget" — The Dáil voted 88 to 70.\n\nNEW ITEMS\n[0] "TDs back budget"');
    expect(buildEventPrompt([{ index: 0, title: 'x', summary: null }], [])).toBe('CANDIDATES\n(none)\n\nNEW ITEMS\n[0] "x"');
  });
});

describe('matchEvents', () => {
  beforeEach(() => {
    llm.replies = [];
    llm.prompts = [];
    llm.operations = [];
  });

  it('a story that arrives 47h after the first report links to the stored canonical', async () => {
    llm.replies.push(JSON.stringify({ items: [{ i: 0, event: 41, same_as: null }] }));
    const { links, failedCalls } = await matchEvents(
      [{ index: 2, title: 'TDs back budget package in overnight division', summary: 'The Dáil approved the budget.' }],
      [{ id: 41, title: 'Dáil passes Budget 2027 after late-night vote', summary: 'The Dáil passed the budget.' }],
    );
    expect(links).toEqual([{ index: 2, of: { stored: 41 } }]);
    expect(failedCalls).toBe(0);
    expect(llm.operations).toEqual(['news.events']);
  });

  it('links two items of one call to each other by index', async () => {
    llm.replies.push(JSON.stringify({ items: [{ i: 0, event: null, same_as: null }, { i: 1, event: null, same_as: 0 }] }));
    const { links } = await matchEvents(
      [
        { index: 4, title: 'a', summary: null },
        { index: 9, title: 'b', summary: null },
      ],
      [],
    );
    expect(links).toEqual([{ index: 9, of: { run: 4 } }]);
  });

  it('fails open: a thrown call links nothing and is counted', async () => {
    llm.replies.push(new Error('timeout'));
    const result = await matchEvents(
      [
        { index: 0, title: 'a', summary: null },
        { index: 1, title: 'b', summary: null },
      ],
      [],
    );
    expect(result).toEqual({ links: [], failedCalls: 1 });
  });

  it('makes no call for one item with nothing to compare it to', async () => {
    expect(await matchEvents([{ index: 0, title: 'a', summary: null }], [])).toEqual({ links: [], failedCalls: 0 });
    expect(llm.prompts).toEqual([]);
  });

  it('over the item cap, calls run one after another and each sees the canonicals before it', async () => {
    const items = Array.from({ length: EVENT_MATCH_MAX_ITEMS + 1 }, (_, i) => ({ index: i, title: `item ${i}`, summary: null }));
    // Call 1 links nothing. Call 2's only item is the same event as the first item of call 1,
    // which it can only see as a candidate labelled after the stored ids (none here, so #1).
    llm.replies.push('{"items":[]}', JSON.stringify({ items: [{ i: 0, event: 1 }] }));
    const { links } = await matchEvents(items, []);
    expect(llm.prompts).toHaveLength(2);
    expect(llm.prompts[1]).toContain('[#1] "item 0"');
    expect(llm.prompts[1]).toContain(`[0] "item ${EVENT_MATCH_MAX_ITEMS}"`);
    expect(links).toEqual([{ index: EVENT_MATCH_MAX_ITEMS, of: { run: 0 } }]);
  });
});

describe('assignCanonicals', () => {
  const early = { url: 'https://rte.ie/a', publishedAt: at('2026-09-22T10:00:00Z') };
  const late = { url: 'https://thejournal.ie/b', publishedAt: at('2026-09-22T11:00:00Z') };

  it('an unlinked item is its own canonical', () => {
    expect(assignCanonicals([early, late], [])).toEqual([null, null]);
  });

  it('within one run the earliest published wins, whichever way the link points', () => {
    expect(assignCanonicals([late, early], [{ index: 1, of: { run: 0 } }])).toEqual([{ run: 1 }, null]);
    expect(assignCanonicals([late, early], [{ index: 0, of: { run: 1 } }])).toEqual([{ run: 1 }, null]);
  });

  it('a publication-time tie goes to the lower URL', () => {
    const tie = { ...late, publishedAt: early.publishedAt };
    expect(assignCanonicals([tie, early], [{ index: 0, of: { run: 1 } }])).toEqual([{ run: 1 }, null]);
  });

  it('a stored canonical is never swapped, even for an item published before it', () => {
    expect(assignCanonicals([early], [{ index: 0, of: { stored: 7 } }])).toEqual([{ stored: 7 }]);
  });

  it('a link to a duplicate resolves to its root', () => {
    const third = { url: 'https://independent.ie/c', publishedAt: at('2026-09-22T12:00:00Z') };
    expect(assignCanonicals([early, late, third], [{ index: 1, of: { run: 0 } }, { index: 2, of: { run: 1 } }])).toEqual([
      null,
      { run: 0 },
      { run: 0 },
    ]);
    expect(assignCanonicals([early, late], [{ index: 0, of: { stored: 5 } }, { index: 1, of: { run: 0 } }])).toEqual([
      { stored: 5 },
      { stored: 5 },
    ]);
  });

  it('two stored canonicals in one group: the lower id wins', () => {
    expect(assignCanonicals([early], [{ index: 0, of: { stored: 9 } }, { index: 0, of: { stored: 5 } }])).toEqual([{ stored: 5 }]);
  });
});
