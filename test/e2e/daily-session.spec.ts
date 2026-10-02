/**
 * The daily session (/daily-session) end to end in a browser: the walk through three
 * questions, the screens around it, and the ways it can be interrupted.
 *
 * Sign-in is faked and so is the API. The e2e server has no Supabase, so it cannot verify a
 * token; the page is given a stored session (client only) and /api/daily-session is answered
 * by a small stateful fake that follows the contract in shared/voting.ts. What is under test is
 * the page's own logic and screens. The server's rules (streaks, dates, completion) are covered
 * by server/voting/voting.integration.test.ts against Postgres.
 */
import { expect, test, type Page } from '@playwright/test';
import type { DailySessionCompletion, DailySessionItem, DailySessionState } from '@shared/voting';

const SESSION_ID = 7;
const TOTAL = 3;
const OPTIONS = { option_a: 'Market answer', option_b: 'State answer', option_c: 'Mixed answer' };
const DIMENSIONS = ['economic', 'social', 'welfare'];
/** The calendar date the server would give today's session (Dublin). */
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function item(n: number, voted = false): DailySessionItem {
  return {
    sessionItemId: 100 + n,
    questionId: 200 + n,
    articleId: 300 + n,
    headline: `Headline ${n}`,
    summary: `Summary ${n}.`,
    prompt: `Question ${n}?`,
    answerOptions: OPTIONS,
    policyDimension: DIMENSIONS[n - 1] ?? null,
    contextNote: 'cost of living',
    orderIndex: n - 1,
    hasVoted: voted,
    selectedOption: voted ? 'option_b' : null,
    articleUrl: null,
    imageUrl: null,
  };
}

/** A stand-in for the server's daily-session routes. */
class FakeDaily {
  gets = 0;
  /** How long a GET takes to answer, so a test can look at the page while it is in flight. */
  delayGetMs = 0;
  completeCalls = 0;
  readonly votes: Array<{ itemId: number; option: string }> = [];
  status: 'pending' | 'completed' = 'pending';

  constructor(
    public items: DailySessionItem[],
    /** The streak before today's session is finished. */
    private streakBefore: number,
    private completeFailures = 0,
  ) {}

  finished() {
    this.status = 'completed';
  }

  completion(): DailySessionCompletion {
    return {
      ideologySummary: 'Your profile moved +1.0% on Economic Left - Right.',
      ideologyDelta: 1,
      ideologyAxis: 'Economic Left - Right',
      ideologyDirection: 'right',
      regionSummary: 'Add your county or constituency to see how your area voted.',
      streakCount: this.streakBefore + 1,
      dimensionShifts: [
        { ideologyDimension: 'economic', axisLabel: 'Economic Left - Right', delta: 0.1, deltaPercent: 1, before: 0, after: 0.1, direction: 'right' },
      ],
      detailStats: [],
    };
  }

  state(): DailySessionState {
    const done = this.status === 'completed';
    return {
      status: this.status,
      sessionId: SESSION_ID,
      sessionDate: TODAY,
      voteCount: this.items.filter((i) => i.hasVoted).length,
      streakCount: done ? this.streakBefore + 1 : this.streakBefore,
      items: this.items,
      completion: done ? this.completion() : undefined,
    };
  }

  async install(page: Page) {
    const ok = (data: unknown) => ({ json: { success: true, data } });
    const fail = (status: number, message: string) => ({ status, json: { success: false, error: { code: 'ERROR', message } } });

    await page.route('**/api/daily-session**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/daily-session') {
        this.gets += 1;
        if (this.delayGetMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayGetMs));
        return route.fulfill(ok(this.state()));
      }
      const vote = path.match(/\/api\/daily-session\/items\/(\d+)\/vote$/);
      if (request.method() === 'POST' && vote) {
        const target = this.items.find((i) => i.sessionItemId === Number(vote[1]));
        if (!target) return route.fulfill(fail(404, 'Session item not found'));
        const option = (request.postDataJSON() as { optionKey: string }).optionKey;
        this.votes.push({ itemId: target.sessionItemId, option });
        target.hasVoted = true;
        target.selectedOption = option;
        return route.fulfill(ok(this.state()));
      }
      if (request.method() === 'POST' && path === '/api/daily-session/complete') {
        this.completeCalls += 1;
        if (this.completeFailures > 0) {
          this.completeFailures -= 1;
          return route.fulfill(fail(500, 'Something went wrong'));
        }
        if (this.items.some((i) => !i.hasVoted)) return route.fulfill(fail(400, 'Answer every question before finishing'));
        this.finished();
        return route.fulfill(ok(this.completion()));
      }
      return route.fallback();
    });
  }
}

