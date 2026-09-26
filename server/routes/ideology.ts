/**
 * /api/ideology — where you, TDs and parties sit on the eight dimensions, and who you are
 * closest to. Every response is `{ success, data }` via formatSuccess.
 */
import { requireAuth } from '../auth';
import { Router } from 'express';
import { z } from 'zod';
import { IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT } from '@shared/ideology';
import { asyncHandler } from '../middleware/errorHandler';
import { MAX_DIMENSION_WEIGHT } from '../ideology/alignment';
import { getIdeologyProfile, matchesFor, partyProfile, tdProfile, userMatches, userTimeline } from '../ideology';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const axis = z.number().min(-IDEOLOGY_LIMIT).max(IDEOLOGY_LIMIT);
const vectorSchema = z.object(Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, axis])) as Record<(typeof IDEOLOGY_DIMENSIONS)[number], typeof axis>);
const weightsSchema = z
  .object(Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, z.number().min(0).max(MAX_DIMENSION_WEIGHT).optional()])))
  .partial()
  .default({});

/** `?weights=economic:2,welfare:0.5` → weights. Unknown dimensions are ignored. */
function parseWeights(raw: unknown) {
  if (typeof raw !== 'string' || raw === '') return {};
  const pairs = raw.split(',').map((p) => p.split(':'));
  return weightsSchema.parse(Object.fromEntries(pairs.filter(([d]) => (IDEOLOGY_DIMENSIONS as readonly string[]).includes(d!)).map(([d, w]) => [d, Number(w)])));
}

/** GET /api/ideology/me — the signed-in user's position; null before any quiz or vote. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(formatSuccess({ vector: await getIdeologyProfile(req.user!.id) }));
  }),
);

/** GET /api/ideology/me/timeline?party=Sinn%20Féin — daily positions, with an optional party to compare. */
router.get(
  '/me/timeline',
  requireAuth,
  asyncHandler(async (req, res) => {
    const party = typeof req.query.party === 'string' && req.query.party ? await partyProfile(req.query.party) : null;
    res.json(formatSuccess({ points: await userTimeline(req.user!.id), party }));
  }),
);

/**
 * GET /api/ideology/me/matches?weights=…&td=<id> — TDs and parties closest to the signed-in user,
 * on the dimensions the user has evidence on (`meta.measured`). Each TD carries `issues`, the
 * daily-vote questions both answered; its items are listed for the top 5 and for `td`.
 */
router.get(
  '/me/matches',
  requireAuth,
  asyncHandler(async (req, res) => {
    const td = z.coerce.number().int().positive().safeParse(req.query.td);
    const result = await userMatches(req.user!.id, parseWeights(req.query.weights), td.success ? { tdId: td.data } : {});
    if (!result) return res.json(formatSuccess({ tds: [], parties: [] }, { hasProfile: false, measured: [] }));
    const { measured, ...matches } = result;
    res.json(formatSuccess(matches, { hasProfile: true, measured }));
  }),
);

const matchesSchema = z.object({ vector: vectorSchema, weights: weightsSchema });

/** POST /api/ideology/matches — matches for any position. Public: anonymous quiz takers use it. Stateless. */
router.post(
  '/matches',
  asyncHandler(async (req, res) => {
    const body = matchesSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('Invalid position', 'VALIDATION_ERROR', body.error.flatten()));
    res.json(formatSuccess(await matchesFor(body.data.vector, body.data.weights)));
  }),
);

/** GET /api/ideology/td/:id */
router.get(
  '/td/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json(formatError('Invalid TD id', 'VALIDATION_ERROR'));
    const data = await tdProfile(id.data);
    if (!data) return res.status(404).json(formatError('TD not found', 'NOT_FOUND'));
    res.json(formatSuccess(data));
  }),
);

/** GET /api/ideology/party/:name */
router.get(
  '/party/:name',
  asyncHandler(async (req, res) => {
    const data = await partyProfile(req.params.name!);
    if (!data) return res.status(404).json(formatError('Party not found', 'NOT_FOUND'));
    res.json(formatSuccess(data));
  }),
);

export default router;
