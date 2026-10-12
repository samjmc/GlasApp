/**
 * /api/admin/jobs — the latest runs of each scheduled job (politics.job_runs): when it ran,
 * whether it worked, and its own counts. A job that is quietly failing shows here as ok: false.
 */
import { Router } from 'express';
import { requireJob } from '../../auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { recentJobRuns } from '../../services/jobRuns';
import { formatSuccess } from '../../utils/responseFormatters';

const router = Router();
router.use(requireJob);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess(await recentJobRuns()));
  }),
);

export default router;
