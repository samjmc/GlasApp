import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

type ParticipantEvaluation = {
  td_id: number;
  td_name: string;
  party: string | null;
  constituency: string | null;
  words: number;
  speech_count: number;
  topics?: string[];
  sentiment_totals?: {
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
  reasoning?: string;
};

type OutcomeRow = {
  section_id: string;
  debate_day_id: string;
  winner_td_id: number | null;
  outcome: string | null;
  confidence: number | null;
  participant_evaluations: ParticipantEvaluation[] | null;
  debate_days: DebateDay | null;
  debate_sections: DebateSection | null;
};

type RunningScoreRow = {
  td_id: number;
  effectiveness_score: number;
  influence_score: number;
  performance_score: number;
  last_debate_date: string | null;
  metadata: Record<string, any> | null;
};

const EFFECTIVENESS_WEIGHT = 0.6;
const INFLUENCE_WEIGHT = 0.4;
const MIN_SOFT_SCORE = 15;
const MAX_SOFT_SCORE = 95;
const SCORE_LOGIT_EPSILON = 1e-3;
const SCORE_LATENT_DELTA_SCALE = 0.35;
const SCORE_SHRINK_FACTOR = 0.92;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function getSentimentScore(sentiments: ParticipantEvaluation['sentiment_totals'] | undefined): number {
  if (!sentiments) return 0;
  const total = sentiments.positive + sentiments.negative + sentiments.neutral;
  if (total <= 0) return 0;
  return clamp((sentiments.positive - sentiments.negative) / total, -1, 1);
}

function normaliseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function scoreToLatent(score: number): number {
  const normalized = clamp(score / 100, SCORE_LOGIT_EPSILON, 1 - SCORE_LOGIT_EPSILON);
  return Math.log(normalized / (1 - normalized));
}

function latentToScore(latent: number): number {
  const logistic = 1 / (1 + Math.exp(-latent));
  return logistic * 100;
}

function applySoftScoreUpdate(currentScore: number, delta: number): number {
  if (!Number.isFinite(currentScore)) {
    currentScore = 50;
  }
  const latent = scoreToLatent(currentScore);
  const nextLatent = latent + delta * SCORE_LATENT_DELTA_SCALE;
  const rawScore = latentToScore(nextLatent);
  const centered = rawScore - 50;
  const compressed = centered * SCORE_SHRINK_FACTOR;
  const adjusted = clamp(50 + compressed, MIN_SOFT_SCORE, MAX_SOFT_SCORE);
  return Number(adjusted.toFixed(2));
}

async function loadOutcomeRows(): Promise<OutcomeRow[]> {
  // Supabase responses are page-limited. If we don't paginate, we can miss the newest outcomes
  // (which makes TD performance look "stuck" on older periods).
  const pageSize = 1000;
  const maxPages = 10; // safety cap (up to 10k outcomes)
  const rows: OutcomeRow[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('debate_section_outcomes')
      .select(`
        section_id,
        debate_day_id,
        winner_td_id,
        outcome,
        confidence,
        participant_evaluations,
        debate_days!inner(id, date, chamber, title),
        debate_sections!inner(id, debate_day_id, title, word_count)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load debate outcomes: ${error.message}`);
    }

    const pageRows = (data || []) as OutcomeRow[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function contributionsExist(sectionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('debate_section_score_contributions')
    .select('section_id')
    .eq('section_id', sectionId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check contributions for section ${sectionId}: ${error.message}`);
  }

  return (data || []).length > 0;
}

async function loadRunningScores(tdIds: number[]): Promise<Map<number, RunningScoreRow>> {
  if (tdIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('td_debate_running_scores')
    .select('td_id, effectiveness_score, influence_score, performance_score, last_debate_date, metadata')
    .in('td_id', tdIds);

  if (error) {
    throw new Error(`Failed to load running scores: ${error.message}`);
  }

  const map = new Map<number, RunningScoreRow>();
  for (const row of data || []) {
    map.set(row.td_id, {
      td_id: row.td_id,
      effectiveness_score: Number(row.effectiveness_score ?? 50),
      influence_score: Number(row.influence_score ?? 50),
      performance_score: Number(row.performance_score ?? 50),
      last_debate_date: row.last_debate_date ?? null,
      metadata: (row.metadata as Record<string, any> | null) ?? null
    });
  }

  return map;
}

async function ensureRunningScores(tdIds: number[]): Promise<Map<number, RunningScoreRow>> {
  const uniqueTdIds = Array.from(new Set(tdIds));
  const existing = await loadRunningScores(uniqueTdIds);

  const missing = uniqueTdIds.filter((tdId) => !existing.has(tdId));
  if (missing.length > 0) {
    const seedRows = missing.map((tdId) => ({
      td_id: tdId,
      effectiveness_score: 50,
      influence_score: 50,
      performance_score: 50,
      metadata: {}
    }));

    const { error: seedError } = await supabase
      .from('td_debate_running_scores')
      .upsert(seedRows, { onConflict: 'td_id' });

    if (seedError) {
      throw new Error(`Failed to seed running scores: ${seedError.message}`);
    }

    const refreshed = await loadRunningScores(missing);
    for (const [tdId, row] of refreshed.entries()) {
      existing.set(tdId, row);
    }
  }

  return existing;
}

function getRatingMultiplier(rating: ParticipantEvaluation['performance_rating']): number {
  switch (rating) {
    case 'strong':
      return 1.2;
    case 'weak':
      return 0.5;
    case 'poor':
      return 0.2;
    case 'moderate':
    default:
      return 0.8;
  }
}

function computeOutcomeRole(
  evaluation: ParticipantEvaluation,
  outcomeRow: OutcomeRow
): 'winner' | 'participant' | 'poor_performer' {
  if (outcomeRow.winner_td_id && outcomeRow.winner_td_id === evaluation.td_id) {
    return 'winner';
  }

  if (evaluation.performance_rating === 'weak' || evaluation.performance_rating === 'poor') {
    return 'poor_performer';
  }

  return 'participant';
}

async function processSection(outcomeRow: OutcomeRow): Promise<void> {
  if (!outcomeRow.participant_evaluations || outcomeRow.participant_evaluations.length === 0) {
    console.log(`⏭️  Skipping section ${outcomeRow.section_id} — missing participant evaluations.`);
    return;
  }

  const alreadyProcessed = await contributionsExist(outcomeRow.section_id);
  if (alreadyProcessed) {
    console.log(`⏭️  Section ${outcomeRow.section_id} already processed.`);
    return;
  }

  const tdIds = outcomeRow.participant_evaluations.map((p) => p.td_id);
  const runningScores = await ensureRunningScores(tdIds);

  const now = new Date().toISOString();
  const day = outcomeRow.debate_days;
  const section = outcomeRow.debate_sections;

  const contributionRows: Record<string, unknown>[] = [];
  const runningScoreUpdates: Record<string, unknown>[] = [];

  for (const evaluation of outcomeRow.participant_evaluations) {
    const running = runningScores.get(evaluation.td_id);
    if (!running) {
      console.warn(`⚠️  Missing running score for TD ${evaluation.td_id}, skipping.`);
      continue;
    }

    const ratingMultiplier = getRatingMultiplier(evaluation.performance_rating);
    const overallScore = clamp(evaluation.overall_score, 0, 1);
    const baseDelta = (overallScore - 0.5) * 10; // -5 to +5

    const wordsContribution = Math.min(evaluation.words / 10000, 1) * 2; // Max +2
    const speechesContribution = Math.min(evaluation.speech_count / 20, 1) * 1; // Max +1
    const uniqueTopics = evaluation.topics ? evaluation.topics.length : 0;
    const topicsContribution = Math.min(uniqueTopics / 5, 1) * 1; // Max +1
    const sentimentScore = getSentimentScore(evaluation.sentiment_totals);
    const sentimentContribution = ((sentimentScore + 1) / 2) * 1; // 0..1 scaled to 1

    const activityInfluence = wordsContribution + speechesContribution + topicsContribution + sentimentContribution;

    const influenceDeltaRaw = baseDelta * ratingMultiplier * 0.4 + activityInfluence * (overallScore > 0.5 ? 1 : 0.5);
    const effectivenessBase = baseDelta * ratingMultiplier * 0.6;

    const outcomeRole = computeOutcomeRole(evaluation, outcomeRow);
    const outcomeBonus = outcomeRole === 'winner' ? 2 : outcomeRole === 'poor_performer' ? -1 : 0;

    const effectivenessDeltaRaw = effectivenessBase + outcomeBonus + (evaluation.argument_quality - 0.5) * 1;

    const clampedInfluenceDelta = clamp(influenceDeltaRaw, -3, 5);
    const clampedEffectivenessDelta = clamp(effectivenessDeltaRaw, -3, 5);
    const performanceDeltaRaw =
      clampedEffectivenessDelta * EFFECTIVENESS_WEIGHT + clampedInfluenceDelta * INFLUENCE_WEIGHT;
    const clampedPerformanceDelta = clamp(performanceDeltaRaw, -3, 5);

    const wordsWeight = clamp(Math.pow(clamp(evaluation.words / 3500, 0.2, 1), 0.75), 0.3, 1);
    const confidenceScore = clamp(normaliseNumber(outcomeRow.confidence ?? 0.65, 0.65), 0, 1);
    const confidenceWeight = clamp(Math.pow(confidenceScore, 0.6), 0.45, 1);
    const combinedWeight = clamp(wordsWeight * confidenceWeight, 0.35, 1);

    const weightedEffectivenessDelta = clampedEffectivenessDelta * combinedWeight;
    const weightedInfluenceDelta = clampedInfluenceDelta * combinedWeight;
    const weightedPerformanceDelta = clampedPerformanceDelta * combinedWeight;

    const effectivenessBefore = running.effectiveness_score;
    const influenceBefore = running.influence_score;
    const performanceBefore = running.performance_score;

    const effectivenessAfter = applySoftScoreUpdate(effectivenessBefore, weightedEffectivenessDelta);
    const influenceAfter = applySoftScoreUpdate(influenceBefore, weightedInfluenceDelta);
    const performanceAfter = applySoftScoreUpdate(performanceBefore, weightedPerformanceDelta);

    const effectivenessDelta = Number((effectivenessAfter - effectivenessBefore).toFixed(2));
    const influenceDelta = Number((influenceAfter - influenceBefore).toFixed(2));
    const performanceDelta = Number((performanceAfter - performanceBefore).toFixed(2));

    const metadata = {
      topics: evaluation.topics ?? [],
      sentiment_totals: evaluation.sentiment_totals ?? { positive: 0, negative: 0, neutral: 0 },
      reasoning: evaluation.reasoning,
      activity_components: {
        wordsContribution,
        speechesContribution,
        topicsContribution,
        sentimentContribution
      },
      base_delta: baseDelta,
      confidence: outcomeRow.confidence,
      debate_chamber: day?.chamber ?? null,
      scaling: {
        wordsWeight,
        confidenceWeight,
        combinedWeight
      }
    };

    contributionRows.push({
      section_id: outcomeRow.section_id,
      debate_day_id: outcomeRow.debate_day_id,
      td_id: evaluation.td_id,
      effectiveness_score_before: Number(effectivenessBefore.toFixed(2)),
      influence_score_before: Number(influenceBefore.toFixed(2)),
      performance_score_before: Number(performanceBefore.toFixed(2)),
      effectiveness_delta: effectivenessDelta,
      influence_delta: influenceDelta,
      performance_delta: performanceDelta,
      effectiveness_score_after: effectivenessAfter,
      influence_score_after: influenceAfter,
      performance_score_after: performanceAfter,
      performance_rating: evaluation.performance_rating,
      argument_quality: Number(evaluation.argument_quality.toFixed(2)),
      overall_evaluation_score: Number(overallScore.toFixed(2)),
      words_spoken: evaluation.words,
      speeches_count: evaluation.speech_count,
      outcome_role: outcomeRole,
      calculated_at: now,
      metadata
    });

    const mergedMetadata = {
      ...(running.metadata ?? {}),
      last_section_id: outcomeRow.section_id,
      last_section_title: section?.title ?? null,
      last_debate_day: day?.date ?? null,
      last_outcome: outcomeRow.outcome ?? null,
      last_performance_delta: performanceDelta
    };

    runningScoreUpdates.push({
      td_id: evaluation.td_id,
      effectiveness_score: effectivenessAfter,
      influence_score: influenceAfter,
      performance_score: performanceAfter,
      last_debate_date: day?.date ?? null,
      last_updated_at: now,
      metadata: mergedMetadata
    });
  }

  if (contributionRows.length === 0) {
    console.warn(`⚠️  No contribution rows generated for section ${outcomeRow.section_id}.`);
    return;
  }

  const { error: insertError } = await supabase
    .from('debate_section_score_contributions')
    .upsert(contributionRows, { onConflict: 'section_id,td_id' });

  if (insertError) {
    throw new Error(`Failed to upsert contributions for section ${outcomeRow.section_id}: ${insertError.message}`);
  }

  const { error: scoreUpdateError } = await supabase
    .from('td_debate_running_scores')
    .upsert(runningScoreUpdates, { onConflict: 'td_id' });

  if (scoreUpdateError) {
    throw new Error(`Failed to update running scores: ${scoreUpdateError.message}`);
  }

  console.log(`✅ Processed contributions for section ${outcomeRow.section_id}`);
}

async function main(): Promise<void> {
  const outcomeRows = await loadOutcomeRows();
  if (outcomeRows.length === 0) {
    console.log('⚠️  No debate outcomes found to process.');
    return;
  }

  for (const outcomeRow of outcomeRows) {
    try {
      await processSection(outcomeRow);
    } catch (error) {
      console.error(`❌ Failed to process section ${outcomeRow.section_id}:`, error);
    }
  }
}

main().catch((error) => {
  console.error('❌ Failed to calculate debate section contributions:', error);
  process.exit(1);
});


