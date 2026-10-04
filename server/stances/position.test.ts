import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POSITION_QUESTION, isJevConfigured, positionProbability, positionState, type PositionPassage } from './position';

const ENV = { JEV_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acct' } as NodeJS.ProcessEnv;
const PASSAGE: PositionPassage = {
  td: { id: 7, name: 'Ged Nash', party: 'Labour Party', offices: [] },
  headline: 'Help is on the way',
  quote: 'Labour finance spokesman Ged Nash called for a targeted €400 energy credit.',
};

/** Cloudflare's real shape: its envelope, then the job record, then Jev's answer. */
const wrapped = (answer: Record<string, unknown>) => ({
  success: true,
  result: { state: 'Completed', result: { model: 'typesafe/jev', answers: { position: answer }, usage: { input_tokens: 60 } } },
});
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('positionState', () => {
  it('names the TD and party, gives the headline as context, then the passage', () => {
    expect(positionState(PASSAGE)).toBe(`Named TD: Ged Nash (Labour Party)\nArticle headline: Help is on the way\nPassage: ${PASSAGE.quote}`);
    expect(positionState({ ...PASSAGE, td: { ...PASSAGE.td, party: null } })).toMatch(/^Named TD: Ged Nash\n/);
  });
});

describe('positionProbability', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('needs both the key and the account: without them, no call and no answer', async () => {
    const fetchImpl = vi.fn();
    expect(isJevConfigured({ JEV_API_KEY: 'k' })).toBe(false);
    expect(await positionProbability(PASSAGE, { JEV_API_KEY: 'k' }, fetchImpl)).toBeNull();
    expect(await positionProbability(PASSAGE, { CLOUDFLARE_ACCOUNT_ID: 'acct' }, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks Jev one yes/no question about the passage and returns P(yes)', async () => {
    const fetchImpl = vi.fn(async () => reply(200, wrapped({ type: 'noul', noul: 0.97 })));
    expect(await positionProbability(PASSAGE, ENV, fetchImpl)).toBe(0.97);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/ai/run');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer k' });
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'typesafe/jev',
      input: { state: positionState(PASSAGE), questions: { position: { type: 'noul', instructions: POSITION_QUESTION } } },
    });
  });

  it("reads the 'probability' spelling too, and an unwrapped answer", async () => {
    const fetchImpl = vi.fn(async () => reply(200, { answers: { position: { type: 'boolean', probability: 0.2 } } }));
    expect(await positionProbability(PASSAGE, ENV, fetchImpl)).toBe(0.2);
  });

  it.each([
    ['no answers map', { result: { state: 'Running' } }],
    ['no position answer', { answers: {} }],
    ['a probability out of range', wrapped({ type: 'noul', noul: 1.4 })],
    ['a probability that is not a number', wrapped({ type: 'noul', noul: 'yes' })],
  ])('%s gives no answer', async (_name, body) => {
    expect(await positionProbability(PASSAGE, ENV, vi.fn(async () => reply(200, body)))).toBeNull();
  });

  it('does not retry an error that retrying cannot fix (402: out of credit)', async () => {
    const fetchImpl = vi.fn(async () => reply(402));
    expect(await positionProbability(PASSAGE, ENV, fetchImpl)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a 429, a 5xx and a network error, then gives up', async () => {
    const recovered = vi
      .fn()
      .mockResolvedValueOnce(reply(429))
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(reply(200, wrapped({ type: 'noul', noul: 0.6 })));
    const first = positionProbability(PASSAGE, ENV, recovered);
    await vi.runAllTimersAsync();
    expect(await first).toBe(0.6);

    const down = vi.fn(async () => reply(503));
    const second = positionProbability(PASSAGE, ENV, down);
    await vi.runAllTimersAsync();
    expect(await second).toBeNull();
    expect(down).toHaveBeenCalledTimes(3);
  });
});
