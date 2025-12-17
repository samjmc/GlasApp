import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabaseDb } from '../db';

const router = Router();

const PERIOD_PRESETS: Record<
  string,
  {
    days: number;
    label: string;
  }
> = {
  '1w': { days: 7, label: 'Past week' },
  '2w': { days: 14, label: 'Past 2 weeks' },
  '1m': { days: 30, label: 'Past month' },
  '1q': { days: 90, label: 'Past quarter' }
};

const DEFAULT_PERIOD_KEY = '1w';
const SCORE_BASELINE = 50;

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) return 10;
  return Math.max(10, Math.min(95, Number(value.toFixed(2))));
};

const computeScoreFromDelta = (deltaSum: number): number => clampScore(SCORE_BASELINE + deltaSum);

const toDateOnly = (date: Date): string => date.toISOString().split('T')[0];

const resolvePeriodRange = (
  query: Record<string, unknown>
): {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  startDateTime: string;
  endDateTime: string;
} => {
  const presetKeyRaw = typeof query.period === 'string' ? query.period : null;
  const preset = (presetKeyRaw && PERIOD_PRESETS[presetKeyRaw]) || PERIOD_PRESETS[DEFAULT_PERIOD_KEY];
  const customStart = typeof query.start === 'string' ? new Date(query.start) : null;
  const customEnd = typeof query.end === 'string' ? new Date(query.end) : null;

  const endDateObj =
    customEnd && !Number.isNaN(customEnd.getTime())
      ? customEnd
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const hasPreset = Boolean(presetKeyRaw && PERIOD_PRESETS[presetKeyRaw]);
  const adjustedPresetKey = hasPreset ? (presetKeyRaw as string) : DEFAULT_PERIOD_KEY;

  let startDateObj =
    customStart && !Number.isNaN(customStart.getTime())
      ? customStart
      : (() => {
          const start = new Date(endDateObj);
          start.setUTCDate(endDateObj.getUTCDate() - preset.days + 1);
          return start;
        })();

  if (startDateObj > endDateObj) {
    startDateObj = new Date(endDateObj);
  }

  const startDate = toDateOnly(startDateObj);
  const endDate = toDateOnly(endDateObj);
  const resolvedKey = hasPreset ? adjustedPresetKey : customStart || customEnd ? 'custom' : DEFAULT_PERIOD_KEY;
  const resolvedLabel = hasPreset
    ? PERIOD_PRESETS[adjustedPresetKey].label
    : customStart || customEnd
    ? 'Custom range'
    : PERIOD_PRESETS[DEFAULT_PERIOD_KEY].label;

  return {
    key: resolvedKey,
    label: resolvedLabel,
    startDate,
    endDate,
    startDateTime: `${startDate}T00:00:00+00:00`,
    endDateTime: `${endDate}T23:59:59.999+00:00`
  };
};

const formatContributionRow = (row: any) => {
  if (!row) return null;
  const metadata = row.metadata ?? {};
  return {
    performanceDelta: Number((Number(row.performance_delta ?? 0)).toFixed(2)),
    effectivenessDelta: Number((Number(row.effectiveness_delta ?? 0)).toFixed(2)),
    influenceDelta: Number((Number(row.influence_delta ?? 0)).toFixed(2)),
    calculatedAt: row.calculated_at ?? null,
    sectionTitle: row.debate_sections?.title ?? null,
    debateTitle: row.debate_days?.title ?? null,
    debateDate: row.debate_days?.date ?? null,
    debateChamber: row.debate_days?.chamber ?? null,
    topics: Array.isArray(metadata.topics) ? metadata.topics : [],
    reasoning: typeof metadata.reasoning === 'string' ? metadata.reasoning : null
  };
};

const loadContributionSummaries = async (
  startDateTime: string,
  endDateTime: string
): Promise<
  Array<{
    tdId: number;
    info: any | null;
    performanceDelta: number;
    effectivenessDelta: number;
    influenceDelta: number;
    performanceScore: number;
    effectivenessScore: number;
    influenceScore: number;
    lastContribution: ReturnType<typeof formatContributionRow>;
  }>
