import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Period = { start: string; end: string };

type TDRecord = {
  id: number;
  politician_name: string;
  member_code: string | null;
  member_uri: string | null;
  party: string | null;
};

type DebateDay = {
  id: string;
  date: string;
};

type DebateSection = {
  id: string;
  debate_day_id: string;
};

type DebateSpeech = {
  id: string;
  section_id: string;
  speaker_oireachtas_id: string | null;
  speaker_name: string | null;
  speaker_role: string | null;
  word_count: number | null;
};

type SpeechStance = {
  speech_id: string;
  topic: string | null;
  position: string | null;
  certainty: number | null;
  sentiment: string | null;
  summary: string | null;
  evidence_span: string | null;
};

type TopicAggregate = {
  topic: string;
  totalWeight: number;
  weights: Record<string, number>;
  confidence: number;
  dominantPosition: string | null;
  sampleEvidence: string | null;
};

type IssueFocus = {
  minutes: number;
  percentage: number;
};

const POSITION_PRIORITIES = ['supporting', 'opposing', 'proposing', 'questioning', 'neutral'];

const MIN_CONFIDENCE_FLIPFLOP = 0.52;
const MIN_WORDS_FLIPFLOP = 400;
const MIN_CURRENT_MINUTES_SURGE = 15;
const MIN_NEW_TOPIC_MINUTES = 18;
const MIN_GROWTH_SURGE = 0.45;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

function sanitize(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  try {
    const periods = await loadLatestPeriods();
    if (!periods.current || !periods.previous) {
      console.warn('⚠️ Not enough periods found to compute alerts. Run metrics for at least two weeks.');
      return;
    }

    const resolvedPeriods = {
      current: periods.current,
      previous: periods.previous
    };

    console.log(`\n🔍 Generating debate consistency alerts for ${resolvedPeriods.current.start} → ${resolvedPeriods.current.end}`);

    const tdRecords = await loadTDRecords();
    const tdLookup = buildTDLookup(tdRecords);

    const [currentSnapshot, previousSnapshot] = await Promise.all([
      buildPeriodSnapshot(resolvedPeriods.current, tdLookup),
      buildPeriodSnapshot(resolvedPeriods.previous, tdLookup)
    ]);

    const alerts = computeAlerts(tdRecords, resolvedPeriods, currentSnapshot, previousSnapshot);
    if (alerts.length === 0) {
      console.log('ℹ️  No new alerts detected for this period.');
      return;
    }

    await storeAlerts(resolvedPeriods.current, resolvedPeriods.previous, alerts);

    console.log(`✅ Stored ${alerts.length} debate alerts for period ${resolvedPeriods.current.start} → ${resolvedPeriods.current.end}`);
  } catch (error: any) {
    console.error('❌ Failed to generate consistency alerts:', error?.message || error);
    process.exit(1);
  }
}

