import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabaseDb } from '../db';

const router = Router();

type SavedViewFilters = {
  period?: 'latest' | { start: string; end: string };
  party?: string | null;
  topic?: string | null;
  chamber?: string | null;
};

function normalizeFilters(raw: any): SavedViewFilters {
  const filters: SavedViewFilters = {};

  if (raw && typeof raw === 'object') {
    if (raw.period === 'latest') {
      filters.period = 'latest';
    } else if (raw.period && typeof raw.period === 'object' && raw.period.start && raw.period.end) {
      filters.period = {
        start: String(raw.period.start),
        end: String(raw.period.end)
      };
    }

    if (raw.party) filters.party = String(raw.party);
    if (raw.topic) filters.topic = String(raw.topic);
    if (raw.chamber) filters.chamber = String(raw.chamber);
  }

  if (!filters.period) {
    filters.period = 'latest';
  }

  return filters;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsv(rows: any[]): string {
  const headers = [
    'TD',
    'Party',
    'Constituency',
    'Speeches',
    'Words',
    'Unique Topics',
    'Top Topics',
    'Period Start',
    'Period End'
  ];

  const lines = [headers.map(csvEscape).join(',')];

  for (const row of rows) {
    const td = row.td_scores || {};
    const focus = Array.isArray(row.td_issue_focus) ? row.td_issue_focus : [];
    const topTopics = focus
      .slice()
      .sort((a, b) => (b.minutes_spoken || 0) - (a.minutes_spoken || 0))
      .slice(0, 3)
      .map((entry) => `${entry.topic} (${((entry.percentage || 0) * 100).toFixed(1)}%)`)
      .join('; ');

    lines.push(
      [
        csvEscape(td.politician_name || ''),
        csvEscape(td.party || ''),
        csvEscape(td.constituency || ''),
        csvEscape(row.speeches ?? 0),
        csvEscape(row.words_spoken ?? 0),
        csvEscape(row.unique_topics ?? 0),
        csvEscape(topTopics),
        csvEscape(row.period_start),
        csvEscape(row.period_end)
      ].join(',')
    );
  }

  return lines.join('\n');
}

async function resolvePeriod(filters: SavedViewFilters) {
  if (filters.period && filters.period !== 'latest') {
    return filters.period;
  }

  const { data, error } = await supabaseDb!
    .from('td_debate_metrics')
    .select('period_start, period_end')
    .order('period_end', { ascending: false })
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('No debate metrics available to export.');
  }

  return {
    start: data.period_start as string,
    end: data.period_end as string
  };
}

async function fetchMetricsForExport(filters: SavedViewFilters) {
  if (!supabaseDb) {
    throw new Error('Supabase client not initialised');
  }

  const period = await resolvePeriod(filters);

  let query = supabaseDb
    .from('td_debate_metrics')
    .select(
      `
        td_id,
        period_start,
        period_end,
        speeches,
        words_spoken,
        unique_topics,
        engagement_score,
        leadership_score,
        sentiment_score,
        metadata,
        td_scores!inner(id, politician_name, party, constituency)
      `
    )
    .eq('period_start', period.start)
    .eq('period_end', period.end)
    .order('words_spoken', { ascending: false });

  if (filters.party) {
    query = query.eq('td_scores.party', filters.party);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let rows = data || [];

  const tdIds = rows.map((row: any) => row.td_id);
  let focusMap = new Map<number, any[]>();

  if (tdIds.length > 0) {
    const { data: focusRows, error: focusError } = await supabaseDb
      .from('td_issue_focus')
      .select('td_id, topic, minutes_spoken, percentage')
      .in('td_id', tdIds)
      .eq('period_start', period.start)
      .eq('period_end', period.end);

    if (focusError) {
      throw new Error(focusError.message);
    }

    for (const row of focusRows || []) {
      const list = focusMap.get(row.td_id) || [];
      list.push(row);
      focusMap.set(row.td_id, list);
    }
  }

  rows = rows.map((row: any) => ({
    ...row,
    td_issue_focus: focusMap.get(row.td_id) || []
  }));

  if (filters.topic) {
    rows = rows.filter((row: any) =>
      Array.isArray(row.td_issue_focus) &&
      row.td_issue_focus.some((entry: any) => (entry.topic || '').toLowerCase() === filters.topic!.toLowerCase())
    );
  }

  if (filters.chamber) {
    rows = rows.filter((row: any) => {
      const activities = Array.isArray(row.metadata?.chamberActivity) ? row.metadata.chamberActivity : [];
      return activities.some((activity: any) => {
        const chamber = (activity.chamber || '').toLowerCase();
        return chamber === filters.chamber!.toLowerCase() && (activity.minutes || 0) > 0;
      });
    });
  }

  return { rows, period };
}

router.get('/views', async (_req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const { data, error } = await supabaseDb
      .from('debate_saved_views')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, views: data || [] });
  } catch (error: any) {
    console.error('Failed to fetch debate saved views:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load saved views' });
  }
});

