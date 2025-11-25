import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabaseDb } from '../db';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Monitoring unavailable.'
      });
    }

    const { data: latestDayRows, error: latestDayError, count: debateDayCount } = await supabaseDb
      .from('debate_days')
      .select('id, date, ingested_at', { count: 'exact' })
      .order('date', { ascending: false })
      .limit(1);

    if (latestDayError) {
      throw new Error(latestDayError.message);
    }

    const latestDay = latestDayRows && latestDayRows.length > 0 ? latestDayRows[0] : null;

    const { count: sectionCount, error: sectionError } = await supabaseDb
      .from('debate_sections')
      .select('id', { count: 'exact', head: true });

    if (sectionError) {
      throw new Error(sectionError.message);
    }

    const { count: speechCount, error: speechError } = await supabaseDb
      .from('debate_speeches')
      .select('id', { count: 'exact', head: true });

    if (speechError) {
      throw new Error(speechError.message);
    }

    const { data: taskRows, error: taskError } = await supabaseDb
      .from('debate_section_tasks')
      .select('status');

    if (taskError) {
      throw new Error(taskError.message);
    }

    const taskCounts = new Map<string, number>();
    for (const row of taskRows || []) {
      const status = row.status || 'unknown';
      taskCounts.set(status, (taskCounts.get(status) || 0) + 1);
    }

    const { data: alertRows, error: alertError } = await supabaseDb
      .from('debate_alerts')
      .select('status');

    if (alertError) {
      throw new Error(alertError.message);
    }

    const alertCounts = new Map<string, number>();
    for (const row of alertRows || []) {
      const status = row.status || 'unknown';
      alertCounts.set(status, (alertCounts.get(status) || 0) + 1);
    }

    const { count: exportCount, error: exportCountError } = await supabaseDb
      .from('debate_exports')
      .select('id', { count: 'exact', head: true });

    if (exportCountError) {
      throw new Error(exportCountError.message);
    }

    const { data: lastExportRows, error: lastExportError } = await supabaseDb
      .from('debate_exports')
      .select('created_at, status')
      .order('created_at', { ascending: false })
      .limit(1);

    if (lastExportError) {
      throw new Error(lastExportError.message);
    }

    res.json({
      success: true,
      stats: {
        totals: {
          debateDays: debateDayCount ?? 0,
          sections: sectionCount ?? 0,
          speeches: speechCount ?? 0
        },
        latestIngest: latestDay
          ? {
              date: latestDay.date,
              ingestedAt: latestDay.ingested_at
            }
          : null,
        taskQueue: Array.from(taskCounts.entries()).map(([status, count]) => ({ status, count })),
        alerts: Array.from(alertCounts.entries()).map(([status, count]) => ({ status, count })),
        exports: {
          total: exportCount ?? 0,
          lastRun: lastExportRows && lastExportRows.length > 0 ? lastExportRows[0].created_at : null,
          lastStatus: lastExportRows && lastExportRows.length > 0 ? lastExportRows[0].status : null
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to load debate monitoring summary:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load monitoring summary' });
  }
});

export default router;