async function loadLatestPeriods(): Promise<{ current: Period | null; previous: Period | null }> {
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select('period_start, period_end')
    .order('period_end', { ascending: false })
    .order('period_start', { ascending: false })
    .limit(2);

  if (error) {
    throw new Error(`Failed to load debate metric periods: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { current: null, previous: null };
  }

  const [current, previous] = data;
  return {
    current: current
      ? { start: current.period_start as string, end: current.period_end as string }
      : null,
    previous: data.length > 1 && previous
      ? { start: data[1].period_start as string, end: data[1].period_end as string }
      : null
  };
}

async function loadTDRecords(): Promise<TDRecord[]> {
  const { data, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri, party');

  if (error) {
    throw new Error(`Failed to load TD records: ${error.message}`);
  }

  return data || [];
}

function buildTDLookup(tdRecords: TDRecord[]) {
  const lookup = new Map<string, number>();

  for (const td of tdRecords) {
    const nameKey = sanitize(td.politician_name);
    if (nameKey) lookup.set(nameKey, td.id);

    const codeKey = sanitize(td.member_code);
    if (codeKey) lookup.set(codeKey, td.id);

    const uriKey = sanitize(td.member_uri);
    if (uriKey) lookup.set(uriKey, td.id);
  }

  return lookup;
}

async function buildPeriodSnapshot(
  period: Period,
  tdLookup: Map<string, number>
): Promise<{
  topicPositions: Map<number, Map<string, TopicAggregate>>;
  topicFocus: Map<number, Map<string, IssueFocus>>;
}> {
  const debateDays = await loadDebateDays(period.start, period.end);
  if (debateDays.length === 0) {
    return {
      topicPositions: new Map(),
      topicFocus: new Map()
    };
  }

  const sections = await loadSections(debateDays.map((day) => day.id));
  if (sections.length === 0) {
    return {
      topicPositions: new Map(),
      topicFocus: new Map()
    };
  }

  const speeches = await loadSpeeches(sections.map((section) => section.id));
  const speechMap = new Map<string, DebateSpeech>();
  speeches.forEach((speech) => speechMap.set(speech.id, speech));

  const stances = await loadStances(Array.from(speechMap.keys()));

  const topicPositions = new Map<number, Map<string, TopicAggregate>>();

  for (const stance of stances) {
    const speech = speechMap.get(stance.speech_id);
    if (!speech) continue;

    const tdId = resolveTDId(speech, tdLookup);
    if (!tdId) continue;

    const topic = normalizeTopic(stance.topic);
    const position = (stance.position || 'neutral').toLowerCase();
    const certainty = clampNumber(stance.certainty ?? 0.5, 0, 1);
    const weight = (speech.word_count || 0) * (certainty || 0.5);
    if (!weight) continue;

    const tdTopics = topicPositions.get(tdId) ?? new Map<string, TopicAggregate>();
    const aggregate =
      tdTopics.get(topic) ?? {
        topic,
        totalWeight: 0,
        weights: Object.fromEntries(POSITION_PRIORITIES.map((key) => [key, 0])),
        confidence: 0,
        dominantPosition: null,
        sampleEvidence: stance.evidence_span || null
      };

    aggregate.totalWeight += weight;
    aggregate.weights[position] = (aggregate.weights[position] || 0) + weight;

    tdTopics.set(topic, aggregate);
    topicPositions.set(tdId, tdTopics);
  }

  for (const [, topics] of topicPositions.entries()) {
    for (const [topicKey, aggregate] of topics.entries()) {
      const entries = Object.entries(aggregate.weights);
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      const [dominantPosition, dominantWeight] = sorted[0] || [null, 0];

      aggregate.dominantPosition = dominantPosition;
      aggregate.confidence = aggregate.totalWeight > 0 ? dominantWeight / aggregate.totalWeight : 0;
      topics.set(topicKey, aggregate);
    }
  }

  const topicFocus = await loadIssueFocus(period);

  return {
    topicPositions,
    topicFocus
  };
}

async function loadDebateDays(startDate: string, endDate: string): Promise<DebateDay[]> {
  const { data, error } = await supabase
    .from('debate_days')
    .select('id, date')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    throw new Error(`Failed to load debate days: ${error.message}`);
  }

  return (data || []) as DebateDay[];
}

async function loadSections(debateDayIds: string[]): Promise<DebateSection[]> {
  const { data, error } = await supabase
    .from('debate_sections')
    .select('id, debate_day_id')
    .in('debate_day_id', debateDayIds);

  if (error) {
    throw new Error(`Failed to load debate sections: ${error.message}`);
  }

  return (data || []) as DebateSection[];
}

async function loadSpeeches(sectionIds: string[]): Promise<DebateSpeech[]> {
  const { data, error } = await supabase
    .from('debate_speeches')
    .select('id, section_id, speaker_oireachtas_id, speaker_name, speaker_role, word_count')
    .in('section_id', sectionIds);

  if (error) {
    throw new Error(`Failed to load debate speeches: ${error.message}`);
  }

  return (data || []) as DebateSpeech[];
}

async function loadStances(speechIds: string[]): Promise<SpeechStance[]> {
  if (speechIds.length === 0) return [];

  const results: SpeechStance[] = [];
  const chunks = chunkArray(speechIds, 100);

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('debate_speech_stances')
      .select('speech_id, topic, position, certainty, sentiment, summary, evidence_span')
      .in('speech_id', chunk);

    if (error) {
      throw new Error(`Failed to load speech stances: ${error.message}`);
    }

    results.push(...((data || []) as SpeechStance[]));
  }

  return results;
}

async function loadIssueFocus(period: Period): Promise<Map<number, Map<string, IssueFocus>>> {
  const { data, error } = await supabase
    .from('td_issue_focus')
    .select('td_id, topic, minutes_spoken, percentage')
    .eq('period_start', period.start)
    .eq('period_end', period.end);

  if (error) {
    throw new Error(`Failed to load issue focus for period ${period.start} → ${period.end}: ${error.message}`);
  }

  const result = new Map<number, Map<string, IssueFocus>>();

  for (const row of data || []) {
    const tdId = row.td_id as number;
    const topic = normalizeTopic(row.topic);
    const minutes = Number(row.minutes_spoken || 0);
    const percentage = Number(row.percentage || 0);

    const tdTopics = result.get(tdId) ?? new Map<string, IssueFocus>();
    tdTopics.set(topic, { minutes, percentage });
    result.set(tdId, tdTopics);
  }

  return result;
}

function resolveTDId(speech: DebateSpeech, tdLookup: Map<string, number>): number | null {
  const candidateKeys = [
    sanitize(speech.speaker_oireachtas_id),
    sanitize(speech.speaker_name),
    sanitize(speech.speaker_role)
  ].filter(Boolean) as string[];

  for (const key of candidateKeys) {
    if (tdLookup.has(key)) {
      return tdLookup.get(key)!;
    }
  }

  return null;
}

function normalizeTopic(topic: string | null | undefined): string {
  const trimmed = topic?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'General';
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeAlerts(
  tdRecords: TDRecord[],
  periods: { current: Period; previous: Period },
  current: {
    topicPositions: Map<number, Map<string, TopicAggregate>>;
    topicFocus: Map<number, Map<string, IssueFocus>>;
  },
  previous: {
    topicPositions: Map<number, Map<string, TopicAggregate>>;
    topicFocus: Map<number, Map<string, IssueFocus>>;
  }
) {
  const tdById = new Map<number, TDRecord>();
  tdRecords.forEach((td) => tdById.set(td.id, td));

  const alerts: Array<{
    td_id: number;
    alert_type: string;
    topic: string | null;
    current_position: string | null;
    previous_position: string | null;
    confidence: number;
    severity: string;
    summary: string;
    payload: Record<string, any>;
  }> = [];

  for (const [tdId, currentTopics] of current.topicPositions.entries()) {
    const previousTopics = previous.topicPositions.get(tdId);
    if (!previousTopics) continue;

    const td = tdById.get(tdId);
    const tdName = td?.politician_name || 'This TD';

    for (const [topic, currentAggregate] of currentTopics.entries()) {
      const previousAggregate = previousTopics.get(topic);
      if (!previousAggregate || !currentAggregate.dominantPosition || !previousAggregate.dominantPosition) continue;

      if (isContradiction(currentAggregate.dominantPosition, previousAggregate.dominantPosition)) {
        const confidence = Math.min(currentAggregate.confidence, previousAggregate.confidence);
        if (confidence < MIN_CONFIDENCE_FLIPFLOP) continue;

        if (currentAggregate.totalWeight < MIN_WORDS_FLIPFLOP || previousAggregate.totalWeight < MIN_WORDS_FLIPFLOP) continue;

        const trendSummary = `${tdName} moved from ${labelPosition(previousAggregate.dominantPosition)} to ${labelPosition(currentAggregate.dominantPosition)} on ${topic}.`;

        alerts.push({
          td_id: tdId,
          alert_type: 'flip_flop',
          topic,
          current_position: currentAggregate.dominantPosition,
          previous_position: previousAggregate.dominantPosition,
          confidence: Number(confidence.toFixed(2)),
          severity: 'high',
          summary: trendSummary,
          payload: {
            topic,
            current: currentAggregate,
            previous: previousAggregate,
            periods
          }
        });
      }
    }
  }

  for (const [tdId, currentFocusTopics] of current.topicFocus.entries()) {
    const previousFocusTopics = previous.topicFocus.get(tdId) ?? new Map<string, IssueFocus>();
    const td = tdById.get(tdId);
    const tdName = td?.politician_name || 'This TD';

    for (const [topic, currentFocus] of currentFocusTopics.entries()) {
      const previousFocus = previousFocusTopics.get(topic);
      const prevMinutes = previousFocus?.minutes ?? 0;
      const currentMinutes = currentFocus.minutes;

      if (currentMinutes < MIN_CURRENT_MINUTES_SURGE) continue;

      const growth = prevMinutes > 0 ? (currentMinutes - prevMinutes) / prevMinutes : null;
      const isNewFocus = prevMinutes === 0 && currentMinutes >= MIN_NEW_TOPIC_MINUTES;
      const bigIncrease = growth !== null && growth >= MIN_GROWTH_SURGE;

      if (!isNewFocus && !bigIncrease) continue;

      const confidence = Math.min(0.95, isNewFocus ? 0.65 + currentMinutes / 160 : Math.min(0.9, (growth ?? 0)));
      const summary = isNewFocus
        ? `${tdName} is newly focused on ${topic.toLowerCase()} this week.`
        : `${tdName} increased attention on ${topic.toLowerCase()} by ${(growth! * 100).toFixed(1)}%.`;

      alerts.push({
        td_id: tdId,
        alert_type: 'topic_surge',
        topic,
        current_position: null,
        previous_position: null,
        confidence: Number(confidence.toFixed(2)),
        severity: isNewFocus ? 'medium' : 'medium',
        summary,
        payload: {
          topic,
          currentMinutes: Number(currentMinutes.toFixed(2)),
          previousMinutes: Number(prevMinutes.toFixed(2)),
          growth: growth !== null ? Number(growth.toFixed(2)) : null,
          periods
        }
      });
    }
  }

  return alerts;
}

function isContradiction(currentPosition: string, previousPosition: string) {
  const c = currentPosition.toLowerCase();
  const p = previousPosition.toLowerCase();
  return (
    (c === 'supporting' && p === 'opposing') ||
    (c === 'opposing' && p === 'supporting')
  );
}

function labelPosition(position: string) {
  switch (position) {
    case 'supporting':
      return 'supporting';
    case 'opposing':
      return 'opposing';
    case 'neutral':
      return 'neutral';
    case 'questioning':
      return 'questioning';
    case 'proposing':
      return 'proposing';
    default:
      return position;
  }
}

async function storeAlerts(currentPeriod: Period, previousPeriod: Period, alerts: ReturnType<typeof computeAlerts>) {
  await supabase
    .from('debate_alerts')
    .delete()
    .eq('current_period_start', currentPeriod.start)
    .eq('current_period_end', currentPeriod.end);

  const rows = alerts.map((alert) => ({
    td_id: alert.td_id,
    alert_type: alert.alert_type,
    topic: alert.topic,
    current_position: alert.current_position,
    previous_position: alert.previous_position,
    current_period_start: currentPeriod.start,
    current_period_end: currentPeriod.end,
    previous_period_start: previousPeriod.start,
    previous_period_end: previousPeriod.end,
    confidence: alert.confidence,
    severity: alert.severity,
    summary: alert.summary,
    payload: alert.payload,
    status: 'new',
    triggered_at: new Date().toISOString()
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('debate_alerts').upsert(rows, {
    onConflict: 'td_id,alert_type,topic,current_period_start,current_period_end'
  });

  if (error) {
    throw new Error(`Failed to upsert debate alerts: ${error.message}`);
  }
}

main();