> => {
  if (!supabaseDb) {
    return [];
  }

  // Filter by debate_days.date instead of calculated_at for better user experience
  // Users expect to see debates from the selected time period, not when they were scored
  const { data: contributionRows, error: contributionsError } = await supabaseDb
    .from('debate_section_score_contributions')
    .select(`
      td_id,
      performance_delta,
      effectiveness_delta,
      influence_delta,
      calculated_at,
      metadata,
      debate_sections!inner(title),
      debate_days!inner(date, chamber, title)
    `)
    .gte('debate_days.date', startDateTime.split('T')[0])
    .lte('debate_days.date', endDateTime.split('T')[0]);

  if (contributionsError) {
    throw new Error(contributionsError.message);
  }

  const aggregates = new Map<
    number,
    {
      performanceDelta: number;
      effectivenessDelta: number;
      influenceDelta: number;
      lastContribution: any | null;
      lastTimestamp: number;
    }
  >();

  for (const row of contributionRows || []) {
    const tdId = row?.td_id;
    if (typeof tdId !== 'number') {
      continue;
    }
    const record =
      aggregates.get(tdId) ?? {
        performanceDelta: 0,
        effectivenessDelta: 0,
        influenceDelta: 0,
        lastContribution: null,
        lastTimestamp: Number.NEGATIVE_INFINITY
      };

    record.performanceDelta += Number(row.performance_delta ?? 0);
    record.effectivenessDelta += Number(row.effectiveness_delta ?? 0);
    record.influenceDelta += Number(row.influence_delta ?? 0);

    const timestamp = row.calculated_at ? new Date(row.calculated_at).getTime() : Number.NEGATIVE_INFINITY;
    if (timestamp >= record.lastTimestamp) {
      record.lastTimestamp = timestamp;
      record.lastContribution = row;
    }

    aggregates.set(tdId, record);
  }

  if (aggregates.size === 0) {
    return [];
  }

  const tdIds = Array.from(aggregates.keys());

  const { data: tdRows, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('id, politician_name, party, constituency, image_url')
    .in('id', tdIds);

  if (tdError) {
    throw new Error(tdError.message);
  }

  const tdInfoMap = new Map<number, any>((tdRows || []).map((row: any) => [row.id, row]));

  return tdIds.map((tdId) => {
    const aggregate = aggregates.get(tdId)!;
    const info = tdInfoMap.get(tdId) || null;
    const performanceScore = computeScoreFromDelta(aggregate.performanceDelta);
    const effectivenessScore = computeScoreFromDelta(aggregate.effectivenessDelta);
    const influenceScore = computeScoreFromDelta(aggregate.influenceDelta);

    return {
      tdId,
      info,
      performanceDelta: Number(aggregate.performanceDelta.toFixed(2)),
      effectivenessDelta: Number(aggregate.effectivenessDelta.toFixed(2)),
      influenceDelta: Number(aggregate.influenceDelta.toFixed(2)),
      performanceScore,
      effectivenessScore,
      influenceScore,
      lastContribution: formatContributionRow(aggregate.lastContribution)
    };
  });
};

router.get('/summary', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : 3;
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 7) : 3;
    const chamber = typeof req.query.chamber === 'string' ? req.query.chamber : 'dail';

    const { data: dayRows, error: dayError } = await supabaseDb
      .from('debate_days')
      .select('*')
      .eq('chamber', chamber)
      .order('date', { ascending: false })
      .order('ingested_at', { ascending: false })
      .limit(limit);

    if (dayError) {
      throw new Error(dayError.message);
    }

    const debateDays = dayRows || [];
    if (debateDays.length === 0) {
      return res.json({ success: true, debates: [] });
    }

    const dayIds = debateDays.map((day: any) => day.id);

    const { data: sectionRows, error: sectionError } = await supabaseDb
      .from('debate_sections')
      .select('id, debate_day_id, section_code, title, debate_type, recorded_time, contains_debate, speech_count, word_count, order_index, metadata')
      .in('debate_day_id', dayIds)
      .order('order_index', { ascending: true });

    if (sectionError) throw new Error(sectionError.message);

    const sections = sectionRows || [];
    const sectionIds = sections.map((section: any) => section.id);

    const { data: speechRows, error: speechError } = sectionIds.length
      ? await supabaseDb
          .from('debate_speeches')
          .select('section_id, speaker_name, speaker_oireachtas_id, word_count')
          .in('section_id', sectionIds)
          .limit(5000)
      : { data: [], error: null } as any;

    if (speechError) throw new Error(speechError.message);

    const { data: summaryRows, error: summaryError } = sectionIds.length
      ? await supabaseDb
          .from('debate_section_summaries')
          .select('section_id, consensus_summary, status, confidence')
          .in('section_id', sectionIds)
      : { data: [], error: null } as any;

    if (summaryError) throw new Error(summaryError.message);

    const speakersData = speechRows || [];
    const summaries = summaryRows || [];
    const summaryMap = new Map<string, any>();
    summaries.forEach((summary: any) => summaryMap.set(summary.section_id, summary));

    const sectionToDayMap = new Map<string, string>();
    sections.forEach((section: any) => {
      sectionToDayMap.set(section.id, section.debate_day_id);
    });

    const speakerStatsByDay = new Map<string, Map<string, { name: string; speakerId: string | null; words: number; contributions: number }>>();

    for (const speech of speakersData) {
      const dayId = sectionToDayMap.get(speech.section_id);
      if (!dayId) continue;
      const speakerKey = speech.speaker_oireachtas_id || speech.speaker_name || 'unknown';
      if (!speakerStatsByDay.has(dayId)) {
        speakerStatsByDay.set(dayId, new Map());
      }
      const speakerMap = speakerStatsByDay.get(dayId)!;
      if (!speakerMap.has(speakerKey)) {
        speakerMap.set(speakerKey, {
          name: speech.speaker_name || 'Unknown Speaker',
          speakerId: speech.speaker_oireachtas_id || null,
          words: 0,
          contributions: 0
        });
      }
      const stat = speakerMap.get(speakerKey)!;
      stat.words += Number(speech.word_count) || 0;
      stat.contributions += 1;
    }

    const sectionsByDay = new Map<string, any[]>();
    sections.forEach((section: any) => {
      if (!sectionsByDay.has(section.debate_day_id)) {
        sectionsByDay.set(section.debate_day_id, []);
      }
      sectionsByDay.get(section.debate_day_id)!.push(section);
    });

    const debates = debateDays.map((day: any) => {
      const daySections = sectionsByDay.get(day.id) || [];
      const topSections = daySections
        .filter((section: any) => section.contains_debate && (section.word_count || 0) > 0)
        .sort((a: any, b: any) => (b.word_count || 0) - (a.word_count || 0))
        .slice(0, 5)
        .map((section: any) => {
          const summary = summaryMap.get(section.id);
          return {
            id: section.id,
            sectionCode: section.section_code,
            title: section.title,
            debateType: section.debate_type,
            recordedTime: section.recorded_time,
            wordCount: section.word_count,
            speechCount: section.speech_count,
            summary: summary?.consensus_summary || null,
            summaryStatus: summary?.status || 'pending',
            confidence: summary?.confidence ?? null,
            question: section.metadata?.question || null
          };
        });

      const speakerMap = speakerStatsByDay.get(day.id);
      const topSpeakers = speakerMap
        ? Array.from(speakerMap.values())
            .sort((a, b) => b.words - a.words)
            .slice(0, 5)
        : [];

      const summariesReady = topSections.filter((section) => section.summary && section.summaryStatus === 'complete').length;

      return {
        id: day.id,
        date: day.date,
        chamber: day.chamber,
        title: day.title,
        wordCount: day.word_count,
        speechCount: day.speech_count,
        sectionCount: day.section_count,
        storagePath: day.storage_path,
        lastIngestedAt: day.updated_at || day.ingested_at,
        topSections,
        topSpeakers,
        summaryStats: {
          sectionsWithSummaries: summariesReady,
          totalSections: daySections.length
        }
      };
    });

    res.json({ success: true, debates });
  } catch (error: any) {
    console.error('Failed to fetch debate summaries:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load debates' });
  }
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : 3;
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5) : 3;
    const periodRange = resolvePeriodRange(req.query);

    const summaries = await loadContributionSummaries(periodRange.startDateTime, periodRange.endDateTime);

    const formatEntry = (summary: {
      tdId: number;
      info: any | null;
      performanceScore: number;
      effectivenessScore: number;
      influenceScore: number;
      lastContribution: ReturnType<typeof formatContributionRow>;
    }) => ({
      tdId: summary.tdId,
      name: summary.info?.politician_name ?? null,
      party: summary.info?.party ?? null,
      constituency: summary.info?.constituency ?? null,
      imageUrl: summary.info?.image_url ?? null,
      performanceScore: Number(summary.performanceScore.toFixed(2)),
      effectivenessScore: Number(summary.effectivenessScore.toFixed(2)),
      influenceScore: Number(summary.influenceScore.toFixed(2)),
      lastDebateDate: summary.lastContribution?.debateDate ?? null,
      lastUpdatedAt: summary.lastContribution?.calculatedAt ?? null,
      lastContribution: summary.lastContribution
    });

    const sortedDescending = [...summaries].sort(
      (a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0)
    );
    const sortedAscending = [...summaries].sort(
      (a, b) => (a.performanceScore ?? 0) - (b.performanceScore ?? 0)
    );

    res.json({
      success: true,
      leaderboard: {
        generatedAt: new Date().toISOString(),
        period: {
          key: periodRange.key,
          label: periodRange.label,
          start: periodRange.startDate,
          end: periodRange.endDate
        },
        top: sortedDescending.slice(0, limit).map(formatEntry),
        bottom: sortedAscending.slice(0, limit).map(formatEntry)
      }
    });
  } catch (error: any) {
    console.error('Failed to load debate leaderboard:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load leaderboard' });
  }
});

