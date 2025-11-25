import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

type Period = { start: string; end: string };

type DebateDay = {
  id: string;
  date: string;
  chamber: string;
  title: string | null;
};

type DebateSection = {
  id: string;
  debate_day_id: string;
  title: string | null;
  word_count: number | null;
};

type SectionSummary = {
  section_id: string;
  consensus_summary: string | null;
  status: string | null;
};

type SpeechRow = {
  id: string;
  section_id: string;
  speaker_oireachtas_id: string | null;
  speaker_name: string | null;
  speaker_party: string | null;
  word_count: number | null;
};

type StanceRow = {
  speech_id: string;
  topic: string | null;
  sentiment: string | null;
};

type TDRecord = {
  id: number;
  politician_name: string;
  party: string | null;
  constituency: string | null;
  member_code: string | null;
  member_uri: string | null;
};

type ParticipantStat = {
  td: TDRecord;
  words: number;
  speechCount: number;
  speechIds: string[];
  topics: Set<string>;
  sentimentTotals: {
    positive: number;
    negative: number;
    neutral: number;
  };
};

type ParticipantEvaluation = {
  td_id: number;
  td_name: string;
  party: string | null;
  constituency: string | null;
  words: number;
  speech_count: number;
  topics: string[];
  sentiment_totals: {
    positive: number;
    negative: number;
    neutral: number;
  };
  performance_rating: 'strong' | 'moderate' | 'weak' | 'poor';
  argument_quality: number;
  relevance_score: number;
  persuasiveness: number;
  factual_accuracy: number;
  rhetorical_effectiveness: number;
  overall_score: number;
  reasoning: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required to evaluate debate participants.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function sanitize(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

async function loadLatestPeriod(): Promise<Period | null> {
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select('period_start, period_end')
    .order('period_end', { ascending: false })
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest period: ${error.message}`);
  }

  if (!data) return null;
  return { start: data.period_start as string, end: data.period_end as string };
}

async function loadDebateDays(period: Period): Promise<DebateDay[]> {
  const { data, error } = await supabase
    .from('debate_days')
    .select('id, date, chamber, title')
    .gte('date', period.start)
    .lte('date', period.end)
    .order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to load debate days: ${error.message}`);
  }

  return (data || []) as DebateDay[];
}

async function loadSections(dayIds: string[]): Promise<DebateSection[]> {
  if (dayIds.length === 0) return [];
  const { data, error } = await supabase
    .from('debate_sections')
    .select('id, debate_day_id, title, word_count')
    .in('debate_day_id', dayIds)
    .order('word_count', { ascending: false });

  if (error) {
    throw new Error(`Failed to load debate sections: ${error.message}`);
  }

  return (data || []) as DebateSection[];
}

async function loadSummaries(sectionIds: string[]): Promise<Map<string, SectionSummary>> {
  const map = new Map<string, SectionSummary>();
  if (sectionIds.length === 0) return map;

  const { data, error } = await supabase
    .from('debate_section_summaries')
    .select('section_id, consensus_summary, status')
    .in('section_id', sectionIds);

  if (error) {
    throw new Error(`Failed to load section summaries: ${error.message}`);
  }

  for (const row of data || []) {
    map.set(row.section_id, row as SectionSummary);
  }

  return map;
}