/** Signed in as a made-up user, and past the cookie banner and the region picker. */
async function signIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: false, functional: false }));
    localStorage.setItem('glas.region', 'IE');
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      'glas-politics-auth',
      JSON.stringify({
        access_token: 'e2e.fake.token',
        refresh_token: 'e2e-refresh',
        token_type: 'bearer',
        expires_in: 86_400,
        expires_at: now + 86_400,
        user: {
          id: 'e2e-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'e2e@example.com',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        },
      }),
    );
  });
}

const progress = (page: Page) => page.getByRole('progressbar', { name: 'Question progress' });
const answered = async (page: Page) => Number(await progress(page).getAttribute('aria-valuenow'));
const position = (page: Page, n: number) => page.getByText(`${n} of ${TOTAL}`, { exact: true });

/** From a question's preview, pick an answer and save it. */
async function answerCurrent(page: Page, label: string | RegExp = 'State answer') {
  await page.getByRole('button', { name: /^Vote on this/ }).click();
  await page.getByRole('radio', { name: label }).click();
  await page.getByRole('button', { name: /^(Save answer|Save and finish)$/ }).click();
}

/**
 * The network drops and comes back after a while (a phone leaving a lift or switching wifi).
 * The cached session is stale by then, so React Query refetches it on reconnect. Waits for
 * that refetch, so a test that follows is checking the page AFTER the new data arrived.
 * (The app turns refetch-on-focus off, so reconnect is the realistic trigger.)
 * Needs `page.clock.install()` first.
 */
async function reconnectLater(page: Page, api: FakeDaily) {
  const before = api.gets;
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + 120_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect.poll(() => api.gets, 'the session should refetch when the network returns').toBeGreaterThan(before);
}

async function open(page: Page, api: FakeDaily, url = '/daily-session') {
  await signIn(page);
  await api.install(page);
  await page.goto(url);
}

test('a full session: intro, three answers, results, streak', async ({ page }) => {
  const api = new FakeDaily([item(1), item(2), item(3)], 4);
  await open(page, api);

  // The intro shows the streak the user is on, not zero.
  await expect(page.getByText('4 days running')).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  for (let n = 1; n <= TOTAL; n++) {
    await expect(page.getByRole('heading', { name: `Headline ${n}` })).toBeVisible();
    await expect(position(page, n)).toBeVisible();
    expect(await answered(page), `before answer ${n}`).toBe(n - 1);

    await answerCurrent(page);
    if (n < TOTAL) {
      // The "saved" beat: exactly the answers given so far are filled, and the counter has not moved on.
      await expect(page.getByRole('heading', { name: 'Answer saved' })).toBeVisible();
      expect(await answered(page), `while saving answer ${n}`).toBe(n);
      await expect(position(page, n)).toBeVisible();
    }
  }

  await expect(page.getByText(`${TOTAL} of ${TOTAL} answered`)).toBeVisible();
  expect(api.votes.map((v) => v.itemId)).toEqual([101, 102, 103]);
  expect(api.completeCalls).toBe(1);

  await page.getByRole('button', { name: 'See my streak' }).click();
  await expect(page.getByRole('heading', { name: 'Streak boosted' })).toBeVisible();
  await expect(page.getByText('4 days', { exact: true })).toBeVisible();
  await expect(page.getByText('+1 day locked in')).toBeVisible();
});

test('closing the session and coming back resumes at the next question', async ({ page }) => {
  const api = new FakeDaily([item(1, true), item(2), item(3)], 2);
  await open(page, api);

  await expect(page.getByRole('heading', { name: 'Headline 2' })).toBeVisible();
  await expect(position(page, 2)).toBeVisible();
  expect(await answered(page)).toBe(1);
});

test('a question answered on its article page is not asked twice, and none is skipped', async ({ page }) => {
  // The third question was answered on its article card after the session was made.
  const api = new FakeDaily([item(1), item(2), item(3, true)], 0);
  await open(page, api);

  // Some answers already exist, so it resumes (no intro) at the first question still open.
  await expect(page.getByRole('heading', { name: 'Headline 1' })).toBeVisible();
  await expect(position(page, 1)).toBeVisible();
  expect(await answered(page)).toBe(1);
  await answerCurrent(page);
  await expect(page.getByRole('heading', { name: 'Headline 2' })).toBeVisible();
  await answerCurrent(page);

  await expect(page.getByRole('button', { name: 'See my streak' })).toBeVisible();
  expect(api.votes.map((v) => v.itemId)).toEqual([101, 102]);
  expect(api.completeCalls).toBe(1);
});

