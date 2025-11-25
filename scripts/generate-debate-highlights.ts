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
  speaker_oireachtas_id: string | null;
  speaker_name: string | null;
  word_count: number | null;
};

type SectionOutcome = {
  section_id: string;
  winner_td_id: number | null;
  runner_up_td_id: number | null;
  outcome: string | null;
  confidence: number | null;
  concessions: string | null;
  narrative: string | null;
};

type TDRecord = {
  id: number;
  politician_name: string;
  party: string | null;
  constituency: string | null;
  member_code: string | null;
  member_uri: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required to generate highlights.');
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

async function loadLatestPeriods(): Promise<Period | null> {
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

async function loadPreviousPeriod(current: Period): Promise<Period | null> {
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select('period_start, period_end')
    .neq('period_start', current.start)
    .neq('period_end', current.end)
    .order('period_end', { ascending: false })
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch previous period: ${error.message}`);
  }

  if (!data) return null;
  return { start: data.period_start as string, end: data.period_end as string };
}

async function loadTDs(): Promise<TDRecord[]> {
  const { data, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, constituency, member_code, member_uri');

  if (error) {
    throw new Error(`Failed to load TD records: ${error.message}`);
  }

  return data as TDRecord[];
}

function buildTDLookup(tds: TDRecord[]): Map<string, TDRecord> {
  const map = new Map<string, TDRecord>();
  for (const td of tds) {
    const nameKey = sanitize(td.politician_name);
    if (nameKey) map.set(nameKey, td);

    const codeKey = sanitize(td.member_code);
    if (codeKey) map.set(codeKey, td);

    const uriKey = sanitize(td.member_uri);
    if (uriKey) map.set(uriKey, td);
  }
  return map;
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
  if (!dayIds.length) return [];
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
  if (!sectionIds.length) return map;

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

async function loadOutcomes(sectionIds: string[]): Promise<Map<string, SectionOutcome>> {
  const map = new Map<string, SectionOutcome>();
  if (!sectionIds.length) return map;

  const { data, error } = await supabase
    .from('debate_section_outcomes')
    .select('section_id, winner_td_id, runner_up_td_id, outcome, confidence, concessions, narrative')
    .in('section_id', sectionIds);

  if (error) {
    throw new Error(`Failed to load section outcomes: ${error.message}`);
  }

  for (const row of data || []) {
    map.set(row.section_id, row as SectionOutcome);
  }

  return map;
}

async function loadSectionSpeeches(sectionId: string): Promise<SpeechRow[]> {
  const { data, error } = await supabase
    .from('debate_speeches')
    .select('speaker_oireachtas_id, speaker_name, word_count')
    .eq('section_id', sectionId);

  if (error) {
    throw new Error(`Failed to load speeches for section ${sectionId}: ${error.message}`);
  }

  return (data || []) as SpeechRow[];
}

async function loadInfluenceRanks(period: Period): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select('td_id, influence_score')
    .eq('period_start', period.start)
    .eq('period_end', period.end);

  if (error) {
    throw new Error(`Failed to load influence scores: ${error.message}`);
  }

  const sorted = (data || [])
    .filter((row: any) => typeof row.influence_score === 'number')
    .sort((a: any, b: any) => b.influence_score - a.influence_score);

  const map = new Map<number, number>();
  sorted.forEach((row: any, index: number) => {
    map.set(row.td_id, index + 1);
  });

  return map;
}

async function loadEffectivenessRanks(period: Period): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select('td_id, effectiveness_score')
    .eq('period_start', period.start)
    .eq('period_end', period.end);

  if (error) {
    throw new Error(`Failed to load effectiveness ranks: ${error.message}`);
  }

  const sorted = (data || [])
    .filter((row: any) => typeof row.effectiveness_score === 'number')
    .sort((a: any, b: any) => b.effectiveness_score - a.effectiveness_score);

  const map = new Map<number, number>();
  sorted.forEach((row: any, index: number) => {
    map.set(row.td_id, index + 1);
  });

  return map;
}

type MetricSnapshot = {
  effectiveness: number | null;
  influence: number | null;
};

async function loadMetricSnapshots(period: Period): Promise<Map<number, MetricSnapshot>> {
  const map = new Map<number, MetricSnapshot>();
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select('td_id, effectiveness_score, influence_score')
    .eq('period_start', period.start)
    .eq('period_end', period.end);

  if (error) {
    throw new Error(`Failed to load metric snapshots: ${error.message}`);
  }

  for (const row of data || []) {
    map.set(row.td_id, {
      effectiveness: typeof row.effectiveness_score === 'number' ? Number(row.effectiveness_score) : null,
      influence: typeof row.influence_score === 'number' ? Number(row.influence_score) : null
    });
  }

  return map;
}

async function upsertHighlight(payload: {
  debate_day_id: string;
  section_id?: string | null;
  headline: string;
  narrative: string;
  metadata: Record<string, any>;
}) {
  const { error } = await supabase
    .from('debate_highlights')
    .upsert(payload, { onConflict: 'debate_day_id' });

  if (error) {
    throw new Error(`Failed to upsert highlight: ${error.message}`);
  }
}

async function generateNarrative(input: {
  debateTitle: string;
  debateDate: string;
  chamber: string;
  sectionSummary: string | null;
  topSpeaker: {
    tdId?: number | null;
    name: string;
    party: string | null;
    constituency: string | null;
    wordCount: number;
    influenceRankCurrent: number | null;
    influenceRankPrevious: number | null;
    effectivenessRankCurrent: number | null;
    effectivenessRankPrevious: number | null;
  } | null;
  runnerUp: {
    tdId?: number | null;
    name: string;
    party: string | null;
    constituency: string | null;
    wordCount: number;
  } | null;
  outcome: {
    verdict: string | null;
    confidence: number | null;
    concessions: string | null;
    narrative: string | null;
  } | null;
}): Promise<{ headline: string; narrative: string } | null> {
  const summaryText = input.sectionSummary && input.sectionSummary.trim().length > 0
    ? input.sectionSummary
    : 'No summary available.';

  const topSpeakerText = input.topSpeaker
    ? `${input.topSpeaker.name} (${input.topSpeaker.party ?? 'Independent'})`
    : 'Top speaker unknown';

  const runnerUpText = input.runnerUp
    ? `${input.runnerUp.name} (${input.runnerUp.party ?? 'Independent'})`
    : 'Runner-up unknown';

  const influenceRankingText =
    input.topSpeaker && input.topSpeaker.influenceRankCurrent
      ? `Influence leaderboard: ${input.topSpeaker.name} moved from #${input.topSpeaker.influenceRankPrevious ?? '–'} to #${input.topSpeaker.influenceRankCurrent}.`
      : 'Influence leaderboard update unavailable.';

  const effectivenessRankingText =
    input.topSpeaker && input.topSpeaker.effectivenessRankCurrent
      ? `Effectiveness ranking: ${input.topSpeaker.name} moved from #${input.topSpeaker.effectivenessRankPrevious ?? '–'} to #${input.topSpeaker.effectivenessRankCurrent}.`
      : 'Effectiveness ranking update unavailable.';

  const outcomeVerdict = input.outcome?.verdict ?? 'unknown';
  const concessionsText = input.outcome?.concessions ?? 'n/a';
  const outcomeNarrative = input.outcome?.narrative ?? 'n/a';

  const prompt = `
Write a short headline and a 2-3 sentence highlight summary for a parliamentary debate.
The tone should be energetic but factual, suitable for a newsroom briefing.
Do not invent facts beyond the provided context.
Mention the top speaker, their key points (drawn from the summary), and note leaderboard movement if available.

Return a JSON object with keys "headline" and "narrative".

Debate Title: ${input.debateTitle}
Debate Date: ${input.debateDate}
Chamber: ${input.chamber}
Summary: ${summaryText}
Top Speaker: ${topSpeakerText} | Words: ${input.topSpeaker?.wordCount ?? 'n/a'}
Runner Up: ${runnerUpText} | Words: ${input.runnerUp?.wordCount ?? 'n/a'}
Influence Note: ${influenceRankingText}
Effectiveness Note: ${effectivenessRankingText}
Outcome Verdict: ${outcomeVerdict} (Confidence ${input.outcome?.confidence ?? 'n/a'})
Concessions or key shifts: ${concessionsText}
Outcome Narrative: ${outcomeNarrative}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.6,
    messages: [
      { role: 'system', content: 'You are a political data analyst generating concise debate highlights.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    if (parsed.headline && parsed.narrative) {
      return {
        headline: parsed.headline,
        narrative: parsed.narrative
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to parse highlight JSON:', error);
    return null;
  }
}

async function main(): Promise<void> {
  const currentPeriod = await loadLatestPeriods();
  if (!currentPeriod) {
    console.log('⚠️  No debate metrics found. Run debates:metrics first.');
    return;
  }

  const previousPeriod = await loadPreviousPeriod(currentPeriod);
  const tdRecords = await loadTDs();
  const tdLookup = buildTDLookup(tdRecords);
  const tdById = new Map<number, TDRecord>();
  tdRecords.forEach((td) => tdById.set(td.id, td));

  const currentInfluenceRanks = await loadInfluenceRanks(currentPeriod);
  const previousInfluenceRanks = previousPeriod ? await loadInfluenceRanks(previousPeriod) : new Map<number, number>();

  const currentEffectivenessRanks = await loadEffectivenessRanks(currentPeriod);
  const previousEffectivenessRanks = previousPeriod ? await loadEffectivenessRanks(previousPeriod) : new Map<number, number>();

  const currentMetricSnapshots = await loadMetricSnapshots(currentPeriod);
  const previousMetricSnapshots = previousPeriod ? await loadMetricSnapshots(previousPeriod) : new Map<number, MetricSnapshot>();

  const debateDays = await loadDebateDays(currentPeriod);
  if (debateDays.length === 0) {
    console.log('⚠️  No debate days found in the latest period.');
    return;
  }

  const sections = await loadSections(debateDays.map((day) => day.id));
    const sectionIds = sections.map((section) => section.id);
    const sectionSummaries = await loadSummaries(sectionIds);
    const sectionOutcomes = await loadOutcomes(sectionIds);

  for (const day of debateDays) {
    const daySections = sections
      .filter((section) => section.debate_day_id === day.id)
      .sort((a, b) => (b.word_count || 0) - (a.word_count || 0));

    if (daySections.length === 0) {
      console.log(`ℹ️  Skipping ${day.date} (${day.chamber}) — no sections.`);
      continue;
    }

    const primarySection = daySections[0];
    if (!primarySection || (primarySection.word_count || 0) < 5000) {
      console.log(`ℹ️  Skipping ${day.date} (${day.chamber}) — top section too small.`);
      continue;
    }

    const summary = sectionSummaries.get(primarySection.id);
    if (!summary || summary.status !== 'complete' || !summary.consensus_summary) {
      console.log(`ℹ️  Skipping ${day.date} (${day.chamber}) — no completed summary.`);
      continue;
    }

    const speechRows = await loadSectionSpeeches(primarySection.id);
    const contributions = new Map<string, { words: number; td: TDRecord | null }>();
    const tdWordTotals = new Map<number, number>();

    for (const speech of speechRows) {
      const keyCandidates = [
        sanitize(speech.speaker_oireachtas_id),
        sanitize(speech.speaker_name)
      ].filter(Boolean) as string[];

      let matchedTd: TDRecord | null = null;
      for (const key of keyCandidates) {
        if (key && tdLookup.has(key)) {
          matchedTd = tdLookup.get(key)!;
          break;
        }
      }

      const contributionKey = matchedTd ? `td-${matchedTd.id}` : `speaker-${speech.speaker_name}`;
      const entry = contributions.get(contributionKey) || { words: 0, td: matchedTd };
      entry.words += speech.word_count || 0;
      contributions.set(contributionKey, entry);

      if (matchedTd) {
        tdWordTotals.set(
          matchedTd.id,
          (tdWordTotals.get(matchedTd.id) || 0) + (speech.word_count || 0)
        );
      }
    }

    const sortedContributions = Array.from(contributions.entries())
      .sort((a, b) => b[1].words - a[1].words);

    if (sortedContributions.length === 0) {
      console.log(`ℹ️  Skipping ${day.date} — no speaker contributions found.`);
      continue;
    }

    const outcomeDetails = sectionOutcomes.get(primarySection.id);
    const winnerRecord = outcomeDetails?.winner_td_id ? tdById.get(outcomeDetails.winner_td_id) || null : null;
    const runnerOutcomeRecord = outcomeDetails?.runner_up_td_id ? tdById.get(outcomeDetails.runner_up_td_id) || null : null;

    type ParticipantRole = 'winner' | 'runner-up' | 'top-speaker';
    const participantImpactMap = new Map<number, {
      roles: ParticipantRole[];
      tdId: number;
      name: string;
      party: string | null;
      constituency: string | null;
      effectivenessScore: number | null;
      influenceScore: number | null;
      effectivenessDelta: number | null;
      influenceDelta: number | null;
    }>();

    const addParticipantImpact = (role: ParticipantRole, td: TDRecord | null) => {
      if (!td) return;
      const currentMetrics = currentMetricSnapshots.get(td.id);
      const previousMetrics = previousMetricSnapshots.get(td.id);

      const effectivenessScore =
        typeof currentMetrics?.effectiveness === 'number' ? currentMetrics.effectiveness : null;
      const influenceScore =
        typeof currentMetrics?.influence === 'number' ? currentMetrics.influence : null;

      const effectivenessDelta =
        effectivenessScore !== null && typeof previousMetrics?.effectiveness === 'number'
          ? Number((effectivenessScore - previousMetrics.effectiveness).toFixed(2))
          : null;
      const influenceDelta =
        influenceScore !== null && typeof previousMetrics?.influence === 'number'
          ? Number((influenceScore - previousMetrics.influence).toFixed(2))
          : null;

      const existing = participantImpactMap.get(td.id);
      if (existing) {
        if (!existing.roles.includes(role)) {
          existing.roles.push(role);
        }
        existing.effectivenessScore = effectivenessScore;
        existing.influenceScore = influenceScore;
        existing.effectivenessDelta = effectivenessDelta;
        existing.influenceDelta = influenceDelta;
        return;
      }

      participantImpactMap.set(td.id, {
        roles: [role],
        tdId: td.id,
        name: td.politician_name,
        party: td.party,
        constituency: td.constituency,
        effectivenessScore: effectivenessScore,
        influenceScore: influenceScore,
        effectivenessDelta,
        influenceDelta
      });
    };

    const getInfluenceRank = (map: Map<number, number>, tdId: number | null) =>
      tdId !== null ? map.get(tdId) ?? null : null;
    const getWordTotal = (tdId: number | null, fallback: number) =>
      tdId !== null ? Math.round(tdWordTotals.get(tdId) ?? fallback) : Math.round(fallback);

    const topContributionEntry = sortedContributions[0];
    const topContribution = topContributionEntry[1];
    const runnerContributionEntry = sortedContributions.length > 1 ? sortedContributions[1] : null;
    const runnerContribution = runnerContributionEntry ? runnerContributionEntry[1] : null;

    let topSpeakerInfo =
      winnerRecord
        ? {
            tdId: winnerRecord.id,
            name: winnerRecord.politician_name,
            party: winnerRecord.party,
            constituency: winnerRecord.constituency,
            wordCount: getWordTotal(winnerRecord.id, topContribution.words),
            influenceRankCurrent: getInfluenceRank(currentInfluenceRanks, winnerRecord.id),
            influenceRankPrevious: getInfluenceRank(previousInfluenceRanks, winnerRecord.id),
            effectivenessRankCurrent: getInfluenceRank(currentEffectivenessRanks, winnerRecord.id),
            effectivenessRankPrevious: getInfluenceRank(previousEffectivenessRanks, winnerRecord.id)
          }
        : null;

    if (winnerRecord) {
      addParticipantImpact('winner', winnerRecord);
    }

    if (!topSpeakerInfo) {
      const fallbackRecord = topContribution.td;
      const fallbackName = fallbackRecord
        ? fallbackRecord.politician_name
        : topContributionEntry[0].replace(/^speaker-/, '') || 'Unknown TD';
      topSpeakerInfo = {
        tdId: fallbackRecord?.id ?? null,
        name: fallbackName,
        party: fallbackRecord?.party ?? null,
        constituency: fallbackRecord?.constituency ?? null,
        wordCount: Math.round(topContribution.words),
        influenceRankCurrent: fallbackRecord ? getInfluenceRank(currentInfluenceRanks, fallbackRecord.id) : null,
        influenceRankPrevious: fallbackRecord ? getInfluenceRank(previousInfluenceRanks, fallbackRecord.id) : null,
        effectivenessRankCurrent: fallbackRecord ? getInfluenceRank(currentEffectivenessRanks, fallbackRecord.id) : null,
        effectivenessRankPrevious: fallbackRecord ? getInfluenceRank(previousEffectivenessRanks, fallbackRecord.id) : null
      };

      if (fallbackRecord) {
        addParticipantImpact('top-speaker', fallbackRecord);
      }
    } else if (winnerRecord) {
      addParticipantImpact('top-speaker', winnerRecord);
    }

    let runnerInfo = runnerOutcomeRecord
      ? {
          tdId: runnerOutcomeRecord.id,
          name: runnerOutcomeRecord.politician_name,
          party: runnerOutcomeRecord.party,
          constituency: runnerOutcomeRecord.constituency,
          wordCount: getWordTotal(runnerOutcomeRecord.id, runnerContribution?.words ?? 0)
        }
      : null;

    if (runnerOutcomeRecord) {
      addParticipantImpact('runner-up', runnerOutcomeRecord);
    }

    if (!runnerInfo && runnerContribution) {
      const fallbackRunner = runnerContribution.td;
      runnerInfo = {
        tdId: fallbackRunner?.id ?? null,
        name: fallbackRunner?.politician_name ?? (runnerContributionEntry![0].replace(/^speaker-/, '') || 'Unknown TD'),
        party: fallbackRunner?.party ?? null,
        constituency: fallbackRunner?.constituency ?? null,
        wordCount: Math.round(runnerContribution.words)
      };

      if (fallbackRunner) {
        addParticipantImpact('runner-up', fallbackRunner);
      }
    }

    const debateTitle =
      day.title && day.title.trim().length > 0 && day.title.trim().toLowerCase() !== 'debate'
        ? day.title
        : primarySection.title || `${day.chamber.toUpperCase()} session`;

    const outcomePayload = outcomeDetails
      ? {
          verdict: outcomeDetails.outcome ?? null,
          confidence: outcomeDetails.confidence ?? null,
          concessions: outcomeDetails.concessions ?? null,
          narrative: outcomeDetails.narrative ?? null
        }
      : null;

    const narrative = await generateNarrative({
      debateTitle,
      debateDate: day.date,
      chamber: day.chamber,
      sectionSummary: summary.consensus_summary,
      topSpeaker: topSpeakerInfo,
      runnerUp: runnerInfo,
      outcome: outcomePayload
    });

    if (!narrative) {
      console.log(`⚠️  Could not generate narrative for ${debateTitle}.`);
      continue;
    }

    const participantImpacts = Array.from(participantImpactMap.values());
    const roleOrder: ParticipantRole[] = ['winner', 'top-speaker', 'runner-up'];
    const rolePriority = (impact: { roles: ParticipantRole[] }) => {
      const indices = impact.roles
        .map((role) => roleOrder.indexOf(role))
        .filter((index) => index >= 0);
      return indices.length > 0 ? Math.min(...indices) : roleOrder.length;
    };
    participantImpacts.sort((a, b) => rolePriority(a) - rolePriority(b));

    await upsertHighlight({
      debate_day_id: day.id,
      section_id: primarySection.id,
      headline: narrative.headline,
      narrative: narrative.narrative,
      metadata: {
        debateDate: day.date,
        chamber: day.chamber,
        sectionId: primarySection.id,
        sectionTitle: primarySection.title,
        topSpeaker: topSpeakerInfo,
        runnerUp: runnerInfo,
        outcome: outcomePayload,
        participants: participantImpacts
      }
    });

    console.log(`✅ Highlight saved for ${debateTitle}`);
  }
}

main().catch((error) => {
  console.error('❌ Failed to generate debate highlights:', error);
  process.exit(1);
});

