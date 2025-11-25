import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface TDRecord {
  id: number;
  politician_name: string;
  member_code: string | null;
  member_uri: string | null;
}

interface DebateDay {
  id: string;
  date: string;
  chamber: string;
}

interface DebateSection {
  id: string;
  debate_day_id: string;
  title: string | null;
  debate_type: string | null;
  metadata: Record<string, any> | null;
}

interface DebateSpeech {
  id: string;
  section_id: string;
  speaker_oireachtas_id: string | null;
  speaker_name: string | null;
  speaker_role: string | null;
  word_count: number;
}

interface SpeechStance {
  speech_id: string;
  topic: string | null;
  position: string | null;
  sentiment: string | null;
  certainty: number | null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface AggregatedTD {
  tdId: number;
  totalWords: number;
  totalSpeeches: number;
  sectionsSpoken: Set<string>;
  topicMinutes: Map<string, number>;
  chamberBreakdown: Map<string, number>;
  sentimentTotals: {
    positive: number;
    negative: number;
    neutral: number;
  };
  outcomeWins: number;
  outcomeLosses: number;
  outcomeDraws: number;
  outcomeParticipations: number;
}

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

const TOPIC_KEYWORDS: Record<string, RegExp[]> = {
  'Healthcare': [/health/i, /hospital/i, /medical/i, /cardiac/i, /care/i],
  'Housing & Homelessness': [/housing/i, /homeless/i, /accommodation/i, /rental/i],
  'Economy & Finance': [/budget/i, /tax/i, /finance/i, /economic/i, /fiscal/i],
  'Education': [/school/i, /education/i, /college/i, /student/i, /university/i],
  'Justice & Crime': [/justice/i, /crime/i, /garda/i, /court/i, /prison/i],
  'Transport & Infrastructure': [/transport/i, /road/i, /rail/i, /bus/i, /infrastructure/i],
  'Environment & Climate': [/climate/i, /environment/i, /biodiversity/i, /emission/i, /renewable/i],
  'Agriculture & Rural Affairs': [/farm/i, /agric/i, /rural/i, /forestry/i],
  'Social Welfare': [/welfare/i, /benefit/i, /pension/i, /social protection/i],
  'Foreign Affairs': [/foreign/i, /international/i, /european/i, /EU\b/i, /diplom/i],
  'Defence': [/defence/i, /army/i, /military/i, /naval/i],
  'Immigration': [/immigration/i, /asylum/i, /refugee/i, /visa/i],
  'Culture & Heritage': [/culture/i, /heritage/i, /arts/i, /gaeilge/i],
  'Local Services': [/local/i, /council/i, /water/i, /waste/i, /municipal/i],
  'Energy': [/energy/i, /grid/i, /electric/i, /gas/i, /renewable/i],
  'Other': []
};

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key && key.startsWith('--') && value) {
      args[key.slice(2)] = value;
    } else if (key && key.startsWith('--') && !value) {
      throw new Error(`Missing value for argument ${key}`);
    }
  }
  return args;
}

