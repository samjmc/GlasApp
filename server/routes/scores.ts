/**
 * /api/scores — the one router for TD, party and constituency scores.
 * Reads only, except the admin recalculate trigger. Every response is
 * `{ success, data, meta? }` via formatSuccess.
 */
import { requireJob } from '../auth';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { DIMENSIONS, eloToPercent, recalculateAll, repository as repo, scoreLabel } from '../scoring';
import type { TdWithScore } from '../scoring/repository';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const idParam = z.coerce.number().int().positive();

/** The shape every list and card in the client works from. */
export function tdCard({ td, score }: TdWithScore) {
  const overallScore = score?.overallScore ?? null;
  return {
    id: td.id,
    name: td.name,
    party: td.party,
    constituency: td.constituency,
    imageUrl: td.imageUrl,
    gender: td.gender,
    overallScore,
    label: overallScore === null ? null : scoreLabel(overallScore),
    overallElo: score?.overallElo ?? 1500,
    newsScore: score?.newsScore ?? null,
    parliamentaryScore: score?.parliamentaryScore ?? null,
    debateScore: score?.debateScore ?? null,
    nationalRank: score?.nationalRank ?? null,
    partyRank: score?.partyRank ?? null,
    constituencyRank: score?.constituencyRank ?? null,
    eloChange7d: score?.eloChange7d ?? 0,
    eloChange30d: score?.eloChange30d ?? 0,
    totalStories: score?.totalStories ?? 0,
    lastScoredAt: score?.lastScoredAt ?? null,
  };
}

export type TdCard = ReturnType<typeof tdCard>;

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
}