router.get('/td/:identifier/metrics', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const { identifier } = req.params;
    const start = typeof req.query.start === 'string' ? req.query.start : null;
    const end = typeof req.query.end === 'string' ? req.query.end : null;

    const tdRecord = await findTDRecord(identifier);
    if (!tdRecord) {
      return res.status(404).json({
        success: false,
        message: 'TD not found'
      });
    }

    let metricsRow: any | null = null;

    if (start && end) {
      const { data, error } = await supabaseDb
        .from('td_debate_metrics')
        .select('*')
        .eq('td_id', tdRecord.id)
        .eq('period_start', start)
        .eq('period_end', end)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
      }

      metricsRow = data || null;
    } else {
      const { data, error } = await supabaseDb
        .from('td_debate_metrics')
        .select('*')
        .eq('td_id', tdRecord.id)
        .order('period_end', { ascending: false })
        .order('period_start', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      metricsRow = data && data.length > 0 ? data[0] : null;
    }

    if (!metricsRow) {
      return res.json({
        success: true,
        td: {
          id: tdRecord.id,
          name: tdRecord.politician_name,
          party: tdRecord.party,
          constituency: tdRecord.constituency,
          imageUrl: tdRecord.image_url
        },
        period: null,
        metrics: null,
        issueFocus: []
      });
    }

    const { period_start, period_end } = metricsRow;

    const { data: focusRows, error: focusError } = await supabaseDb
      .from('td_issue_focus')
      .select('topic, minutes_spoken, percentage, metadata')
      .eq('td_id', tdRecord.id)
      .eq('period_start', period_start)
      .eq('period_end', period_end);

    if (focusError) {
      throw new Error(focusError.message);
    }

    const sortedFocus = (focusRows || [])
      .sort((a: any, b: any) => (b.percentage || 0) - (a.percentage || 0));

    res.json({
      success: true,
      td: {
        id: tdRecord.id,
        name: tdRecord.politician_name,
        party: tdRecord.party,
        constituency: tdRecord.constituency,
        imageUrl: tdRecord.image_url
      },
      period: {
        start: period_start,
        end: period_end
      },
      metrics: {
        speeches: metricsRow.speeches,
        wordsSpoken: metricsRow.words_spoken,
        uniqueTopics: metricsRow.unique_topics,
        engagementScore: metricsRow.engagement_score,
        leadershipScore: metricsRow.leadership_score,
        sentimentScore: metricsRow.sentiment_score,
        effectivenessScore: metricsRow.effectiveness_score,
        influenceScore: metricsRow.influence_score,
        metadata: metricsRow.metadata || {}
      },
      issueFocus: sortedFocus,
      chamberActivity: Array.isArray(metricsRow.metadata?.chamberActivity)
        ? metricsRow.metadata.chamberActivity
        : []
    });
  } catch (error: any) {
    console.error('Failed to fetch TD debate metrics:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load TD metrics' });
  }
});