function sanitize(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function minutesFromWords(words: number): number {
  const WORDS_PER_MINUTE = 130;
  return words / WORDS_PER_MINUTE;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveTopic(section: DebateSection, summary: string | null): string {
  const text = [section.title ?? '', summary ?? '', section.debate_type ?? ''].join(' ');
  for (const [topic, patterns] of Object.entries(TOPIC_KEYWORDS)) {
    if (patterns.some((regex) => regex.test(text))) {
      return topic;
    }
  }
  return 'Other';
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const startDate = args.start || args.start_date;
    const endDate = args.end || args.end_date;

    if (!startDate || !endDate) {
      throw new Error('Please provide --start YYYY-MM-DD and --end YYYY-MM-DD');
    }

    console.log(`\n🧮 Calculating debate metrics from ${startDate} to ${endDate}`);

    const tdRecords = await loadTDRecords();
    const tdLookup = buildTDLookup(tdRecords);

    const debateDays = await loadDebateDays(startDate, endDate);
    if (debateDays.length === 0) {
      console.warn('No debate days found for the given range.');
      return;
    }

    const sections = await loadSections(debateDays.map((day) => day.id));
    const sectionIds = sections.map((section) => section.id);
    const sectionSummaries = await loadSectionSummaries(sectionIds);
    const sectionOutcomes = await loadSectionOutcomes(sectionIds);
    const speeches = await loadSpeeches(sectionIds);
    const stancesMap = await loadSpeechStances(speeches.map((speech) => speech.id));

    const { metrics: aggregated, sectionParticipants } = aggregateMetrics(
      speeches,
      sections,
      debateDays,
      sectionSummaries,
      tdLookup,
      stancesMap
    );

    if (aggregated.size === 0) {
      console.warn('No TD speeches matched for this period.');
      return;
    }

    applyOutcomesToAggregated(aggregated, sectionParticipants, sectionOutcomes);

    await persistMetrics(aggregated, startDate, endDate);
    await persistIssueFocus(aggregated, startDate, endDate);

    console.log(`\n✅ Debate metrics computed for ${aggregated.size} TDs`);
  } catch (error: any) {
    console.error('❌ Failed to calculate debate metrics:', error?.message || error);
    process.exit(1);
  }
}

async function loadTDRecords(): Promise<TDRecord[]> {
  const { data, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  if (error) {
    throw new Error(`Failed to load TD records: ${error.message}`);
  }

  return data || [];
}

function buildTDLookup(tdRecords: TDRecord[]) {
  const lookup = new Map<string, number>();

  for (const td of tdRecords) {
    const nameKey = sanitize(td.politician_name);
    if (nameKey) {
      lookup.set(nameKey, td.id);
    }

    const codeKey = sanitize(td.member_code);
    if (codeKey) {
      lookup.set(codeKey, td.id);
    }

    const uriKey = sanitize(td.member_uri);
    if (uriKey) {
      lookup.set(uriKey, td.id);
    }
  }

  return lookup;
}

async function loadDebateDays(startDate: string, endDate: string): Promise<DebateDay[]> {
  const { data, error } = await supabase
    .from('debate_days')
    .select('id, date, chamber')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    throw new Error(`Failed to load debate days: ${error.message}`);
  }

  return (data || []) as DebateDay[];
}

async function loadSections(dayIds: string[]): Promise<DebateSection[]> {
  const { data, error } = await supabase
    .from('debate_sections')
    .select('id, debate_day_id, title, debate_type, metadata')
    .in('debate_day_id', dayIds);

  if (error) {
    throw new Error(`Failed to load sections: ${error.message}`);
  }

  return (data || []) as DebateSection[];
}

async function loadSectionSummaries(sectionIds: string[]) {
  const { data, error } = await supabase
    .from('debate_section_summaries')
    .select('section_id, consensus_summary, summary_primary')
    .in('section_id', sectionIds);

  if (error) {
    throw new Error(`Failed to load section summaries: ${error.message}`);
  }

  const map = new Map<string, string | null>();
  for (const row of data || []) {
    const summary = row.consensus_summary || row.summary_primary || null;
    map.set(row.section_id, summary);
  }
  return map;
}

async function loadSectionOutcomes(sectionIds: string[]): Promise<Map<string, { winner_td_id: number | null; runner_up_td_id: number | null; outcome: string | null }>> {
  const map = new Map<string, { winner_td_id: number | null; runner_up_td_id: number | null; outcome: string | null }>();
  if (!sectionIds.length) return map;

  const { data, error } = await supabase
    .from('debate_section_outcomes')
    .select('section_id, winner_td_id, runner_up_td_id, outcome')
    .in('section_id', sectionIds);

  if (error) {
    throw new Error(`Failed to load section outcomes: ${error.message}`);
  }

  for (const row of data || []) {
    map.set(row.section_id, {
      winner_td_id: row.winner_td_id ?? null,
      runner_up_td_id: row.runner_up_td_id ?? null,
      outcome: row.outcome ?? null
    });
  }

  return map;
}

async function loadSpeeches(sectionIds: string[]): Promise<DebateSpeech[]> {
  const { data, error } = await supabase
    .from('debate_speeches')
    .select('id, section_id, speaker_oireachtas_id, speaker_name, speaker_role, word_count')
    .in('section_id', sectionIds);

  if (error) {
    throw new Error(`Failed to load speeches: ${error.message}`);
  }

  return (data || []) as DebateSpeech[];
}

async function loadSpeechStances(speechIds: string[]): Promise<Map<string, SpeechStance>> {
  const map = new Map<string, SpeechStance>();
  if (!speechIds.length) return map;

  const chunks = chunkArray(speechIds, 200);

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('debate_speech_stances')
      .select('speech_id, topic, position, sentiment, certainty')
      .in('speech_id', chunk);

    if (error) {
      throw new Error(`Failed to load speech stances: ${error.message}`);
    }

    for (const row of data || []) {
      map.set(row.speech_id, row as SpeechStance);
    }
  }

  return map;
}

