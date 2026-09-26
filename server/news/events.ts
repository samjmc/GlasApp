/**
 * Same-event matching: is this new item about a real-world event already published?
 *
 * One LLM call per ingest run sees every new above-floor item and the recent visible
 * canonicals. Items are never split into parallel batches: feeds arrive one source at a
 * time, so a split would never pair RTÉ with The Journal. Over EVENT_MATCH_MAX_ITEMS the
 * calls run one after another, oldest items first, each seeing the canonicals before it.
 *
 * `assignCanonicals` then turns the links into one canonical per event. Pure.
 */
import { z } from 'zod';
import { callChatCompletion } from '../services/aiService';

/** Candidates are visible canonicals published within this many hours. */
export const EVENT_WINDOW_HOURS = 72;
/** At most this many candidates per call, newest first. */
export const EVENT_CANDIDATE_LIMIT = 300;
/** New items per call. */
export const EVENT_MATCH_MAX_ITEMS = 60;
const MODEL = 'deepseek-flash';

/** What an article is the same event as: a stored row (by id), or another article of this run (by index). */
export type Link = { stored: number } | { run: number };

export interface EventCandidate {
  id: number;
  title: string;
  /** The neutral AI summary; the title alone is sent when it is NULL. */
  summary: string | null;
}

export interface EventItem {
  /** The caller's own index for this item; `{ run }` links refer to it. */
  index: number;
  title: string;
  summary: string | null;
}

export interface EventMatch {
  /** A candidate id. */
  event: number | null;
  /** Another item of the same call. */
  sameAs: number | null;
}

const SYSTEM = `You match Irish news items to the real-world event they report, so that each event is shown once.

Two items are the SAME EVENT only when they report the same real-world decision, statement, vote or incident —
not the same topic or the same person.

CANDIDATES are already published, labelled [#id]. NEW ITEMS are labelled [index], oldest first.
For each new item give:
  event    the id of the candidate that is the same event, or null
  same_as  the index of an earlier new item that is the same event, or null
When unsure, use null.

Reply with JSON only:
{"items":[{"i":<index>,"event":<candidate id|null>,"same_as":<index|null>}, ...]}
one entry per new item.`;

const line = (label: string, title: string, summary: string | null) => `[${label}] "${title}"${summary ? ` — ${summary}` : ''}`;

export function buildEventPrompt(items: EventItem[], candidates: EventCandidate[]): string {
  const known = candidates.length ? candidates.map((c) => line(`#${c.id}`, c.title, c.summary)).join('\n') : '(none)';
  return `CANDIDATES\n${known}\n\nNEW ITEMS\n${items.map((it, i) => line(String(i), it.title, it.summary)).join('\n')}`;
}

const replySchema = z.object({ items: z.array(z.unknown()) });
const entrySchema = z.object({
  i: z.number().int(),
  event: z.number().int().nullish(),
  same_as: z.number().int().nullish(),
});

/** Parse the reply. An unknown id, an out-of-range index or a malformed entry is no match. */
export function parseEvents(reply: string, count: number, candidateIds: Set<number>): EventMatch[] {
  const out: EventMatch[] = Array.from({ length: count }, () => ({ event: null, sameAs: null }));
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return out;
  }
  const shape = replySchema.safeParse(parsed);
  if (!shape.success) return out;
  for (const raw of shape.data.items) {
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) continue;
    const { i, event, same_as } = entry.data;
    if (i < 0 || i >= count) continue;
    out[i] = {
      event: event != null && candidateIds.has(event) ? event : null,
      sameAs: same_as != null && same_as >= 0 && same_as < count && same_as !== i ? same_as : null,
    };
  }
  return out;
}

async function callEvents(items: EventItem[], candidates: EventCandidate[]): Promise<EventMatch[]> {
  const completion = await callChatCompletion(
    {
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildEventPrompt(items, candidates) },
      ],
    },
    { operation: 'news.events', timeoutMs: 60_000 },
  );
  return parseEvents(completion.choices[0]?.message?.content ?? '', items.length, new Set(candidates.map((c) => c.id)));
}

/**
 * Link each item to a stored candidate or to another item. `items` must be oldest first.
 * A failed call links nothing (every item stays its own canonical) and is counted.
 */
export async function matchEvents(
  items: EventItem[],
  stored: EventCandidate[],
): Promise<{ links: Array<{ index: number; of: Link }>; failedCalls: number }> {
  // An earlier call's canonicals join the candidates under labels above every stored id.
  const pool: Array<EventCandidate & { of: Link }> = stored.map((c) => ({ ...c, of: { stored: c.id } }));
  let nextLabel = stored.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const links: Array<{ index: number; of: Link }> = [];
  let failedCalls = 0;

  for (let start = 0; start < items.length; start += EVENT_MATCH_MAX_ITEMS) {
    const chunk = items.slice(start, start + EVENT_MATCH_MAX_ITEMS);
    let matches: EventMatch[] = [];
    if (pool.length > 0 || chunk.length > 1) {
      try {
        matches = await callEvents(chunk, pool);
      } catch (error) {
        failedCalls++;
        console.error('news.events call failed:', error instanceof Error ? error.message : error);
      }
    }
    const linked = new Set<number>();
    matches.forEach(({ event, sameAs }, j) => {
      if (event !== null) links.push({ index: chunk[j].index, of: pool.find((c) => c.id === event)!.of });
      if (sameAs !== null) links.push({ index: chunk[j].index, of: { run: chunk[sameAs].index } });
      if (event !== null || sameAs !== null) linked.add(j);
    });
    chunk.forEach((item, j) => {
      if (!linked.has(j)) pool.push({ id: nextLabel++, title: item.title, summary: item.summary, of: { run: item.index } });
    });
  }
  return { links, failedCalls };
}

/**
 * One canonical per event, for each item of a run: null when the item is its own canonical,
 * else the canonical it duplicates. Links are unioned, so a link to a duplicate reaches its
 * root. A stored article always stays canonical (it may be scored already); of two stored,
 * the lower id. Otherwise the earliest published item wins, tie by URL.
 */
export function assignCanonicals(items: Array<{ url: string; publishedAt: Date }>, links: Array<{ index: number; of: Link }>): Array<Link | null> {
  const key = (l: Link) => ('stored' in l ? `s${l.stored}` : `r${l.run}`);
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (p === undefined || p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  for (const { index, of } of links) {
    const a = find(`r${index}`);
    const b = find(key(of));
    if (a !== b) parent.set(a, b);
  }

  const better = (a: Link, b: Link): boolean => {
    if ('stored' in a) return 'stored' in b ? a.stored < b.stored : true;
    if ('stored' in b) return false;
    const dt = items[a.run].publishedAt.getTime() - items[b.run].publishedAt.getTime();
    return dt < 0 || (dt === 0 && items[a.run].url < items[b.run].url);
  };
  const best = new Map<string, Link>();
  const consider = (l: Link) => {
    const group = find(key(l));
    const current = best.get(group);
    if (!current || better(l, current)) best.set(group, l);
  };
  items.forEach((_, i) => consider({ run: i }));
  links.forEach(({ of }) => consider(of));

  return items.map((_, i) => {
    const canonical = best.get(find(`r${i}`))!;
    return 'run' in canonical && canonical.run === i ? null : canonical;
  });
}