router.get('/td/:identifier/history', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const { identifier } = req.params;
    const maxPeriods = Math.min(parseInt(String(req.query.periods), 10) || 12, 52);
    const periodRange = resolvePeriodRange(req.query);

    const tdRecord = await findTDRecord(identifier);
    if (!tdRecord) {
      return res.status(404).json({
        success: false,
        message: 'TD not found'
      });
    }

    const { data: metrics, error } = await supabaseDb
      .from('td_debate_metrics')
      .select('*')
      .eq('td_id', tdRecord.id)
      .lte('period_end', periodRange.endDate)
      .gte('period_end', periodRange.startDate)
      .order('period_end', { ascending: false })
      .order('period_start', { ascending: false })
      .limit(maxPeriods);

    if (error) {
      throw new Error(error.message);
    }

    const history = (metrics || []).map((row: any) => ({
      periodStart: row.period_start,
      periodEnd: row.period_end,
      speeches: row.speeches,
      wordsSpoken: row.words_spoken,
      uniqueTopics: row.unique_topics,
      engagementScore: row.engagement_score,
      leadershipScore: row.leadership_score,
      sentimentScore: row.sentiment_score,
      effectivenessScore: row.effectiveness_score,
      influenceScore: row.influence_score,
      metadata: row.metadata || {}
    }));

    res.json({
      success: true,
      td: {
        id: tdRecord.id,
        name: tdRecord.politician_name,
        party: tdRecord.party,
        constituency: tdRecord.constituency,
        imageUrl: tdRecord.image_url
      },
      period: {
        key: periodRange.key,
        label: periodRange.label,
        start: periodRange.startDate,
        end: periodRange.endDate
      },
      history
    });
  } catch (error: any) {
    console.error('Failed to fetch TD debate history:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load TD history' });
  }
});

router.get('/td/:identifier/wins', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const { identifier } = req.params;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 5;

    const tdRecord = await findTDRecord(identifier);
    if (!tdRecord) {
      return res.status(404).json({
        success: false,
        message: 'TD not found'
      });
    }

    const { data: outcomes, error } = await supabaseDb
      .from('debate_section_outcomes')
      .select(`
        id,
        section_id,
        debate_day_id,
        outcome,
        confidence,
        concessions,
        narrative,
        debate_days!inner(date, chamber, title),
        debate_sections!inner(title)
      `)
      .eq('winner_td_id', tdRecord.id)
      .eq('outcome', 'win')
      .order('debate_days.date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const wins = (outcomes || []).map((row: any) => ({
      id: row.id,
      sectionId: row.section_id,
      debateDayId: row.debate_day_id,
      date: row.debate_days?.date,
      chamber: row.debate_days?.chamber,
      debateTitle: row.debate_days?.title,
      sectionTitle: row.debate_sections?.title,
      outcome: row.outcome,
      confidence: row.confidence,
      concessions: row.concessions,
      narrative: row.narrative
    }));

    res.json({
      success: true,
      td: {
        id: tdRecord.id,
        name: tdRecord.politician_name,
        party: tdRecord.party,
        constituency: tdRecord.constituency
      },
      wins
    });
  } catch (error: any) {
    console.error('Failed to fetch TD debate wins:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load TD wins' });
  }
});

