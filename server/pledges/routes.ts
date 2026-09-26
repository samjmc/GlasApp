/**
 * /api/pledges, mounted once. `{ success, data }` envelope throughout.
 *
 *   GET    /                         every pledge, or ?party=<name>
 *   GET    /parties                  each party's record, weighted by the viewer's
 *                                    priorities when they have ranked, else everyone's
 *   GET    /priorities               everyone's combined priorities, and the caller's own
 *   PUT    /priorities               { ranking: [category, ...] }, most important first
 *   GET    /:id                      one pledge with its evidence
 *   POST   /                         create             (admin)
 *   PATCH  /:id                      edit / set status  (admin)
 *   DELETE /:id                                         (admin)
 *   POST   /:id/evidence             add evidence       (admin)
 *   DELETE /evidence/:evidenceId                        (admin)
 *
 * Writes need a signed-in human admin, not the job secret: deciding a pledge's status is
 * editorial, and every such write is attributed in the admin log.
 */
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { logAdminAction, optionalAuth, requireAdmin, requireAuth } from '../auth';
import { EVIDENCE_KINDS, PLEDGE_CATEGORIES, PLEDGE_STATUSES, type PledgeCategory } from '@shared/pledges';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import * as repo from './repository';
import { communityWeights, rankingsByUser, summariseParty, weightsFromRanking } from './score';

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

class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
const CODES = { 400: 'VALIDATION_ERROR', 404: 'NOT_FOUND', 409: 'CONFLICT' } as const;

const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    try {
      const data = await fn(req, res);
      if (!res.headersSent) res.json(formatSuccess(data));
    } catch (error) {
      if (error instanceof HttpError) res.status(error.status).json(formatError(CODES[error.status], error.message));
      else if (error instanceof z.ZodError)
        res.status(400).json(formatError('VALIDATION_ERROR', error.issues[0]?.message ?? 'Invalid request'));
      else {
        console.error(`[pledges] ${req.method} ${req.originalUrl} failed:`, error);
        res.status(500).json(formatError('INTERNAL_ERROR', 'Something went wrong'));
      }
    }
  };

const found = <T>(value: T | null | false, what: string): T => {
  if (!value) throw new HttpError(404, `${what} not found`);
  return value;
};

export const pledgesRouter = Router();

pledgesRouter.get(
  '/',
  handle(async (req) => {
    const party = typeof req.query.party === 'string' && req.query.party.trim() ? req.query.party.trim() : undefined;
    return repo.listPledges(party);
  }),
);

pledgesRouter.get(
  '/parties',
  optionalAuth,
  handle(async (req) => {
    const [all, rows, mine] = await Promise.all([
      repo.listPledges(),
      repo.allPriorityRows(),
      req.user ? repo.userRanking(req.user.id) : Promise.resolve(null),
    ]);
    const weights = mine ? weightsFromRanking(mine) : communityWeights(Array.from(rankingsByUser(rows).values()));
    const hasWeights = Object.keys(weights).length > 0;

    // Grouped case-insensitively, like the unique index and ?party=: "Sinn Féin" and "sinn féin" are one party.
    const byParty = new Map<string, { party: string; list: typeof all }>();
    for (const pledge of all) {
      const key = pledge.party.toLowerCase();
      if (!byParty.has(key)) byParty.set(key, { party: pledge.party, list: [] });
      byParty.get(key)!.list.push(pledge);
    }
    return Array.from(byParty.values())
      .map(({ party, list }) => summariseParty(party, list, hasWeights ? weights : null))
      .sort((a, b) => a.party.localeCompare(b.party));
  }),
);

pledgesRouter.get(
  '/priorities',
  optionalAuth,
  handle(async (req) => {
    const rankings = rankingsByUser(await repo.allPriorityRows());
    return {
      community: communityWeights(Array.from(rankings.values())),
      rankers: rankings.size,
      mine: req.user ? (rankings.get(req.user.id) ?? null) : null,
    };
  }),
);

pledgesRouter.put(
  '/priorities',
  requireAuth,
  handle(async (req) => {
    const { ranking } = rankingBody.parse(req.body);
    await repo.saveRanking(req.user!.id, ranking as PledgeCategory[]);
    return { mine: ranking.length ? ranking : null };
  }),
);

pledgesRouter.get(
  '/:id',
  handle(async (req) => found(await repo.pledgeWithEvidence(idParam.parse(req.params.id)), 'Pledge')),
);

pledgesRouter.post(
  '/',
  requireAdmin,
  handle(async (req, res) => {
    const body = pledgeBody.parse(req.body);
    const created = await repo.createPledge({ ...body, targetDate: body.targetDate ?? null });
    if (!created) throw new HttpError(409, 'This party already has a pledge with that title for that election');
    logAdminAction(req, 'pledge.create', { id: created.id, party: created.party });
    res.status(201);
    return created;
  }),
);

pledgesRouter.patch(
  '/:id',
  requireAdmin,
  handle(async (req) => {
    const id = idParam.parse(req.params.id);
    const changes = pledgeChanges.parse(req.body);
    const updated = found(
      await repo.updatePledge(id, changes).catch((error) => {
        if ((error as { code?: string }).code === '23505') {
          throw new HttpError(409, 'This party already has a pledge with that title for that election');
        }
        throw error;
      }),
      'Pledge',
    );
    logAdminAction(req, 'pledge.update', { id, fields: Object.keys(changes) });
    return updated;
  }),
);

pledgesRouter.delete(
  '/:id',
  requireAdmin,
  handle(async (req) => {
    const id = idParam.parse(req.params.id);
    found(await repo.deletePledge(id), 'Pledge');
    logAdminAction(req, 'pledge.delete', { id });
    return null;
  }),
);

pledgesRouter.post(
  '/:id/evidence',
  requireAdmin,
  handle(async (req, res) => {
    const pledgeId = idParam.parse(req.params.id);
    const body = evidenceBody.parse(req.body);
    const added = await repo.addEvidence({ ...body, pledgeId, divisionId: body.divisionId || null }).catch((error) => {
      if (error instanceof repo.UnknownDivisionError) throw new HttpError(400, error.message);
      throw error;
    });
    const evidence = found(added, 'Pledge');
    logAdminAction(req, 'pledge.evidence.add', { pledgeId, evidenceId: evidence.id });
    res.status(201);
    return evidence;
  }),
);

pledgesRouter.delete(
  '/evidence/:evidenceId',
  requireAdmin,
  handle(async (req) => {
    const id = idParam.parse(req.params.evidenceId);
    found(await repo.deleteEvidence(id), 'Evidence');
    logAdminAction(req, 'pledge.evidence.delete', { id });
    return null;
  }),
);
