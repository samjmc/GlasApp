/**
 * /api/scores — the one router for TD, party and constituency scores.
 * Reads only, except the admin recalculate trigger. Every response is
 * `{ success, data, meta? }` via formatSuccess.
 */
import { requireJob } from '../auth';
import { Router } from 'express';
import { z } from 'zod';
import type {
  PartyDetail,
  PartyScoreRow,
  ScoresWidget,
  TdCard,
  TdListItem,
  TdProfile,
  TdSummary,
} from '@shared/scoresApi';
import { asyncHandler } from '../middleware/errorHandler';
import { computePartyScores, questionsAsked, recalculateAll, repository as repo, scoreLabel, scoredComponents } from '../scoring';
import type { TdWithScore } from '../scoring/repository';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const idParam = z.coerce.number().int().positive();

/** The shape every list and card in the client works from. */
export function tdCard({ td, score, stats }: TdWithScore): TdCard {
  const overallScore = score?.overallScore ?? null;
  const isPresiding = stats?.isPresiding ?? false;
  return {
    id: td.id,
    name: td.name,
    party: td.party,
    constituency: td.constituency,
    imageUrl: td.imageUrl,
    gender: td.gender,
    isPresiding,
    components: scoredComponents({
      questions: questionsAsked(td.questionCountOral, td.questionCountWritten),
      attendancePct: td.attendancePct,
      committeeAttendancePct: td.committeeAttendancePct,
      debate: score?.debateScore ?? null,
      isPresiding,
    }),
    pillars: { parliamentary: score?.parliamentaryScore ?? null, debate: score?.debateScore ?? null },
    overallScore,
    label: overallScore === null ? null : scoreLabel(overallScore),
    nationalRank: score?.nationalRank ?? null,
    partyRank: score?.partyRank ?? null,
    constituencyRank: score?.constituencyRank ?? null,
    computedAt: score?.computedAt?.toISOString() ?? null,
  };
}

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
    const data: TdListItem[] = rows.map((r) => ({ ...tdCard(r), hasResearch: researched.has(r.td.id) }));
    res.json(formatSuccess(data, { count: data.length, researchedCount: researched.size }));
  }),
);

/** GET /api/scores/widget — homepage: top, bottom, totals. */
router.get(
  '/widget',
  asyncHandler(async (_req, res) => {
    const rows = await repo.listActive();
    const ranked = rows.filter((r) => r.score?.overallScore != null).map(tdCard);
    const computedAt = rows.reduce<string | null>((latest, r) => {
      const at = r.score?.computedAt?.toISOString() ?? null;
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    const data: ScoresWidget = {
      top: ranked.slice(0, 5),
      bottom: ranked.slice(-5).reverse(),
      stats: { totalTds: rows.length, rankedTds: ranked.length, computedAt },
    };
    res.json(formatSuccess(data));
  }),
);

/** GET /api/scores/td/:name — full profile, score breakdown and the facts behind it. */
router.get(
  '/td/:name',
  asyncHandler(async (req, res) => {
    const row = await repo.findByName(req.params.name);
    if (!row) return res.status(404).json(formatError('ENTITY_NOT_FOUND', `TD "${req.params.name}" not found`));
    const baseline = await repo.baselineFor(row.td.id);
    const { td, stats } = row;
    const data: TdProfile = {
      ...tdCard(row),
      memberCode: td.memberCode,
      bio: td.bio,
      offices: td.offices ?? [],
      committees: td.committees ?? [],
      facts: {
        memberSince: stats?.memberSince ?? null,
        votes: { cast: stats?.votesCast ?? null, divisionsEligible: stats?.divisionsEligible ?? null },
        questions: { oral: td.questionCountOral, written: td.questionCountWritten },
        committees: {
          sittingsAttended: stats?.committeeSittingsAttended ?? null,
          sittingsEligible: stats?.committeeSittingsEligible ?? null,
        },
        debate: { sectionsSpoken: stats?.sectionsSpoken ?? null, sittingDays: stats?.sittingDays ?? null },
        recordUrl: td.memberCode ? `https://www.oireachtas.ie/en/members/member/${encodeURIComponent(td.memberCode)}/` : null,
      },
      baseline: baseline
        ? {
            summary: baseline.historicalSummary,
            category: baseline.category,
            confidence: baseline.confidence,
            keyFindings: baseline.keyFindings ?? [],
            researchDate: baseline.researchDate?.toISOString() ?? null,
          }
        : null,
    };
    res.json(formatSuccess(data));
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
    const data: TdSummary = {
      ...tdCard(row),
      officeCount: td.offices?.length ?? 0,
      committeeCount: td.committees?.length ?? 0,
      topOffice: td.offices?.[0]?.title ?? null,
      topCommittee: td.committees?.[0] ?? null,
    };
    res.json(formatSuccess(data));
  }),
);

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

/** GET /api/scores/parties — every party, ranked by the mean of its ranked members' scores. */
router.get(
  '/parties',
  asyncHandler(async (_req, res) => {
    const rows = await repo.listActive();
    const data: PartyScoreRow[] = computePartyScores(
      rows.map((r) => ({ party: r.td.party, overallScore: r.score?.overallScore ?? null })),
    ).map((p) => ({ ...p, label: p.overallScore === null ? null : scoreLabel(p.overallScore) }));
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
    const data: PartyDetail = {
      party: members[0].td.party ?? req.params.name,
      size: members.length,
      averageScore: average(cards.map((c) => c.overallScore)),
      genderBreakdown: genderBreakdown(members),
      constituencyCount: new Set(members.map((m) => m.td.constituency).filter(Boolean)).size,
      members: cards,
    };
    res.json(formatSuccess(data));
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

/** POST /api/scores/recalculate — rebuild derived scores and ranks. */
router.post(
  '/recalculate',
  requireJob,
  asyncHandler(async (_req, res) => {
    const summary = await recalculateAll();
    res.json(formatSuccess(summary));
  }),
);

export default router;
