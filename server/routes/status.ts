/**
 * /api/status — what an outside uptime check needs (.github/workflows/uptime.yml), and nothing else:
 * the database size, for the free plan's limit, and when each scheduled job last ran and whether it
 * worked. No counts, summaries or errors: those stay on the admin route (/api/admin/jobs).
 */
import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { recentJobRuns } from '../services/jobRuns';
import { formatSuccess } from '../utils/responseFormatters';

const router = Router();

router.get('/', async (_req, res) => {
  const [size, runs] = await Promise.all([
    db.execute<{ bytes: string }>(sql`select pg_database_size(current_database())::text as bytes`),
    recentJobRuns(1),
  ]);
  const jobs = Object.fromEntries(
    Object.entries(runs).map(([job, [last]]) => [
      job,
      { startedAt: last?.startedAt ?? null, finishedAt: last?.finishedAt ?? null, ok: last?.ok ?? null },
    ]),
  );
  res.json(formatSuccess({ databaseBytes: Number(size.rows[0]?.bytes ?? 0), jobs }));
});

export default router;