router.post('/views', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const { name, description, filters, createdBy } = req.body || {};

    if (!name || !filters) {
      return res.status(400).json({ success: false, message: 'Name and filters are required.' });
    }

    const normalizedFilters = normalizeFilters(filters);

    const { data, error } = await supabaseDb
      .from('debate_saved_views')
      .insert({
        name: String(name),
        description: description ? String(description) : null,
        filters: normalizedFilters,
        created_by: createdBy ? String(createdBy) : null
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, view: data });
  } catch (error: any) {
    console.error('Failed to create debate saved view:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to create saved view' });
  }
});

router.patch('/views/:id', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const { id } = req.params;
    const { name, description, filters } = req.body || {};

    if (!name && !description && !filters) {
      return res.status(400).json({ success: false, message: 'No updates provided.' });
    }

    const payload: Record<string, any> = {};
    if (name) payload.name = String(name);
    if (typeof description !== 'undefined') payload.description = description ? String(description) : null;
    if (filters) payload.filters = normalizeFilters(filters);

    const { data, error } = await supabaseDb
      .from('debate_saved_views')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.json({ success: true, view: data });
  } catch (error: any) {
    console.error('Failed to update debate saved view:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to update saved view' });
  }
});

router.delete('/views/:id', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const { id } = req.params;

    const { error } = await supabaseDb
      .from('debate_saved_views')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete debate saved view:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to delete saved view' });
  }
});

router.get('/exports', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 20, 100) : 20;

    const { data, error } = await supabaseDb
      .from('debate_exports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ success: true, exports: data || [] });
  } catch (error: any) {
    console.error('Failed to fetch debate exports:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load exports' });
  }
});

async function createExportEntry(payload: {
  viewId?: string | null;
  requestedBy?: string | null;
  format: string;
  status: string;
  metadata?: Record<string, any>;
}) {
  if (!supabaseDb) return null;

  const insertPayload = {
    view_id: payload.viewId || null,
    requested_by: payload.requestedBy || null,
    format: payload.format,
    status: payload.status,
    metadata: payload.metadata || {},
    completed_at: payload.status === 'completed' ? new Date().toISOString() : null
  };

  const { data, error } = await supabaseDb
    .from('debate_exports')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to record debate export:', error);
    return null;
  }

  return data?.id || null;
}

router.post('/exports', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    const { viewId, filters: rawFilters, requestedBy } = req.body || {};

    let filters: SavedViewFilters;

    if (viewId) {
      const { data: view, error: viewError } = await supabaseDb
        .from('debate_saved_views')
        .select('*')
        .eq('id', viewId)
        .maybeSingle();

      if (viewError) throw viewError;
      if (!view) {
        return res.status(404).json({ success: false, message: 'Saved view not found' });
      }

      filters = normalizeFilters(view.filters);
    } else {
      filters = normalizeFilters(rawFilters);
    }

    const { rows, period } = await fetchMetricsForExport(filters);

    const csv = buildCsv(rows);
    const exportId = await createExportEntry({
      viewId: viewId || null,
      requestedBy: requestedBy ? String(requestedBy) : null,
      format: 'csv',
      status: 'completed',
      metadata: {
        filters,
        rowCount: rows.length,
        period
      }
    });

    res.json({
      success: true,
      export: {
        id: exportId,
        status: 'completed',
        rowCount: rows.length,
        period,
        csvBase64: Buffer.from(csv, 'utf8').toString('base64')
      }
    });
  } catch (error: any) {
    console.error('Failed to generate debate export:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to generate export' });
  }
});

export default router;