async function findTDRecord(identifier: string) {
  if (!supabaseDb) return null;

  // Numeric id lookup
  if (/^\d+$/.test(identifier)) {
    const tdId = parseInt(identifier, 10);
    const { data, error } = await supabaseDb
      .from('td_scores')
      .select('id, politician_name, party, constituency, image_url, member_code')
      .eq('id', tdId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    if (data) return data;
  }

  // Member code exact match
  const { data: memberMatch, error: memberError } = await supabaseDb
    .from('td_scores')
    .select('id, politician_name, party, constituency, image_url, member_code')
    .eq('member_code', identifier)
    .maybeSingle();

  if (memberError && memberError.code !== 'PGRST116') {
    throw new Error(memberError.message);
  }
  if (memberMatch) return memberMatch;

  const normalized = identifier.replace(/[-+]/g, ' ').trim();

  // Fuzzy name match using ilike
  const { data: nameMatch, error: nameError } = await supabaseDb
    .from('td_scores')
    .select('id, politician_name, party, constituency, image_url, member_code')
    .ilike('politician_name', normalized)
    .maybeSingle();

  if (nameError && nameError.code !== 'PGRST116') {
    throw new Error(nameError.message);
  }

  return nameMatch || null;
}

router.get('/review', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const maxConfidence = typeof req.query.max_confidence === 'string' ? parseFloat(req.query.max_confidence) : 0.75;
    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 20, 100) : 20;

    const { data, error } = await supabaseDb
      .from('debate_section_summaries')
      .select(`
        section_id,
        confidence,
        status,
        consensus_summary,
        updated_at,
        debate_sections!inner (
          id,
          section_code,
          title,
          debate_type,
          recorded_time,
          debate_day_id,
          metadata,
          word_count,
          speech_count
        ),
        debate_sections!inner.debate_days!inner (
          id,
          date,
          chamber,
          title
        )
      `)
      .lte('confidence', maxConfidence || 0.75)
      .order('confidence', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const items = (data || []).map((row: any) => ({
      sectionId: row.section_id,
      confidence: row.confidence,
      status: row.status,
      updatedAt: row.updated_at,
      summary: row.consensus_summary,
      section: {
        id: row.debate_sections?.id,
        code: row.debate_sections?.section_code,
        title: row.debate_sections?.title,
        debateType: row.debate_sections?.debate_type,
        recordedTime: row.debate_sections?.recorded_time,
        metadata: row.debate_sections?.metadata,
        wordCount: row.debate_sections?.word_count,
        speechCount: row.debate_sections?.speech_count
      },
      day: {
        id: row.debate_sections?.debate_days?.id,
        date: row.debate_sections?.debate_days?.date,
        chamber: row.debate_sections?.debate_days?.chamber,
        title: row.debate_sections?.debate_days?.title
      }
    }));

    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error: any) {
    console.error('Failed to fetch summaries for review:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load summaries for review' });
  }
});

router.get('/tasks/status', async (_req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const { data, error } = await supabaseDb
      .from('debate_section_tasks')
      .select('status, count:count(*)')
      .group('status');

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      statuses: data || []
    });
  } catch (error: any) {
    console.error('Failed to fetch task status:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load task status' });
  }
});

router.get('/weekly', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const periodRange = resolvePeriodRange(req.query);
    const start = periodRange.startDate;
    const end = periodRange.endDate;
    const chamber = typeof req.query.chamber === 'string' ? req.query.chamber : null;

    // NOTE: debate_days can contain multiple records per calendar date (multiple sittings/segments).
    // The UI timeframe selector is based on *dates*, so we:
    // 1) fetch all debate_day rows in the requested date range (with safety cap)
    // 2) group them into calendar-day aggregates
    const rawLimitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : null;
    const maxRawRows = Number.isFinite(rawLimitParam as number)
      ? Math.min(Math.max(rawLimitParam as number, 1), 2000)
      : 2000;

    let dayQuery = supabaseDb
      .from('debate_days')
      .select('id, date, chamber, title, word_count, speech_count')
      .order('date', { ascending: false })
      .limit(maxRawRows);

    if (start) dayQuery = dayQuery.gte('date', start);
    if (end) dayQuery = dayQuery.lte('date', end);
    if (chamber) dayQuery = dayQuery.eq('chamber', chamber);

    const { data: days, error: dayError } = await dayQuery;

    if (dayError) {
      throw new Error(dayError.message);
    }

    const dayRows = days || [];
    const dayIds = dayRows.map((day) => day.id);
    const sectionsByDayId: Record<string, any[]> = {};

    if (dayIds.length > 0) {
      const { data: sections, error: sectionError } = await supabaseDb
        .from('debate_sections')
        .select('debate_day_id, title, word_count, speech_count')
        .in('debate_day_id', dayIds);

      if (sectionError) {
        throw new Error(sectionError.message);
      }

      for (const section of sections || []) {
        const list = sectionsByDayId[section.debate_day_id] || [];
        list.push(section);
        sectionsByDayId[section.debate_day_id] = list;
      }
    }

    // Group debate_day rows into calendar-day aggregates
    type DayAggregate = {
      id: string;
      date: string | null;
      chamber: string | null;
      title: string | null;
      speeches: number | null;
      words: number | null;
      sectionCount: number;
      topSections: Array<{ title: string | null; wordCount: number | null; speechCount: number | null }>;
    };

    const groups = new Map<
      string,
      {
        date: string | null;
        chamber: string | null;
        dayIds: string[];
        titles: Set<string>;
        speeches: number;
        words: number;
      }
    >();

    for (const day of dayRows) {
      const key = `${day.date ?? 'unknown'}|${day.chamber ?? 'unknown'}`;
      const group =
        groups.get(key) || {
          date: day.date ?? null,
          chamber: day.chamber ?? null,
          dayIds: [],
          titles: new Set<string>(),
          speeches: 0,
          words: 0
        };

      group.dayIds.push(day.id);
      if (day.title) group.titles.add(day.title);
      group.speeches += Number(day.speech_count ?? 0) || 0;
      group.words += Number(day.word_count ?? 0) || 0;
      groups.set(key, group);
    }

    const aggregates: DayAggregate[] = Array.from(groups.values())
      .map((group) => {
        const allSections = group.dayIds.flatMap((dayId) => sectionsByDayId[dayId] || []);
        const topSections = allSections
          .slice()
          .sort((a, b) => (Number(b.word_count ?? 0) || 0) - (Number(a.word_count ?? 0) || 0))
          .slice(0, 5)
          .map((section) => ({
            title: section.title ?? null,
            wordCount: section.word_count ?? null,
            speechCount: section.speech_count ?? null
          }));

        const titles = Array.from(group.titles);
        const title =
          titles.length === 0 ? null : titles.length === 1 ? titles[0] : `${titles.length} sittings`;

        return {
          id: `${group.date ?? 'unknown'}-${group.chamber ?? 'unknown'}`,
          date: group.date,
          chamber: group.chamber,
          title,
          speeches: group.speeches,
          words: group.words,
          sectionCount: allSections.length,
          topSections
        };
      })
      .sort((a, b) => {
        const aTime = a.date ? Date.parse(a.date) : Number.NEGATIVE_INFINITY;
        const bTime = b.date ? Date.parse(b.date) : Number.NEGATIVE_INFINITY;
        return bTime - aTime;
      });

    res.json({
      success: true,
      period: {
        key: periodRange.key,
        label: periodRange.label,
        start: periodRange.startDate,
        end: periodRange.endDate
      },
      debates: aggregates
    });
  } catch (error: any) {
    console.error('Failed to load weekly debate metrics:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load weekly metrics' });
  }
});