test('if finishing fails, the user can finish without answering again', async ({ page }) => {
  const api = new FakeDaily([item(1), item(2), item(3)], 1, 1);
  await open(page, api);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let n = 1; n <= TOTAL; n++) {
    await expect(page.getByRole('heading', { name: `Headline ${n}` })).toBeVisible();
    await answerCurrent(page);
  }

  await expect(page.getByText('Could not finish the session').first()).toBeVisible();
  await page.getByRole('button', { name: "See today's results" }).click();
  await expect(page.getByRole('button', { name: 'See my streak' })).toBeVisible();
  expect(api.completeCalls).toBe(2);
  expect(api.votes).toHaveLength(TOTAL);
});

test('the network coming back does not move the user back a screen', async ({ page }) => {
  await page.clock.install();
  const api = new FakeDaily([item(1), item(2), item(3)], 4);
  await open(page, api);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  for (let n = 1; n <= TOTAL; n++) {
    await expect(page.getByRole('heading', { name: `Headline ${n}` })).toBeVisible();
    await answerCurrent(page);
  }
  await page.getByRole('button', { name: 'See my streak' }).click();
  await expect(page.getByRole('heading', { name: 'Streak boosted' })).toBeVisible();

  await reconnectLater(page, api);

  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: 'Streak boosted' })).toBeVisible();
});

test('the network coming back does not replace a question with a loading screen', async ({ page }) => {
  await page.clock.install();
  const api = new FakeDaily([item(1), item(2), item(3)], 0);
  await open(page, api);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /^Vote on this/ }).click();
  await page.getByRole('radio', { name: 'Mixed answer' }).click();

  // The refetch is slow, so the page can be looked at while it is still waiting for the answer.
  api.delayGetMs = 1500;
  await reconnectLater(page, api);

  // Still on the question, with the chosen answer still chosen, and no loading screen. These are
  // one-shot counts, not retrying assertions: the request is still in flight right now.
  expect(await page.locator('[aria-busy="true"]').count(), 'a loading screen replaced the question').toBe(0);
  expect(await page.getByRole('heading', { name: 'Question 1?' }).count(), 'the question left the screen').toBe(1);
  await expect(page.getByRole('radio', { name: 'Mixed answer' })).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(1800);
  await expect(page.getByRole('radio', { name: 'Mixed answer' })).toHaveAttribute('aria-checked', 'true');
});

test('a double-click on Save sends the answer once', async ({ page }) => {
  const api = new FakeDaily([item(1), item(2), item(3)], 0);
  await open(page, api);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /^Vote on this/ }).click();
  await page.getByRole('radio', { name: 'State answer' }).click();

  const save = page.getByRole('button', { name: 'Save answer' });
  // Two clicks in ONE task share a render, as a real double-click can.
  await save.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByRole('heading', { name: 'Headline 2' })).toBeVisible();
  expect(api.votes).toHaveLength(1);
  await expect(position(page, 2)).toBeVisible();
});

test('the close button leaves the session, and the app lets the user stay out for the day', async ({ page }) => {
  const api = new FakeDaily([item(1), item(2), item(3)], 3);
  await open(page, api, '/');

  // The first visit of the day opens the session.
  await expect(page).toHaveURL(/\/daily-session$/);
  await page.getByRole('link', { name: 'Close daily vote' }).click();

  // It stays closed: not bounced back, not after a reload either.
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.reload();
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe('/');

  // And the session is still there when the user asks for it.
  await page.goto('/daily-session');
  await expect(page.getByText('3 days running')).toBeVisible();
});

test('coming back to a finished session shows the streak without claiming a new boost', async ({ page }) => {
  const api = new FakeDaily([item(1, true), item(2, true), item(3, true)], 4);
  api.finished();
  await open(page, api);

  await expect(page.getByText(`${TOTAL} of ${TOTAL} answered`)).toBeVisible();
  await page.getByRole('button', { name: 'See my streak' }).click();
  await expect(page.getByRole('heading', { name: 'Your streak' })).toBeVisible();
  await expect(page.getByText('+1 day locked in')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Streak boosted' })).toHaveCount(0);
});