function partyBreakdown(rows: TdWithScore[]) {
  const counts = new Map<string, number>();
  for (const { td } of rows) {
    const party = td.party ?? 'Independent';
    counts.set(party, (counts.get(party) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([party, count]) => ({ party, count, percentage: Math.round((count / rows.length) * 100) }))
    .sort((a, b) => b.count - a.count || a.party.localeCompare(b.party));
}

function genderBreakdown(rows: TdWithScore[]) {
  const male = rows.filter((r) => r.td.gender?.toLowerCase() === 'male').length;
  const female = rows.filter((r) => r.td.gender?.toLowerCase() === 'female').length;
  return {
    male,
    female,
    unknown: rows.length - male - female,
    femalePercentage: rows.length ? Math.round((female / rows.length) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// TDs
// ---------------------------------------------------------------------------

/** GET /api/scores/tds — every active TD, best first. */
router.get(
  '/tds',
  asyncHandler(async (_req, res) => {
    const [rows, baselines] = await Promise.all([repo.listActive(), repo.listBaselines()]);
    const researched = new Set(baselines.filter((b) => b.historicalSummary).map((b) => b.tdId));
    const data = rows.map((r) => ({ ...tdCard(r), hasResearch: researched.has(r.td.id) }));
    res.json(formatSuccess(data, { count: data.length, researchedCount: researched.size }));
  }),
);

/** GET /api/scores/widget — homepage: top, bottom, movers, totals. */
router.get(
  '/widget',
  asyncHandler(async (_req, res) => {
    const [rows, movers] = await Promise.all([repo.listActive(), repo.movers(30, 6)]);
    const scored = rows.filter((r) => r.score?.overallScore != null).map(tdCard);
    const lastScored = rows.reduce<Date | null>((latest, r) => {
      const at = r.score?.lastScoredAt ?? null;
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    res.json(
      formatSuccess({
        top: scored.slice(0, 5),
        bottom: scored.slice(-5).reverse(),
        movers: movers.map((m) => ({
          ...tdCard(m),
          eloDelta: m.delta,
          scoreDelta: Math.round(m.delta / 10),
          articles: m.articles,
        })),
        stats: {
          totalTds: rows.length,
          scoredTds: scored.length,
          storiesAnalysed: rows.reduce((sum, r) => sum + (r.score?.totalStories ?? 0), 0),
          lastScoredAt: lastScored,
        },
      }),
    );
  }),
);

/** GET /api/scores/td/:name — full profile + score breakdown. */
router.get(
  '/td/:name',
  asyncHandler(async (req, res) => {
    const row = await repo.findByName(req.params.name);
    if (!row) return res.status(404).json(formatError('ENTITY_NOT_FOUND', `TD "${req.params.name}" not found`));
    const [baseline, recent] = await Promise.all([repo.baselineFor(row.td.id), repo.recentArticleScores(row.td.id, 10)]);
    const { td, score } = row;
    const dimensions = Object.fromEntries(
      DIMENSIONS.map((d) => {
        const elo = score?.[`${d}Elo` as const] ?? 1500;
        return [d, { elo, score: eloToPercent(elo) }];
      }),
    );
    res.json(
      formatSuccess({
        ...tdCard(row),
        memberCode: td.memberCode,
        bio: td.bio,
        offices: td.offices ?? [],
        committees: td.committees ?? [],
        questions: {
          oral: td.questionCountOral,
          written: td.questionCountWritten,
        },
        attendancePct: td.attendancePct,
        committeeAttendancePct: td.committeeAttendancePct,
        dimensions,
        baseline: baseline
          ? {
              summary: baseline.historicalSummary,
              category: baseline.category,
              confidence: baseline.confidence,
              keyFindings: baseline.keyFindings ?? [],
              researchDate: baseline.researchDate,
            }
          : null,
        recentArticles: recent.map((a) => ({
          articleId: a.articleId,
          impact: a.impact,
          storyType: a.storyType,
          sentiment: a.sentiment,
          reasoning: a.reasoning,
          needsReview: a.needsReview,
          at: a.createdAt,
        })),
      }),
    );
  }),
);

/** GET /api/scores/td/:id/summary — quick-info modal. */
router.get(
  '/td/:id/summary',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'id must be a positive integer'));
    const row = await repo.findById(id.data);
    if (!row) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'TD not found'));
    const { td } = row;
    res.json(
      formatSuccess({
        ...tdCard(row),
        officeCount: td.offices?.length ?? 0,
        committeeCount: td.committees?.length ?? 0,
        topOffice: td.offices?.[0]?.title ?? null,
        topCommittee: td.committees?.[0] ?? null,
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

/** GET /api/scores/parties — ranked party aggregates. */
router.get(
  '/parties',
  asyncHandler(async (_req, res) => {
    const rows = await repo.listPartyScores();
    const data = rows.map((p, i) => ({
      rank: i + 1,
      party: p.party,
      memberCount: p.memberCount,
      avgElo: p.avgElo,
      overallScore: p.overallScore,
      label: scoreLabel(p.overallScore),
      computedAt: p.computedAt,
    }));
    res.json(formatSuccess(data, { count: data.length }));
  }),
);

/** GET /api/scores/party/:name — members and aggregate for one party. */
router.get(
  '/party/:name',
  asyncHandler(async (req, res) => {
    const members = await repo.listByParty(req.params.name);
    if (members.length === 0) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'Party not found'));
    const cards = members.map(tdCard);
    res.json(
      formatSuccess({
        party: members[0].td.party,
        size: members.length,
        averageScore: average(cards.map((c) => c.overallScore)),
        genderBreakdown: genderBreakdown(members),
        constituencyCount: new Set(members.map((m) => m.td.constituency).filter(Boolean)).size,
        members: cards,
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Constituencies
// ---------------------------------------------------------------------------

/** GET /api/scores/constituencies — names only. */
router.get(
  '/constituencies',
  asyncHandler(async (_req, res) => {
    const names = await repo.listConstituencies();
    res.json(formatSuccess(names.map((name) => ({ name })), { count: names.length }));
  }),
);

/** GET /api/scores/constituencies/summary — one entry per constituency, for the map. */
router.get(
  '/constituencies/summary',
  asyncHandler(async (_req, res) => {
    const rows = (await repo.listActive()).filter((r) => r.td.constituency);
    const groups = new Map<string, TdWithScore[]>();
    for (const r of rows) {
      const key = r.td.constituency as string;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const constituencies = Array.from(groups.entries())
      .map(([name, members]) => {
        const parties = partyBreakdown(members);
        return {
          name,
          tdCount: members.length,
          leadingParty: parties[0]?.party ?? null,
          leadingPartyCount: parties[0]?.count ?? 0,
          averageScore: average(members.map((m) => m.score?.overallScore ?? null)),
          parties,
          genderBreakdown: genderBreakdown(members),
          tds: members.map(tdCard),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(formatSuccess({ constituencies, totalConstituencies: constituencies.length, totalTds: rows.length }));
  }),
);

/** GET /api/scores/constituency/:name — one constituency in detail. */
router.get(
  '/constituency/:name',
  asyncHandler(async (req, res) => {
    const members = await repo.listByConstituency(req.params.name);
    if (members.length === 0) {
      return res.status(404).json(formatError('ENTITY_NOT_FOUND', `Constituency "${req.params.name}" not found`));
    }
    const cards = members.map(tdCard);
    res.json(
      formatSuccess({
        name: members[0].td.constituency,
        tdCount: members.length,
        averageScore: average(cards.map((c) => c.overallScore)),
        parties: partyBreakdown(members),
        genderBreakdown: genderBreakdown(members),
        tds: members.map((m) => ({ ...tdCard(m), offices: m.td.offices ?? [], committees: m.td.committees ?? [] })),
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** POST /api/scores/recalculate — rebuild derived scores, ranks, trends, party aggregates. */
router.post(
  '/recalculate',
  requireJob,
  asyncHandler(async (_req, res) => {
    const summary = await recalculateAll();
    res.json(formatSuccess(summary));
  }),
);

export default router;