function aggregateMetrics(
  speeches: DebateSpeech[],
  sections: DebateSection[],
  debateDays: DebateDay[],
  sectionSummaries: Map<string, string | null>,
  tdLookup: Map<string, number>,
  stancesMap: Map<string, SpeechStance>
): { metrics: Map<number, AggregatedTD>; sectionParticipants: Map<string, Set<number>> } {
  const sectionMap = new Map<string, DebateSection>();
  sections.forEach((section) => sectionMap.set(section.id, section));

  const dayMap = new Map<string, DebateDay>();
  debateDays.forEach((day) => dayMap.set(day.id, day));

  const aggregated = new Map<number, AggregatedTD>();
  const sectionParticipants = new Map<string, Set<number>>();

  for (const speech of speeches) {
    const section = sectionMap.get(speech.section_id);
    if (!section) continue;

    const day = dayMap.get(section.debate_day_id);
    if (!day) continue;

    const tdId = resolveTDId(speech, tdLookup);
    if (!tdId) continue;

    const summary = sectionSummaries.get(section.id) ?? null;
    const stance = stancesMap.get(speech.id);
    const resolvedTopic = stance?.topic && stance.topic.trim().length
      ? stance.topic.trim()
      : resolveTopic(section, summary);
    const topic = resolvedTopic;

    const participantSet = sectionParticipants.get(section.id) ?? new Set<number>();
    participantSet.add(tdId);
    sectionParticipants.set(section.id, participantSet);

    const tdEntry = aggregated.get(tdId) ?? {
      tdId,
      totalWords: 0,
      totalSpeeches: 0,
      sectionsSpoken: new Set<string>(),
      topicMinutes: new Map<string, number>(),
      chamberBreakdown: new Map<string, number>(),
      sentimentTotals: {
        positive: 0,
        negative: 0,
        neutral: 0
      },
      outcomeWins: 0,
      outcomeLosses: 0,
      outcomeDraws: 0,
      outcomeParticipations: 0
    };

    tdEntry.totalWords += speech.word_count || 0;
    tdEntry.totalSpeeches += 1;
    tdEntry.sectionsSpoken.add(section.id);

    const minutes = minutesFromWords(speech.word_count || 0);
    tdEntry.topicMinutes.set(topic, (tdEntry.topicMinutes.get(topic) || 0) + minutes);
    tdEntry.chamberBreakdown.set(day.chamber, (tdEntry.chamberBreakdown.get(day.chamber) || 0) + minutes);

    if (stance) {
      const sentiment = (stance.sentiment || '').toLowerCase();
      const certainty = typeof stance.certainty === 'number' ? clampNumber(stance.certainty, 0, 1) : 0.5;
      const sentimentWeight = minutes * certainty;

      if (sentiment === 'positive') {
        tdEntry.sentimentTotals.positive += sentimentWeight;
      } else if (sentiment === 'negative') {
        tdEntry.sentimentTotals.negative += sentimentWeight;
      } else {
        tdEntry.sentimentTotals.neutral += sentimentWeight;
      }
    }

    aggregated.set(tdId, tdEntry);
  }

  return { metrics: aggregated, sectionParticipants };
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

function applyOutcomesToAggregated(
  aggregated: Map<number, AggregatedTD>,
  sectionParticipants: Map<string, Set<number>>,
  sectionOutcomes: Map<string, { winner_td_id: number | null; runner_up_td_id: number | null; outcome: string | null }>
) {
  for (const [sectionId, outcome] of sectionOutcomes.entries()) {
    const participants = sectionParticipants.get(sectionId);
    if (!participants || participants.size === 0) continue;

    const verdict = (outcome.outcome || '').toLowerCase();
    const winnerId = outcome.winner_td_id ?? null;
    const runnerId = outcome.runner_up_td_id ?? null;

    if (verdict === 'draw' || verdict === 'stalemate' || verdict === 'split') {
      participants.forEach((tdId) => {
        const entry = aggregated.get(tdId);
        if (!entry) return;
        entry.outcomeParticipations += 1;
        entry.outcomeDraws += 1;
      });
      continue;
    }

    participants.forEach((tdId) => {
      const entry = aggregated.get(tdId);
      if (!entry) return;
      entry.outcomeParticipations += 1;

      if (winnerId && tdId === winnerId) {
        entry.outcomeWins += 1;
      } else if (runnerId && tdId === runnerId) {
        entry.outcomeDraws += 1;
      } else {
        entry.outcomeLosses += 1;
      }
    });
  }
}

async function persistMetrics(aggregated: Map<number, AggregatedTD>, startDate: string, endDate: string) {
  const rows = Array.from(aggregated.values()).map((entry) => {
    const totalWords = entry.totalWords;
    const totalSpeeches = entry.totalSpeeches;
    const uniqueSections = entry.sectionsSpoken.size;
    const totalMinutes = minutesFromWords(totalWords);

    const chamberActivity = Array.from(entry.chamberBreakdown.entries()).map(([chamber, minutes]) => ({
      chamber,
      minutes
    }));

    const engagementScore = totalWords;
    const leadershipScore = totalSpeeches;

    const sentimentTotals = entry.sentimentTotals;
    const sentimentWeight =
      sentimentTotals.positive + sentimentTotals.negative + sentimentTotals.neutral;
    let sentimentScore: number | null = null;

    if (sentimentWeight > 0) {
      sentimentScore =
        (sentimentTotals.positive - sentimentTotals.negative) / sentimentWeight;
      sentimentScore = Number(sentimentScore.toFixed(3));
    }

    const wordsComponent = Math.min(totalWords / 20000, 1);
    const speechesComponent = Math.min(totalSpeeches / 40, 1);
    const topicsComponent = Math.min(entry.topicMinutes.size / 8, 1);
    const sentimentComponent =
      sentimentScore !== null ? (sentimentScore + 1) / 2 : 0.5;

    const influenceScore = Number(
      (
        wordsComponent * 40 +
        speechesComponent * 20 +
        topicsComponent * 20 +
        sentimentComponent * 20
      ).toFixed(2)
    );

    const outcomeTotal = entry.outcomeParticipations;
    const outcomeComponent =
      outcomeTotal > 0
        ? (entry.outcomeWins + 0.5 * entry.outcomeDraws) / outcomeTotal
        : 0.5;
    const influenceNormalized = Math.min(influenceScore / 100, 1);
    const sentimentNormalized =
      sentimentScore !== null ? (sentimentScore + 1) / 2 : 0.5;
    const effectivenessScore = Number(
      (
        (outcomeComponent * 0.6 +
          influenceNormalized * 0.25 +
          sentimentNormalized * 0.15) *
        100
      ).toFixed(2)
    );

    return {
      td_id: entry.tdId,
      period_start: startDate,
      period_end: endDate,
      speeches: totalSpeeches,
      words_spoken: totalWords,
      unique_topics: entry.topicMinutes.size,
      stance_shift_score: null,
      engagement_score: engagementScore,
      leadership_score: leadershipScore,
      sentiment_score: sentimentScore,
      influence_score: influenceScore,
      effectiveness_score: effectivenessScore,
      metadata: {
        uniqueSections,
        totalMinutes,
        chamberActivity,
        sentiment: {
          positive: Number(entry.sentimentTotals.positive.toFixed(2)),
          negative: Number(entry.sentimentTotals.negative.toFixed(2)),
          neutral: Number(entry.sentimentTotals.neutral.toFixed(2)),
          score: sentimentScore
        },
        outcomes: {
          wins: entry.outcomeWins,
          losses: entry.outcomeLosses,
          draws: entry.outcomeDraws,
          participations: entry.outcomeParticipations
        }
      }
    };
  });

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('td_debate_metrics')
    .upsert(rows, { onConflict: 'td_id,period_start,period_end' });

  if (error) {
    throw new Error(`Failed to upsert td_debate_metrics: ${error.message}`);
  }
}

async function persistIssueFocus(aggregated: Map<number, AggregatedTD>, startDate: string, endDate: string) {
  const issueRows: any[] = [];

  for (const entry of aggregated.values()) {
    const totalMinutes = Array.from(entry.topicMinutes.values()).reduce((acc, val) => acc + val, 0) || 1;

    for (const [topic, minutes] of entry.topicMinutes.entries()) {
      issueRows.push({
        td_id: entry.tdId,
        topic,
        period_start: startDate,
        period_end: endDate,
        minutes_spoken: minutes,
        percentage: minutes / totalMinutes,
        trend_vs_prev: null,
        metadata: null
      });
    }
  }

  if (issueRows.length === 0) return;

  const { error } = await supabase
    .from('td_issue_focus')
    .upsert(issueRows, { onConflict: 'td_id,topic,period_start,period_end' });

  if (error) {
    throw new Error(`Failed to upsert td_issue_focus: ${error.message}`);
  }
}

main();



