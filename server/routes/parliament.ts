/**
 * /api/parliament — Dáil divisions, debates and each TD's parliament record.
 * Reads are public; the sync trigger needs the job secret. Every response is
 * `{ success, data, meta? }` via formatSuccess; the data types are shared/parliamentApi.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { LEADERBOARD_METRICS } from '@shared/parliamentApi';
import { absenceReason } from '@shared/schema/parliament';
import { logAdminAction, requireAdmin, requireJob } from '../auth';
import { asyncHandler } from '../middleware/errorHandler';
import { isSyncRunning, leaveWatch, repository as repo, runSync } from '../parliament';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const idParam = z.coerce.number().int().positive();
/** Our own ids: `dail-34-2025-06-25-vote_91`, `dail-2025-06-25-dbsect_19`. */
const recordId = z.string().regex(/^dail-[a-z0-9_-]{1,70}$/);
/** `<year>-<no>`, e.g. "2026-90". */
const billId = z.string().regex(/^\d{4}-\d{1,5}$/);
const page = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

function badRequest(res: import('express').Response, message: string) {
  return res.status(400).json(formatError('VALIDATION_ERROR', message));
}

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess({ feeds: await repo.syncStatus() }));
  }),
);

router.get(
  '/tds/:id',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'TD id must be a positive integer');
    const summary = await repo.tdSummary(id.data);
    if (!summary) return res.status(404).json(formatError('ENTITY_NOT_FOUND', `TD ${id.data} not found`));
    res.json(formatSuccess(summary));
  }),
);

router.get(
  '/tds/:id/votes',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(500).default(20), againstParty: z.enum(['true', 'false']).optional() })
      .safeParse(req.query);
    if (!id.success || !q.success) return badRequest(res, 'Invalid TD id or query');
    res.json(formatSuccess(await repo.votesOf(id.data, { limit: q.data.limit, againstParty: q.data.againstParty === 'true' })));
  }),
);

router.get(
  '/tds/:id/debates',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) }).safeParse(req.query);
    if (!id.success || !q.success) return badRequest(res, 'Invalid TD id or query');
    res.json(formatSuccess(await repo.tdDebates(id.data, q.data.limit)));
  }),
);

router.get(
  '/tds/:id/committees',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'TD id must be a positive integer');
    res.json(formatSuccess(await repo.tdCommittees(id.data)));
  }),
);

router.get(
  '/tds/:id/bills',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(20) }).safeParse(req.query);
    if (!id.success || !q.success) return badRequest(res, 'Invalid TD id or query');
    res.json(formatSuccess(await repo.tdBills(id.data, q.data.limit)));
  }),
);

router.get(
  '/tds/:id/question-topics',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'TD id must be a positive integer');
    res.json(formatSuccess(await repo.tdQuestionTopics(id.data)));
  }),
);

// NULL data (not 404) when nothing is stored yet: the TD exists, the register or file does not.
router.get(
  '/tds/:id/interests',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'TD id must be a positive integer');
    res.json(formatSuccess(await repo.tdInterestsOf(id.data)));
  }),
);

router.get(
  '/tds/:id/allowances',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'TD id must be a positive integer');
    res.json(formatSuccess(await repo.tdAllowancesOf(id.data)));
  }),
);

router.get(
  '/bills',
  asyncHandler(async (req, res) => {
    const q = page
      .extend({ status: z.string().trim().min(1).max(40).optional(), source: z.string().trim().min(1).max(40).optional() })
      .safeParse(req.query);
    if (!q.success) return badRequest(res, 'Invalid paging or filter');
    const { rows, total } = await repo.listBills({ status: q.data.status, source: q.data.source }, q.data.limit, q.data.offset);
    res.json(formatSuccess(rows, { total }));
  }),
);

router.get(
  '/bills/:id',
  asyncHandler(async (req, res) => {
    const id = billId.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'Invalid bill id');
    const detail = await repo.billDetail(id.data);
    if (!detail) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'Bill not found'));
    res.json(formatSuccess(detail));
  }),
);

router.get(
  '/divisions',
  asyncHandler(async (req, res) => {
    const q = page.safeParse(req.query);
    if (!q.success) return badRequest(res, 'Invalid paging');
    const { rows, total } = await repo.listDivisions(q.data.limit, q.data.offset);
    res.json(formatSuccess(rows, { total }));
  }),
);

