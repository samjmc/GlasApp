/**
 * /api/pledges, mounted once. `{ success, data }` envelope throughout.
 *
 *   GET    /                         every pledge, or ?party=<name>
 *   GET    /parties                  each party's record, weighted by the viewer's
 *                                    priorities when they have ranked, else everyone's
 *   GET    /priorities               everyone's combined priorities, and the caller's own
 *   PUT    /priorities               { ranking: [category, ...] }, most important first
 *                                    (a ranking shows political opinions: needs the caller's consent)
 *   GET    /:id                      one pledge with its evidence
 *   POST   /                         create             (admin)
 *   PATCH  /:id                      edit / set status  (admin)
 *   DELETE /:id                                         (admin)
 *   POST   /:id/evidence             add evidence       (admin)
 *   DELETE /evidence/:evidenceId                        (admin)
 *
 * Writes need a signed-in human admin, not the job secret: deciding a pledge's status is
 * editorial, and every such write is attributed in the admin log. The viewer on the GET routes
 * comes from the app-wide optionalAuth in server/routes.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requirePoliticalConsent } from '../account/consent';
import { logAdminAction, requireAdmin, requireAuth } from '../auth';
import { EVIDENCE_KINDS, PLEDGE_CATEGORIES, PLEDGE_STATUSES, type PledgeCategory } from '@shared/pledges';
import { AppError } from '../utils/errors';
import { formatSuccess } from '../utils/responseFormatters';
import * as repo from './repository';
import { publishableCommunity, summariseParty, weightsFromRanking } from './score';

const idParam = z.coerce.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const sourceUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) link');

const pledgeBody = z.object({
  party: z.string().trim().min(1).max(100),
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().min(3).max(4000),
  category: z.enum(PLEDGE_CATEGORIES),
  electionYear: z.number().int().min(1922).max(2100),
  targetDate: isoDate.nullable().optional(),
  sourceUrl,
});
const pledgeChanges = pledgeBody
  .partial()
  .extend({
    status: z.enum(PLEDGE_STATUSES).optional(),
    statusNote: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change');
const evidenceBody = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  summary: z.string().trim().min(3).max(2000),
  occurredOn: isoDate,
  sourceUrl,
  divisionId: z.string().trim().max(80).nullable().optional(),
});
const rankingBody = z.object({
  ranking: z
    .array(z.enum(PLEDGE_CATEGORIES))
    .max(PLEDGE_CATEGORIES.length)
    .refine((list) => new Set(list).size === list.length, 'Each category can appear once'),
});

// A parse failure (ZodError), an AppError and a ConsentRequiredError are answered by the central error handler.
const duplicate = () => new AppError(409, 'CONFLICT', 'This party already has a pledge with that title for that election');

const found = <T>(value: T | null | false, what: string): T => {
  if (!value) throw new AppError(404, 'NOT_FOUND', `${what} not found`);
  return value;
};

export const pledgesRouter = Router();

pledgesRouter.get('/', async (req, res) => {
  const party = typeof req.query.party === 'string' && req.query.party.trim() ? req.query.party.trim() : undefined;
  res.json(formatSuccess(await repo.listPledges(party)));
});

pledgesRouter.get('/parties', async (req, res) => {
  // Everyone's weights are read only when the viewer has no ranking of their own.
  const [all, weights] = await Promise.all([
    repo.listPledges(),
    (req.user ? repo.userRanking(req.user.id) : Promise.resolve(null)).then(async (mine) =>
      mine ? weightsFromRanking(mine) : publishableCommunity(await repo.communityPriorities()).weights,
    ),
  ]);
  const hasWeights = Object.keys(weights).length > 0;

  // Grouped case-insensitively, like the unique index and ?party=: "Sinn Féin" and "sinn féin" are one party.
  const byParty = new Map<string, { party: string; list: typeof all }>();
  for (const pledge of all) {
    const key = pledge.party.toLowerCase();
    if (!byParty.has(key)) byParty.set(key, { party: pledge.party, list: [] });
    byParty.get(key)!.list.push(pledge);
  }
  const summaries = Array.from(byParty.values())
    .map(({ party, list }) => summariseParty(party, list, hasWeights ? weights : null))
    .sort((a, b) => a.party.localeCompare(b.party));
  res.json(formatSuccess(summaries));
});

pledgesRouter.get('/priorities', async (req, res) => {
  const [community, mine] = await Promise.all([
    repo.communityPriorities().then(publishableCommunity),
    req.user ? repo.userRanking(req.user.id) : Promise.resolve(null),
  ]);
  res.json(formatSuccess({ community: community.weights, rankers: community.rankers, mine }));
});

pledgesRouter.put('/priorities', requireAuth, requirePoliticalConsent, async (req, res) => {
  const { ranking } = rankingBody.parse(req.body);
  await repo.saveRanking(req.user!.id, ranking as PledgeCategory[]);
  res.json(formatSuccess({ mine: ranking.length ? ranking : null }));
});

pledgesRouter.get('/:id', async (req, res) => {
  res.json(formatSuccess(found(await repo.pledgeWithEvidence(idParam.parse(req.params.id)), 'Pledge')));
});

pledgesRouter.post('/', requireAdmin, async (req, res) => {
  const body = pledgeBody.parse(req.body);
  const created = await repo.createPledge({ ...body, targetDate: body.targetDate ?? null });
  if (!created) throw duplicate();
  logAdminAction(req, 'pledge.create', { id: created.id, party: created.party });
  res.status(201).json(formatSuccess(created));
});

pledgesRouter.patch('/:id', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const changes = pledgeChanges.parse(req.body);
  const updated = found(
    await repo.updatePledge(id, changes).catch((error) => {
      if ((error as { code?: string }).code === '23505') throw duplicate();
      throw error;
    }),
    'Pledge',
  );
  logAdminAction(req, 'pledge.update', { id, fields: Object.keys(changes) });
  res.json(formatSuccess(updated));
});

pledgesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  found(await repo.deletePledge(id), 'Pledge');
  logAdminAction(req, 'pledge.delete', { id });
  res.json(formatSuccess(null));
});

pledgesRouter.post('/:id/evidence', requireAdmin, async (req, res) => {
  const pledgeId = idParam.parse(req.params.id);
  const body = evidenceBody.parse(req.body);
  const added = await repo.addEvidence({ ...body, pledgeId, divisionId: body.divisionId || null }).catch((error) => {
    if (error instanceof repo.UnknownDivisionError) throw new AppError(400, 'VALIDATION_ERROR', error.message);
    throw error;
  });
  const evidence = found(added, 'Pledge');
  logAdminAction(req, 'pledge.evidence.add', { pledgeId, evidenceId: evidence.id });
  res.status(201).json(formatSuccess(evidence));
});

pledgesRouter.delete('/evidence/:evidenceId', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.evidenceId);
  found(await repo.deleteEvidence(id), 'Evidence');
  logAdminAction(req, 'pledge.evidence.delete', { id });
  res.json(formatSuccess(null));
});