async function loadTDs(): Promise<TDRecord[]> {
  const { data, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, constituency, member_code, member_uri');

  if (error) {
    throw new Error(`Failed to load TD records: ${error.message}`);
  }

  return (data || []) as TDRecord[];
}

function buildTDLookup(tds: TDRecord[]): Map<string, TDRecord> {
  const lookup = new Map<string, TDRecord>();
  for (const td of tds) {
    const keys = [sanitize(td.politician_name), sanitize(td.member_code), sanitize(td.member_uri)];
    for (const key of keys) {
      if (key) lookup.set(key, td);
    }
  }
  return lookup;
}

async function loadSpeeches(sectionId: string): Promise<SpeechRow[]> {
  const { data, error } = await supabase
    .from('debate_speeches')
    .select('id, section_id, speaker_oireachtas_id, speaker_name, speaker_party, word_count')
    .eq('section_id', sectionId);

  if (error) {
    throw new Error(`Failed to load speeches for section ${sectionId}: ${error.message}`);
  }

  return (data || []) as SpeechRow[];
}

async function loadStances(speechIds: string[]): Promise<StanceRow[]> {
  if (speechIds.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('debate_speech_stances')
      .select('speech_id, topic, sentiment')
      .in('speech_id', speechIds);

    if (error) {
      throw error;
    }

    return (data || []) as StanceRow[];
  } catch (error) {
    console.warn('⚠️  Failed to load stances, continuing without sentiment/topic enrichment.', error);
    return [];
  }
}

function sentimentLabelToCount(label: string | null | undefined): keyof ParticipantStat['sentimentTotals'] | null {
  if (!label) return null;
  const normalized = label.toLowerCase();
  if (normalized.includes('pos')) return 'positive';
  if (normalized.includes('neg')) return 'negative';
  if (normalized.includes('neutral')) return 'neutral';
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normaliseRating(value: string | null | undefined): ParticipantEvaluation['performance_rating'] {
  const fallback: ParticipantEvaluation['performance_rating'] = 'moderate';
  if (!value) return fallback;
  const clean = value.toLowerCase();
  if (clean.includes('strong')) return 'strong';
  if (clean.includes('poor')) return 'poor';
  if (clean.includes('weak')) return 'weak';
  if (clean.includes('moderate')) return 'moderate';
  if (clean.includes('average')) return 'moderate';
  return fallback;
}

function parseScore(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return clamp(value, 0, 1);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return clamp(parsed, 0, 1);
  }
  return fallback;
}

async function upsertParticipantEvaluations(sectionId: string, debateDayId: string, evaluations: ParticipantEvaluation[]) {
  const { data: existing, error: fetchError } = await supabase
    .from('debate_section_outcomes')
    .select('winner_td_id, runner_up_td_id, outcome, confidence, concessions, narrative, metadata')
    .eq('section_id', sectionId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load existing outcome for section ${sectionId}: ${fetchError.message}`);
  }

  const mergedMetadata = {
    ...(existing?.metadata ?? {}),
    participantEvaluation: {
      model: 'gpt-4o-mini',
      evaluatedAt: new Date().toISOString(),
      participants: evaluations.length
    }
  };

  const payload: Record<string, unknown> = {
    section_id: sectionId,
    debate_day_id: debateDayId,
    participant_evaluations: evaluations,
    metadata: mergedMetadata,
    winner_td_id: existing?.winner_td_id ?? null,
    runner_up_td_id: existing?.runner_up_td_id ?? null,
    outcome: existing?.outcome ?? 'pending',
    confidence: existing?.confidence ?? null,
    concessions: existing?.concessions ?? null,
    narrative: existing?.narrative ?? null
  };

  const { error: upsertError } = await supabase
    .from('debate_section_outcomes')
    .upsert(payload, { onConflict: 'section_id' });

  if (upsertError) {
    throw new Error(`Failed to upsert participant evaluations for section ${sectionId}: ${upsertError.message}`);
  }
}

async function evaluateSection(
  day: DebateDay,
  section: DebateSection,
  summary: SectionSummary | undefined,
  tdLookup: Map<string, TDRecord>
): Promise<void> {
  if (!summary || summary.status !== 'complete' || !summary.consensus_summary) {
    console.log(`⏭️  Skipping section ${section.id} — missing summary.`);
    return;
  }

  if ((section.word_count || 0) < 1000) {
    console.log(`⏭️  Skipping section ${section.id} — too few words (${section.word_count ?? 0}).`);
    return;
  }

  const speechRows = await loadSpeeches(section.id);
  if (speechRows.length === 0) {
    console.log(`⏭️  Skipping section ${section.id} — no speeches.`);
    return;
  }

  const participantMap = new Map<number, ParticipantStat>();
  const speechIdToTdId = new Map<string, number>();

  for (const speech of speechRows) {
    const candidateKeys = [
      sanitize(speech.speaker_oireachtas_id),
      sanitize(speech.speaker_name)
    ].filter(Boolean) as string[];

    let matchedTd: TDRecord | null = null;
    for (const key of candidateKeys) {
      if (key && tdLookup.has(key)) {
        matchedTd = tdLookup.get(key)!;
        break;
      }
    }

    if (!matchedTd) continue;

    const stat = participantMap.get(matchedTd.id) ?? {
      td: matchedTd,
      words: 0,
      speechCount: 0,
      speechIds: [],
      topics: new Set<string>(),
      sentimentTotals: { positive: 0, negative: 0, neutral: 0 }
    };

    stat.words += speech.word_count || 0;
    stat.speechCount += 1;
    stat.speechIds.push(speech.id);
    participantMap.set(matchedTd.id, stat);
    speechIdToTdId.set(speech.id, matchedTd.id);
  }

  if (participantMap.size === 0) {
    console.log(`⏭️  Skipping section ${section.id} — no TD matches.`);
    return;
  }

  const stanceRows = await loadStances(Array.from(speechIdToTdId.keys()));
  for (const stance of stanceRows) {
    const tdId = speechIdToTdId.get(stance.speech_id);
    if (!tdId) continue;
    const stat = participantMap.get(tdId);
    if (!stat) continue;

    if (stance.topic) {
      stat.topics.add(stance.topic);
    }

    const sentimentKey = sentimentLabelToCount(stance.sentiment);
    if (sentimentKey) {
      stat.sentimentTotals[sentimentKey] += 1;
    }
  }

  const participants = Array.from(participantMap.values())
    .sort((a, b) => b.words - a.words)
    .slice(0, 8);

  const promptParticipants = participants.map((participant) => {
    const topics = Array.from(participant.topics).slice(0, 6).join(', ') || 'Not specified';
    const sentimentSummary = `+${participant.sentimentTotals.positive} / -${participant.sentimentTotals.negative} / ·${participant.sentimentTotals.neutral}`;
    return `${participant.td.politician_name} (Party: ${participant.td.party ?? 'Independent'}, Constituency: ${participant.td.constituency ?? 'N/A'})\n` +
      `TD_ID: ${participant.td.id}\n` +
      `Words spoken: ${participant.words}\n` +
      `Speeches: ${participant.speechCount}\n` +
      `Topics referenced: ${topics}\n` +
      `Sentiment balance (positive/negative/neutral mentions): ${sentimentSummary}`;
  }).join('\n\n');

  const prompt = `You are evaluating participants in an Irish parliamentary debate section. Review the summary and participant stats, then score EVERY participant.

Return a JSON array where each entry includes:
{
  "td_id": number,
  "performance_rating": "strong" | "moderate" | "weak" | "poor",
  "argument_quality": number (0.0-1.0),
  "relevance_score": number (0.0-1.0),
  "persuasiveness": number (0.0-1.0),
  "factual_accuracy": number (0.0-1.0),
  "rhetorical_effectiveness": number (0.0-1.0),
  "overall_score": number (0.0-1.0),
  "reasoning": string (brief justification)
}

Be critical. Use the full range of scores. Poor or misleading contributions should result in low scores and a "poor" or "weak" rating. If arguments are middling, mark them "moderate". A "strong" rating should be reserved for genuinely compelling, evidence-backed interventions.

Debate summary:
${summary.consensus_summary}

Participant stats:
${promptParticipants}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are a political performance analyst scoring parliamentary debate contributions.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1200
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    console.warn(`⚠️  No evaluation generated for section ${section.id}.`);
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to parse evaluation JSON for section ${section.id}:`, error);
    return;
  }

  const evaluationsArray = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.participants) ? parsed.participants : [];
  if (!Array.isArray(evaluationsArray) || evaluationsArray.length === 0) {
    console.warn(`⚠️  Evaluation response empty for section ${section.id}.`);
    return;
  }

  const evaluationMap = new Map<number, ParticipantEvaluation>();

  for (const participant of participants) {
    const evaluationRaw = evaluationsArray.find((entry: any) => Number(entry?.td_id) === participant.td.id) ?? null;

    const evaluation: ParticipantEvaluation = {
      td_id: participant.td.id,
      td_name: participant.td.politician_name,
      party: participant.td.party,
      constituency: participant.td.constituency,
      words: participant.words,
      speech_count: participant.speechCount,
      topics: Array.from(participant.topics).slice(0, 12),
      sentiment_totals: participant.sentimentTotals,
      performance_rating: normaliseRating(evaluationRaw?.performance_rating),
      argument_quality: parseScore(evaluationRaw?.argument_quality, 0.5),
      relevance_score: parseScore(evaluationRaw?.relevance_score, 0.5),
      persuasiveness: parseScore(evaluationRaw?.persuasiveness, 0.5),
      factual_accuracy: parseScore(evaluationRaw?.factual_accuracy, 0.5),
      rhetorical_effectiveness: parseScore(evaluationRaw?.rhetorical_effectiveness, 0.5),
      overall_score: parseScore(evaluationRaw?.overall_score, 0.5),
      reasoning: typeof evaluationRaw?.reasoning === 'string'
        ? evaluationRaw.reasoning.slice(0, 500)
        : 'No detailed reasoning provided.'
    };

    evaluationMap.set(participant.td.id, evaluation);
  }

  const finalEvaluations = Array.from(evaluationMap.values());
  if (finalEvaluations.length === 0) {
    console.warn(`⚠️  No matched evaluations for section ${section.id}.`);
    return;
  }

  await upsertParticipantEvaluations(section.id, day.id, finalEvaluations);
  console.log(`✅ Stored participant evaluations for section ${section.id}`);
}

async function main(): Promise<void> {
  const period = await loadLatestPeriod();
  if (!period) {
    console.log('⚠️  No debate metrics found. Run debates:metrics first.');
    return;
  }

  const debateDays = await loadDebateDays(period);
  if (debateDays.length === 0) {
    console.log('⚠️  No debate days found in the latest period.');
    return;
  }

  const sections = await loadSections(debateDays.map((day) => day.id));
  const sectionSummaries = await loadSummaries(sections.map((section) => section.id));
  const tdRecords = await loadTDs();
  const tdLookup = buildTDLookup(tdRecords);

  for (const day of debateDays) {
    const daySections = sections
      .filter((section) => section.debate_day_id === day.id)
      .sort((a, b) => (b.word_count || 0) - (a.word_count || 0));

    for (const section of daySections) {
      await evaluateSection(day, section, sectionSummaries.get(section.id), tdLookup);
    }
  }
}

main().catch((error) => {
  console.error('❌ Failed to evaluate debate participants:', error);
  process.exit(1);
});