router.get('/party/metrics', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const rawLimit = typeof req.query.limit === 'string' ? req.query.limit.trim().toLowerCase() : null;
    const parsedLimit = rawLimit && rawLimit !== 'all' ? Math.max(1, Math.min(parseInt(rawLimit, 10) || 0, 50)) : null;

    const periodRange = resolvePeriodRange(req.query);
    const summaries = await loadContributionSummaries(periodRange.startDateTime, periodRange.endDateTime);

    const partiesMap = new Map<
      string,
      {
        tdIds: Set<number>;
        performanceScores: number[];
        effectivenessScores: number[];
        influenceScores: number[];
        performanceDeltaTotal: number;
        topPerformer: {
          tdId: number;
          name: string | null;
          performanceScore: number;
          lastPerformanceDelta: number | null;
        } | null;
      }
    >();

    for (const summary of summaries) {
      const tdInfo = summary.info || {};
      const partyKey = tdInfo.party || 'Unknown';

      if (!partiesMap.has(partyKey)) {
        partiesMap.set(partyKey, {
          tdIds: new Set<number>(),
          performanceScores: [],
          effectivenessScores: [],
          influenceScores: [],
          performanceDeltaTotal: 0,
          topPerformer: null
        });
      }

      const bucket = partiesMap.get(partyKey)!;
      bucket.tdIds.add(summary.tdId);
      bucket.performanceScores.push(summary.performanceScore);
      bucket.effectivenessScores.push(summary.effectivenessScore);
      bucket.influenceScores.push(summary.influenceScore);
      bucket.performanceDeltaTotal += summary.performanceDelta;

      if (!bucket.topPerformer || summary.performanceScore > bucket.topPerformer.performanceScore) {
        bucket.topPerformer = {
          tdId: summary.tdId,
          name: tdInfo.politician_name || null,
          performanceScore: Number(summary.performanceScore.toFixed(2)),
          lastPerformanceDelta: summary.lastContribution
            ? Number((summary.lastContribution.performanceDelta ?? 0).toFixed(2))
            : null
        };
      }
    }

    const partiesList = Array.from(partiesMap.entries())
      .map(([party, bucket]) => {
        const tdCount = bucket.tdIds.size;
        if (tdCount === 0) {
          return null;
        }

        const avgPerformance = bucket.performanceScores.reduce((acc, value) => acc + value, 0) / tdCount;
        const avgEffectiveness = bucket.effectivenessScores.reduce((acc, value) => acc + value, 0) / tdCount;
        const avgInfluence = bucket.influenceScores.reduce((acc, value) => acc + value, 0) / tdCount;
        const avgPerformanceDelta = tdCount > 0 ? bucket.performanceDeltaTotal / tdCount : 0;

        return {
          party,
          tdCount,
          avgPerformance: Number(avgPerformance.toFixed(2)),
          avgEffectiveness: Number(avgEffectiveness.toFixed(2)),
          avgInfluence: Number(avgInfluence.toFixed(2)),
          avgPerformanceDelta: Number(avgPerformanceDelta.toFixed(2)),
          totalPerformanceDelta: Number(bucket.performanceDeltaTotal.toFixed(2)),
          topPerformer: bucket.topPerformer
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.avgPerformance - a.avgPerformance);

    const parties = parsedLimit ? (partiesList as any[]).slice(0, parsedLimit) : (partiesList as any[]);

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      period: {
        key: periodRange.key,
        label: periodRange.label,
        start: periodRange.startDate,
        end: periodRange.endDate
      },
      parties
    });
  } catch (error: any) {
    console.error('Failed to load party metrics:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load party metrics' });
  }
});