router.get(
  '/divisions/:id',
  asyncHandler(async (req, res) => {
    const id = recordId.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'Invalid division id');
    const detail = await repo.divisionDetail(id.data);
    if (!detail) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'Division not found'));
    res.json(formatSuccess(detail));
  }),
);

router.get(
  '/debates',
  asyncHandler(async (req, res) => {
    const q = page.safeParse(req.query);
    if (!q.success) return badRequest(res, 'Invalid paging');
    const { rows, total } = await repo.listDebates(q.data.limit, q.data.offset);
    res.json(formatSuccess(rows, { total }));
  }),
);

router.get(
  '/debates/:id',
  asyncHandler(async (req, res) => {
    const id = recordId.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'Invalid debate id');
    const detail = await repo.debateDetail(id.data);
    if (!detail) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'Debate not found'));
    res.json(formatSuccess(detail));
  }),
);

router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        metric: z.enum(LEADERBOARD_METRICS).default('attendance'),
        order: z.enum(['asc', 'desc']).default('desc'),
        limit: z.coerce.number().int().min(1).max(200).default(20),
      })
      .safeParse(req.query);
    if (!q.success) return badRequest(res, `metric must be one of ${LEADERBOARD_METRICS.join(', ')}`);
    res.json(formatSuccess(await repo.leaderboard(q.data.metric, q.data.order, q.data.limit)));
  }),
);

router.get(
  '/parties',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess(await repo.parties()));
  }),
);

// ---------------------------------------------------------------------------
// Leave watch (admin). Confirming a leave is editorial and changes every score that counts the
// TD's votes, so it needs a signed-in human admin, is attributed in the admin log, and needs a
// public source. See server/parliament/leaveWatch.ts.
// ---------------------------------------------------------------------------
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const confirmBody = z.object({
  reason: z.enum(absenceReason.enumValues),
  from: isoDay,
  to: isoDay.nullable(),
  sourceUrl: z.string().trim().max(2000),
  note: z.string().trim().max(1000).nullable(),
});
const dismissBody = z.object({ note: z.string().trim().max(1000).nullable().default(null) });

/** Answer a leave watch domain error with its status; anything else goes to the error handler. */
function leaveError(res: import('express').Response, error: unknown) {
  if (error instanceof leaveWatch.LeaveAlertError) {
    const code = error.status === 404 ? 'ENTITY_NOT_FOUND' : error.status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR';
    return res.status(error.status).json(formatError(code, error.message));
  }
  throw error;
}

router.get(
  '/admin/leave-alerts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const q = z.object({ status: z.enum(['open', 'all']).default('open') }).safeParse(req.query);
    if (!q.success) return badRequest(res, 'status must be open or all');
    res.json(formatSuccess(await leaveWatch.listLeaveAlerts(q.data.status)));
  }),
);

router.post(
  '/admin/leave-alerts/:id/confirm',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const body = confirmBody.safeParse(req.body);
    if (!id.success || !body.success) return badRequest(res, body.success ? 'Alert id must be a positive integer' : (body.error.issues[0]?.message ?? 'Invalid leave'));
    try {
      await leaveWatch.confirmLeave(id.data, body.data, req.user?.email ?? 'admin');
    } catch (error) {
      return leaveError(res, error);
    }
    logAdminAction(req, 'leave-watch.confirm', { alertId: id.data, reason: body.data.reason, from: body.data.from, to: body.data.to, sourceUrl: body.data.sourceUrl });
    res.json(formatSuccess({ confirmed: true }));
  }),
);

router.post(
  '/admin/leave-alerts/:id/dismiss',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const body = dismissBody.safeParse(req.body ?? {});
    if (!id.success || !body.success) return badRequest(res, 'Invalid alert id or note');
    try {
      await leaveWatch.dismissLeave(id.data, body.data.note, req.user?.email ?? 'admin');
    } catch (error) {
      return leaveError(res, error);
    }
    logAdminAction(req, 'leave-watch.dismiss', { alertId: id.data });
    res.json(formatSuccess({ dismissed: true }));
  }),
);

/** POST /api/parliament/sync — start a sync in the background; 409 while one is running. */
router.post('/sync', requireJob, (_req, res) => {
  if (isSyncRunning()) return res.status(409).json(formatError('CONFLICT', 'A parliament sync is already running'));
  runSync().catch((error) => console.error('Parliament sync failed:', error instanceof Error ? error.message : error));
  res.status(202).json(formatSuccess({ started: true }));
});

export default router;
