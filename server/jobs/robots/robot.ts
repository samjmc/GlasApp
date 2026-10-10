/**
 * One robot's journey through the app over HTTP (docs/plans/robot-run.md), and the recorder that
 * keeps every call's route, status and time. A response the journey did not expect is a
 * finding, recorded with the route and status; nothing is retried.
 */
import type { IdeologyVector } from '@shared/ideology';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { mulberry32, type Rng } from '../../quiz/testing/respondents';
import { nearestOption, pledgeRanking, takeQuiz, type OptionVectors } from './choose';

export type RobotKind = 'finisher' | 'refuser' | 'withdrawer' | 'anonymous';

export interface Robot {
  n: number;
  kind: RobotKind;
  /** Sent as X-Forwarded-For; the server trusts one proxy hop, as in production. */
  ip: string;
  latent: IdeologyVector;
  noise: number;
  seed: number;
}

export interface WorldQuestion {
  id: number;
  articleId: number;
  options: OptionVectors;
}

export interface World {
  base: string;
  questions: Map<number, WorldQuestion>;
  offsets: Map<number, number>;
  recorder: Recorder;
}

interface Sample {
  statuses: Record<number, number>;
  ms: number[];
}

export class Recorder {
  readonly routes = new Map<string, Sample>();
  readonly findings: string[] = [];

  record(route: string, status: number, ms: number): void {
    const sample = this.routes.get(route) ?? { statuses: {}, ms: [] };
    sample.statuses[status] = (sample.statuses[status] ?? 0) + 1;
    sample.ms.push(ms);
    this.routes.set(route, sample);
  }

  finding(text: string): void {
    this.findings.push(text);
  }
}

/** `/api/votes/questions/123` → `/api/votes/questions/:id`, so a route's calls group together. */
export function routeLabel(method: string, path: string): string {
  return `${method} ${path.replace(/\/\d+(?=\/|$)/g, '/:id')}`;
}

interface Reply {
  status: number;
  body: any;
}

async function call(world: World, robot: Robot, method: string, path: string, body?: unknown, signedIn = true): Promise<Reply> {
  const headers: Record<string, string> = { 'x-forwarded-for': robot.ip, connection: 'keep-alive' };
  if (signedIn) headers.authorization = `Bearer robot-${robot.n}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const started = performance.now();
  const res = await fetch(world.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const parsed = await res.json().catch(() => null);
  world.recorder.record(routeLabel(method, path), res.status, performance.now() - started);
  return { status: res.status, body: parsed };
}

/** Records a finding unless the status is one the journey expects here. */
function expect(world: World, robot: Robot, what: string, reply: Reply, ok: number[]): boolean {
  if (ok.includes(reply.status)) return true;
  world.recorder.finding(`${robot.kind} robot-${robot.n}: ${what} answered ${reply.status} (expected ${ok.join(' or ')})`);
  return false;
}

export interface Outcome {
  quizSaved: boolean;
  votes: number;
  articleVotes: number;
  rateLimited: number;
}

export async function runRobot(world: World, robot: Robot, articleQuestions = 5): Promise<Outcome> {
  const rng: Rng = mulberry32(robot.seed ^ 0x5eed);
  const outcome: Outcome = { quizSaved: false, votes: 0, articleVotes: 0, rateLimited: 0 };
  const consents = robot.kind === 'finisher' || robot.kind === 'withdrawer';
  const answers = takeQuiz(robot.seed, robot.latent, robot.noise, world.offsets, rng);

  if (robot.kind === 'anonymous') {
    const quiz = await call(world, robot, 'POST', '/api/quiz', { answers, seed: robot.seed }, false);
    if (expect(world, robot, 'anonymous quiz', quiz, [200]) && quiz.body?.data?.id !== null) {
      world.recorder.finding(`anonymous robot-${robot.n}: quiz came back with an id; an anonymous quiz must not be saved`);
    }
    return outcome;
  }

  expect(world, robot, 'profile', await call(world, robot, 'GET', '/api/profile/me'), [200]);
  if (consents) {
    expect(world, robot, 'consent', await call(world, robot, 'PUT', '/api/account/consent/political', { version: POLITICAL_CONSENT_VERSION }), [200]);
  }

  const quiz = await call(world, robot, 'POST', '/api/quiz', { answers, seed: robot.seed });
  if (expect(world, robot, 'quiz', quiz, [200])) {
    outcome.quizSaved = quiz.body?.data?.id !== null && quiz.body?.data?.id !== undefined;
    if (outcome.quizSaved !== consents) {
      world.recorder.finding(`${robot.kind} robot-${robot.n}: quiz ${outcome.quizSaved ? 'was' : 'was not'} saved`);
    }
  }

  const vote = async (what: string, path: string, options: OptionVectors | undefined) => {
    if (!options) {
      world.recorder.finding(`robot-${robot.n}: ${what} has no option vectors in the copied questions`);
      return false;
    }
    const reply = await call(world, robot, 'POST', path, { optionKey: nearestOption(options, robot.latent, robot.noise, rng) });
    if (reply.status === 429) {
      outcome.rateLimited += 1;
      return false;
    }
    return expect(world, robot, what, reply, consents ? [200] : [403]) && reply.status === 200;
  };

  // Opening today's session stores it, so without consent it is refused.
  const session = await call(world, robot, 'GET', '/api/daily-session');
  if (expect(world, robot, 'daily session', session, consents ? [200] : [403]) && session.status === 200) {
    const items: Array<{ sessionItemId: number; questionId: number; hasVoted: boolean }> = session.body?.data?.items ?? [];
    if (items.length === 0) world.recorder.finding(`robot-${robot.n}: the daily session had no items`);
    for (const item of items) {
      if (await vote('daily vote', `/api/daily-session/items/${item.sessionItemId}/vote`, world.questions.get(item.questionId)?.options)) outcome.votes += 1;
    }
    if (items.length > 0) {
      const complete = await call(world, robot, 'POST', '/api/daily-session/complete');
      expect(world, robot, 'complete', complete, outcome.votes === items.length ? [200] : [400, 404]);
    }
  }

  const all = [...world.questions.values()];
  for (let k = 0; k < articleQuestions && all.length > 0; k++) {
    const picked = all[Math.floor(rng() * all.length)]!;
    const view = await call(world, robot, 'GET', `/api/votes/articles/${picked.articleId}`);
    if (!expect(world, robot, 'article question', view, [200])) continue;
    const questionId: number | undefined = view.body?.data?.question?.id;
    if (!questionId) {
      world.recorder.finding(`robot-${robot.n}: article ${picked.articleId} returned no question`);
      continue;
    }
    if (await vote('article vote', `/api/votes/questions/${questionId}`, world.questions.get(questionId)?.options)) outcome.articleVotes += 1;
  }

  expect(world, robot, 'pledge ranking', await call(world, robot, 'PUT', '/api/pledges/priorities', { ranking: pledgeRanking(rng) }), consents ? [200] : [403]);
  for (const path of ['/api/ideology/me', '/api/ideology/me/matches', '/api/quiz/me']) {
    expect(world, robot, path, await call(world, robot, 'GET', path), [200]);
  }

  if (robot.kind === 'withdrawer') {
    expect(world, robot, 'withdraw', await call(world, robot, 'DELETE', '/api/account/consent/political'), [200]);
  }
  return outcome;
}