router.get('/topics/top', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 15, 50) : 15;
    const periodRange = resolvePeriodRange(req.query);

    let topicsQuery = supabaseDb
      .from('td_issue_focus')
      .select('topic, minutes_spoken, percentage, td_id, period_start, period_end')
      .gte('period_end', periodRange.startDate)
      .lte('period_end', periodRange.endDate);

    const { data: focusRows, error: focusError } = await topicsQuery;

    if (focusError) {
      throw focusError;
    }

    const aggregateByTopic = new Map<
      string,
      { topic: string; minutes: number; percentageTotal: number; tdCount: Set<number> }
    >();

    for (const row of focusRows || []) {
      const topic = row.topic || 'Uncategorised';
      const record =
        aggregateByTopic.get(topic) ||
        { topic, minutes: 0, percentageTotal: 0, tdCount: new Set<number>() };
      record.minutes += Number(row.minutes_spoken || 0);
      record.percentageTotal += Number(row.percentage || 0);
      if (typeof row.td_id === 'number') {
        record.tdCount.add(row.td_id);
      }
      aggregateByTopic.set(topic, record);
    }

    const topics = Array.from(aggregateByTopic.values())
      .map((entry) => ({
        topic: entry.topic,
        minutes: entry.minutes,
        tdCount: entry.tdCount.size,
        avgShare: entry.tdCount.size > 0 ? entry.percentageTotal / entry.tdCount.size : 0
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, limit);

    res.json({
      success: true,
      period: {
        key: periodRange.key,
        label: periodRange.label,
        start: periodRange.startDate,
        end: periodRange.endDate
      },
      topics
    });
  } catch (error: any) {
    console.error('Failed to load top topics:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load topics' });
  }
});

router.get('/alerts', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 20, 100) : 20;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const type = typeof req.query.type === 'string' ? req.query.type : null;
    const tdIdentifier = typeof req.query.td === 'string' ? req.query.td : null;
    const periodRange = resolvePeriodRange(req.query);

    let tdId: number | null = null;
    if (tdIdentifier) {
      const tdRecord = await findTDRecord(tdIdentifier);
      if (!tdRecord) {
        return res.status(404).json({ success: false, message: `TD "${tdIdentifier}" not found.` });
      }
      tdId = tdRecord.id;
    }

    let query = supabaseDb
      .from('debate_alerts')
      .select('id, td_id, alert_type, topic, current_position, previous_position, confidence, severity, summary, payload, status, triggered_at, current_period_start, current_period_end')
      .gte('triggered_at', periodRange.startDateTime)
      .lte('triggered_at', periodRange.endDateTime)
      .order('triggered_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('alert_type', type);
    if (tdId) query = query.eq('td_id', tdId);

    const { data, error } = await query;
    if (error) throw error;

    const tdIds = Array.from(new Set((data || []).map((row: any) => row.td_id))).filter(Boolean);
    let tdMap = new Map<number, any>();
    if (tdIds.length > 0) {
      const { data: tdRows, error: tdError } = await supabaseDb
        .from('td_scores')
        .select('id, politician_name, party, constituency, image_url')
        .in('id', tdIds);
      if (tdError) throw tdError;
      tdMap = new Map((tdRows || []).map((row: any) => [row.id, row]));
    }

    const alerts = (data || []).map((row: any) => ({
      id: row.id,
      tdId: row.td_id,
      td: tdMap.get(row.td_id) || null,
      type: row.alert_type,
      topic: row.topic,
      currentPosition: row.current_position,
      previousPosition: row.previous_position,
      confidence: row.confidence,
      severity: row.severity,
      summary: row.summary,
      status: row.status,
      triggeredAt: row.triggered_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      payload: row.payload || {}
    }));

    res.json({
      success: true,
      period: {
        key: periodRange.key,
        label: periodRange.label,
        start: periodRange.startDate,
        end: periodRange.endDate
      },
      alerts
    });
  } catch (error: any) {
    console.error('Failed to load debate alerts:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load alerts' });
  }
});

router.post('/alerts/:alertId/status', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const { alertId } = req.params;
    const status = typeof req.body?.status === 'string' ? req.body.status : null;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Missing status in request body.' });
    }

    const { error } = await supabaseDb
      .from('debate_alerts')
      .update({
        status,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null
      })
      .eq('id', alertId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update alert status:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to update alert' });
  }
});

