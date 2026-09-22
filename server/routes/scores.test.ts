/**
 * /api/scores router against a mocked repository: envelope, shapes, 404s, admin gate.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.ADMIN_API_SECRET = 'scores-secret';
process.env.LOG_LEVEL = 'silent';

const { state } = vi.hoisted(() => ({
  state: {
    rows: [] as unknown[],
    parties: [] as unknown[],
    baselines: [] as unknown[],
    movers: [] as unknown[],
    recalculated: 0,
  },
}));

vi.mock('../db', () => ({ db: {}, pool: {}, supabaseDb: null, shutdown: vi.fn(), checkDatabaseConnection: vi.fn() }));

vi.mock('../scoring', async () => {
  const weights = await import('../scoring/weights');
  const elo = await import('../scoring/elo');
  const byName = (name: string) =>
    (state.rows as Array<{ td: { name: string } }>).find((r) => r.td.name.toLowerCase() === name.toLowerCase()) ?? null;
  return {
    eloToPercent: weights.eloToPercent,
    scoreLabel: weights.scoreLabel,
    PILLAR_WEIGHTS: weights.PILLAR_WEIGHTS,
    DIMENSIONS: elo.DIMENSIONS,
    recalculateAll: vi.fn(async () => {
      state.recalculated++;
      return { tds: state.rows.length, parties: state.parties.length };
    }),
    repository: {
      listActive: vi.fn(async () => state.rows),
      listBaselines: vi.fn(async () => state.baselines),
      movers: vi.fn(async () => state.movers),
      findByName: vi.fn(async (name: string) => byName(name)),
      findById: vi.fn(async (id: number) => (state.rows as Array<{ td: { id: number } }>).find((r) => r.td.id === id) ?? null),
      baselineFor: vi.fn(async () => null),
      recentArticleScores: vi.fn(async () => []),
      listPartyScores: vi.fn(async () => state.parties),
      listByParty: vi.fn(async (party: string) =>
        (state.rows as Array<{ td: { party: string | null } }>).filter((r) => r.td.party?.toLowerCase() === party.toLowerCase()),
      ),
      listByConstituency: vi.fn(async (c: string) =>
        (state.rows as Array<{ td: { constituency: string | null } }>).filter((r) => r.td.constituency?.toLowerCase() === c.toLowerCase()),
      ),
      listConstituencies: vi.fn(async () =>
        Array.from(new Set((state.rows as Array<{ td: { constituency: string | null } }>).map((r) => r.td.constituency).filter(Boolean))).sort(),
      ),
    },
  };
});

const scoresRouter = (await import('./scores')).default;

function td(id: number, name: string, party: string, constituency: string, overallScore: number | null, overallElo = 1500) {
  return {
    td: {
      id, name, party, constituency, imageUrl: null, gender: 'female', memberCode: null, bio: null,
      offices: [{ title: 'Minister for Health' }], committees: ['Health'],
      questionCountOral: 10, questionCountWritten: 90, attendancePct: 88, isActive: true,
    },
    score: overallScore === null ? null : {
      tdId: id, overallElo, transparencyElo: 1600, effectivenessElo: 1500, integrityElo: 1400, consistencyElo: 1500,
      overallScore, newsScore: 60, parliamentaryScore: 70, debateScore: null,
      nationalRank: 1, partyRank: 1, constituencyRank: 1, eloChange7d: 5, eloChange30d: 12, totalStories: 3,
      lastScoredAt: new Date('2026-09-20T00:00:00Z'),
    },
  };
}

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/scores', scoresRouter);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const get = async (base: string, path: string) => {
  const res = await fetch(base + path, { headers: { connection: 'close' } });
  return { status: res.status, body: (await res.json()) as { success: boolean; data: any; meta?: any; error?: any } };
};

beforeEach(() => {
  state.rows = [
    td(1, 'Mary Lou McDonald', 'Sinn Féin', 'Dublin Central', 72, 1720),
    td(2, 'Simon Harris', 'Fine Gael', 'Wicklow', 65, 1650),
    td(3, 'New Deputy', 'Fine Gael', 'Wicklow', null),
  ];
  state.parties = [
    { party: 'Sinn Féin', memberCount: 1, avgElo: 1720, overallScore: 72, computedAt: new Date() },
    { party: 'Fine Gael', memberCount: 2, avgElo: 1575, overallScore: 58, computedAt: new Date() },
  ];
  state.baselines = [{ tdId: 1, historicalSummary: 'Long record', category: 'moderate_issues', confidence: 0.8, keyFindings: [], researchDate: null }];
  state.movers = [{ ...state.rows[0], delta: 40, articles: 3 }];
  state.recalculated = 0;
});

afterEach(() => vi.clearAllMocks());

describe('GET /api/scores/tds', () => {
  it('returns cards in the envelope with research flags and counts', async () => {
    await withServer(async (base) => {
      const { status, body } = await get(base, '/api/scores/tds');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.meta).toMatchObject({ count: 3, researchedCount: 1 });
      expect(body.data[0]).toMatchObject({ id: 1, name: 'Mary Lou McDonald', overallScore: 72, label: 'Average', hasResearch: true, nationalRank: 1 });
      expect(body.data[2]).toMatchObject({ id: 3, overallScore: null, label: null, overallElo: 1500, hasResearch: false });
    });
  });
});

describe('GET /api/scores/widget', () => {
  it('excludes unscored TDs from top/bottom and reports movers and stats', async () => {
    await withServer(async (base) => {
      const { body } = await get(base, '/api/scores/widget');
      expect(body.data.top.map((t: any) => t.id)).toEqual([1, 2]);
      expect(body.data.bottom.map((t: any) => t.id)).toEqual([2, 1]);
      expect(body.data.movers[0]).toMatchObject({ id: 1, eloDelta: 40, scoreDelta: 4, articles: 3 });
      expect(body.data.stats).toMatchObject({ totalTds: 3, scoredTds: 2, storiesAnalysed: 6 });
    });
  });
});

describe('GET /api/scores/td/:name', () => {
  it('is case-insensitive and includes the four dimensions as elo + percent', async () => {
    await withServer(async (base) => {
      const { status, body } = await get(base, '/api/scores/td/simon%20harris');
      expect(status).toBe(200);
      expect(body.data.name).toBe('Simon Harris');
      expect(body.data.dimensions).toEqual({
        transparency: { elo: 1600, score: 60 },
        effectiveness: { elo: 1500, score: 50 },
        integrity: { elo: 1400, score: 40 },
        consistency: { elo: 1500, score: 50 },
      });
      expect(body.data.questions).toEqual({ oral: 10, written: 90 });
      expect(body.data.baseline).toBeNull();
    });
  });

  it('404s for an unknown TD', async () => {
    await withServer(async (base) => {
      const { status, body } = await get(base, '/api/scores/td/Nobody');
      expect(status).toBe(404);
      expect(body.success).toBe(false);
    });
  });
});

describe('GET /api/scores/td/:id/summary', () => {
  it('returns the quick-info shape and rejects a non-integer id', async () => {
    await withServer(async (base) => {
      const ok = await get(base, '/api/scores/td/1/summary');
      expect(ok.status).toBe(200);
      expect(ok.body.data).toMatchObject({ id: 1, officeCount: 1, committeeCount: 1, topOffice: 'Minister for Health', topCommittee: 'Health' });
      const bad = await get(base, '/api/scores/td/abc/summary');
      expect(bad.status).toBe(400);
    });
  });
});

describe('parties and constituencies', () => {
  it('ranks parties and details one party', async () => {
    await withServer(async (base) => {
      const list = await get(base, '/api/scores/parties');
      expect(list.body.data.map((p: any) => [p.rank, p.party])).toEqual([[1, 'Sinn Féin'], [2, 'Fine Gael']]);
      const one = await get(base, '/api/scores/party/fine%20gael');
      expect(one.body.data).toMatchObject({ party: 'Fine Gael', size: 2, averageScore: 65, constituencyCount: 1 });
      expect(one.body.data.members).toHaveLength(2);
    });
  });

  it('summarises constituencies and details one', async () => {
    await withServer(async (base) => {
      const names = await get(base, '/api/scores/constituencies');
      expect(names.body.data).toEqual([{ name: 'Dublin Central' }, { name: 'Wicklow' }]);
      const summary = await get(base, '/api/scores/constituencies/summary');
      expect(summary.body.data.totalConstituencies).toBe(2);
      const wicklow = summary.body.data.constituencies.find((c: any) => c.name === 'Wicklow');
      expect(wicklow).toMatchObject({ tdCount: 2, leadingParty: 'Fine Gael', leadingPartyCount: 2, averageScore: 65 });
      const detail = await get(base, '/api/scores/constituency/wicklow');
      expect(detail.status).toBe(200);
      expect(detail.body.data.tds[0].offices).toEqual([{ title: 'Minister for Health' }]);
      const missing = await get(base, '/api/scores/constituency/Atlantis');
      expect(missing.status).toBe(404);
    });
  });
});

describe('POST /api/scores/recalculate', () => {
  it('requires admin access and then recalculates', async () => {
    await withServer(async (base) => {
      const denied = await fetch(`${base}/api/scores/recalculate`, { method: 'POST', headers: { connection: 'close' } });
      expect(denied.status).toBe(401);
      expect(state.recalculated).toBe(0);
      const allowed = await fetch(`${base}/api/scores/recalculate`, {
        method: 'POST',
        headers: { connection: 'close', 'x-admin-secret': 'scores-secret' },
      });
      expect(allowed.status).toBe(200);
      expect(((await allowed.json()) as any).data).toEqual({ tds: 3, parties: 2 });
      expect(state.recalculated).toBe(1);
    });
  });
});