router.get('/highlights', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Supabase client is not initialised. Debate analytics unavailable.'
      });
    }

    const periodRange = resolvePeriodRange(req.query);

    const { data: highlightsData, error: highlightsError } = await supabaseDb
      .from('debate_highlights')
      .select(`
        id,
        headline,
        narrative,
        metadata,
        created_at,
        debate_days!inner (
          id,
          date,
          chamber,
          title
        ),
        debate_sections!inner (
          id,
          title
        )
      `)
      .gte('debate_days.date', periodRange.startDate)
      .lte('debate_days.date', periodRange.endDate)
      .order('created_at', { ascending: false })
      .limit(40);

    if (highlightsError) {
      throw new Error(highlightsError.message);
    }

    const highlightRows = highlightsData || [];
    if (highlightRows.length === 0) {
      return res.json({
        success: true,
        period: {
          key: periodRange.key,
          label: periodRange.label,
          start: periodRange.startDate,
          end: periodRange.endDate
        },
        highlights: []
      });
    }

    const sectionIds = highlightRows.map((row: any) => row.debate_sections?.id).filter(Boolean) as string[];

    const { data: outcomeRows, error: outcomeError } = await supabaseDb
      .from('debate_section_outcomes')
      .select('section_id, outcome, confidence, concessions, participant_evaluations')
      .in('section_id', sectionIds);

    if (outcomeError) {
      throw new Error(outcomeError.message);
    }

    const outcomesBySection = new Map<string, any>();
    for (const outcome of outcomeRows || []) {
      outcomesBySection.set(outcome.section_id, outcome);
    }

    const { data: contributionRows, error: contributionError } = await supabaseDb
      .from('debate_section_score_contributions')
      .select(`
        section_id,
        td_id,
        performance_score_after,
        performance_delta,
        effectiveness_score_after,
        effectiveness_delta,
        influence_score_after,
        influence_delta,
        performance_rating,
        overall_evaluation_score,
        metadata,
        td_scores!inner (
          id,
          politician_name,
          party,
          constituency
        )
      `)
      .in('section_id', sectionIds);

    if (contributionError) {
      throw new Error(contributionError.message);
    }

    const contributionsBySection = new Map<string, any[]>();
    for (const contribution of contributionRows || []) {
      const list = contributionsBySection.get(contribution.section_id) || [];
      list.push(contribution);
      contributionsBySection.set(contribution.section_id, list);
    }

    const formatNumber = (value: unknown) => {
      if (typeof value === 'number') return Number(value.toFixed(2));
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
      }
      return null;
    };

    const toNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return 0;
    };

    const computeImportanceScore = (contribs: any[], outcome: any): number => {
      let maxDelta = 0;
      for (const contrib of contribs) {
        const deltas = [
          toNumber(contrib.performance_delta),
          toNumber(contrib.effectiveness_delta),
          toNumber(contrib.influence_delta),
          toNumber(contrib.overall_evaluation_score)
        ];

        for (const delta of deltas) {
          const magnitude = Math.abs(delta);
          if (magnitude > maxDelta) {
            maxDelta = magnitude;
          }
        }
      }

      const confidenceBoost = Math.max(0, Math.min(1, toNumber(outcome?.confidence)));
      const participantBoost = Math.min(contribs.length, 6) * 0.05;

      return Number((maxDelta + confidenceBoost + participantBoost).toFixed(4));
    };

    const highlights = highlightRows.map((row: any) => {
      const sectionId = row.debate_sections?.id;
      const contributions = sectionId ? contributionsBySection.get(sectionId) || [] : [];
      const outcome = sectionId ? outcomesBySection.get(sectionId) ?? null : null;

      const participants = contributions
        .map((contribution: any) => {
          const tdDetails = contribution.td_scores || {};
          const metadata = contribution.metadata || {};
          return {
            tdId: contribution.td_id,
            name: tdDetails.politician_name || 'Unknown TD',
            party: tdDetails.party || null,
            constituency: tdDetails.constituency || null,
            performanceScore: formatNumber(contribution.performance_score_after),
            performanceDelta: formatNumber(contribution.performance_delta),
            effectivenessScore: formatNumber(contribution.effectiveness_score_after),
            effectivenessDelta: formatNumber(contribution.effectiveness_delta),
            influenceScore: formatNumber(contribution.influence_score_after),
            influenceDelta: formatNumber(contribution.influence_delta),
            performanceRating: contribution.performance_rating || 'moderate',
            overallEvaluationScore: formatNumber(contribution.overall_evaluation_score),
            reasoning: typeof metadata.reasoning === 'string' ? metadata.reasoning : null,
            topics: Array.isArray(metadata.topics) ? metadata.topics.slice(0, 8) : [],
            sentimentTotals: metadata.sentiment_totals || null
          };
        })
        .sort((a: any, b: any) => (Number(b.performanceDelta ?? 0) || 0) - (Number(a.performanceDelta ?? 0) || 0));

      const importanceScore = computeImportanceScore(contributions, outcome);
      const debateDate = row.debate_days?.date ?? null;

      return {
        id: row.id,
        headline: row.headline,
        narrative: row.narrative,
        createdAt: row.created_at,
        debate: {
          id: row.debate_days?.id,
          date: row.debate_days?.date,
          chamber: row.debate_days?.chamber,
          title: row.debate_days?.title
        },
        section: {
          id: sectionId,
          title: row.debate_sections?.title
        },
        outcome: outcome
          ? {
              outcome: outcome.outcome,
              confidence: outcome.confidence,
              concessions: outcome.concessions
            }
          : null,
        participants,
        metadata: row.metadata || {},
        __importanceScore: importanceScore,
        __recencyTimestamp: debateDate ? Date.parse(debateDate) : Date.parse(row.created_at)
      };
    });

    const sortedHighlights = highlights
      .sort((a, b) => {
        const importanceDiff = (b.__importanceScore ?? 0) - (a.__importanceScore ?? 0);
        if (importanceDiff !== 0) {
          return importanceDiff;
        }

        const recencyDiff = (b.__recencyTimestamp ?? 0) - (a.__recencyTimestamp ?? 0);
        if (recencyDiff !== 0) {
          return recencyDiff;
        }

        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      })
      .slice(0, 8)
      .map(({ __importanceScore, __recencyTimestamp, ...rest }) => rest);

    res.json({
      success: true,
      period: {
        key: periodRange.key,
        label: periodRange.label,
        start: periodRange.startDate,
        end: periodRange.endDate
      },
      highlights: sortedHighlights
    });
  } catch (error: any) {
    console.error('Failed to load debate highlights:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to load highlights' });
  }
});

export default router;
