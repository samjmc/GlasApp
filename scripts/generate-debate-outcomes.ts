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
  console.error('❌ OPENAI_API_KEY is required to generate debate outcomes.');
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

async function loadSectionSpeeches(sectionId: string): Promise<SpeechRow[]> {
  const { data, error } = await supabase
    .from('debate_speeches')
    .select('speaker_oireachtas_id, speaker_name, word_count')
    .eq('section_id', sectionId);

  if (error) {
    throw new Error(`Failed to load speeches: ${error.message}`);
  }

  return (data || []) as SpeechRow[];
}

async function loadRankMap(period: Period, field: 'influence_score' | 'effectiveness_score'): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from('td_debate_metrics')
    .select(`td_id, ${field}`)
    .eq('period_start', period.start)
    .eq('period_end', period.end);

  if (error) {
    throw new Error(`Failed to load ${field} rankings: ${error.message}`);
  }

  const sorted = (data || [])
    .filter((row: any) => typeof row[field] === 'number')
    .sort((a: any, b: any) => b[field] - a[field]);

  const map = new Map<number, number>();
  sorted.forEach((row: any, index: number) => {
    map.set(row.td_id, index + 1);
  });

  return map;
}

async function upsertOutcome(payload: {
  section_id: string;
  debate_day_id: string;
  winner_td_id: number | null;
  runner_up_td_id: number | null;
  outcome: string;
  confidence: number | null;
  concessions: string | null;
  narrative: string | null;
  metadata: Record<string, any>;
}) {
  const { data: existing, error: fetchError } = await supabase
    .from('debate_section_outcomes')
    .select('participant_evaluations, metadata')
    .eq('section_id', payload.section_id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load existing outcome for section ${payload.section_id}: ${fetchError.message}`);
  }

  const mergedMetadata = {
    ...(existing?.metadata ?? {}),
    ...(payload.metadata ?? {})
  };

  const upsertPayload = {
    ...payload,
    participant_evaluations: existing?.participant_evaluations ?? null,
    metadata: mergedMetadata
  };

  const { error } = await supabase
    .from('debate_section_outcomes')
    .upsert(upsertPayload, { onConflict: 'section_id' });

  if (error) {
    throw new Error(`Failed to upsert debate section outcome: ${error.message}`);
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
  const influenceRanksCurrent = await loadRankMap(currentPeriod, 'influence_score');
  const influenceRanksPrevious = previousPeriod ? await loadRankMap(previousPeriod, 'influence_score') : new Map<number, number>();
  const effectivenessRanksCurrent = await loadRankMap(currentPeriod, 'effectiveness_score');
  const effectivenessRanksPrevious = previousPeriod ? await loadRankMap(previousPeriod, 'effectiveness_score') : new Map<number, number>();

  const debateDays = await loadDebateDays(currentPeriod);
  if (debateDays.length === 0) {
    console.log('⚠️  No debate days found in the latest period.');
    return;
  }

  const sections = await loadSections(debateDays.map((day) => day.id));
  const sectionSummaries = await loadSummaries(sections.map((section) => section.id));

  for (const day of debateDays) {
    const daySections = sections
      .filter((section) => section.debate_day_id === day.id)
      .sort((a, b) => (b.word_count || 0) - (a.word_count || 0));

    for (const section of daySections) {
      if ((section.word_count || 0) < 3000) continue;

      const summary = sectionSummaries.get(section.id);
      if (!summary || summary.status !== 'complete' || !summary.consensus_summary) continue;

      const speechRows = await loadSectionSpeeches(section.id);
      const contributions = new Map<string, { words: number; td: TDRecord | null }>();

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
      }

      const sorted = Array.from(contributions.entries())
        .filter((entry) => entry[1].td)
        .sort((a, b) => b[1].words - a[1].words)
        .slice(0, 6);

      if (sorted.length === 0) continue;

      const participants = sorted.map(([key, value]) => {
        const td = value.td!;
        return {
          td_id: td.id,
          name: td.politician_name,
          party: td.party,
          constituency: td.constituency,
          words: Math.round(value.words),
          influence_rank: influenceRanksCurrent.get(td.id) ?? null,
          influence_rank_prev: influenceRanksPrevious.get(td.id) ?? null,
          effectiveness_rank: effectivenessRanksCurrent.get(td.id) ?? null,
          effectiveness_rank_prev: effectivenessRanksPrevious.get(td.id) ?? null
        };
      });

      const prompt = `
You are analysing an Irish parliamentary debate section. Given the summary and participant stats, determine the outcome.
Return JSON with the following fields:
{
  "winner_td_id": number | null,
  "runner_up_td_id": number | null,
  "outcome": "win" | "draw" | "stalemate",
  "confidence": number between 0 and 1,
  "concessions": string (key concessions or shifts, if any),
  "narrative": string (one sentence describing why the outcome occurred)
}

Rules:
- Only choose a winner from the provided participant list.
- Use "draw" if arguments were evenly matched or inconclusive.
- "Stalemate" if no meaningful progress, even if one side spoke more.
- Mention concessions only if the summary indicates agreement or policy movement.

Debate Title: ${section.title || day.title || `${day.chamber} debate`}
Date: ${day.date}
Chamber: ${day.chamber}
Summary: ${summary.consensus_summary}
Participants: ${JSON.stringify(participants, null, 2)}
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a political analyst scoring parliamentary debates.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.warn(`⚠️  No outcome generated for section ${section.id}`);
        continue;
      }

      try {
        const parsed = JSON.parse(content);
        const validTdIds = new Set(participants.map((p) => p.td_id));

        const winnerTdId = typeof parsed.winner_td_id === 'number' && validTdIds.has(parsed.winner_td_id)
          ? parsed.winner_td_id
          : null;
        const runnerTdId = typeof parsed.runner_up_td_id === 'number' && validTdIds.has(parsed.runner_up_td_id)
          ? parsed.runner_up_td_id
          : null;

        const outcome = typeof parsed.outcome === 'string' ? parsed.outcome.toLowerCase() : 'win';
        const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : null;
        const concessions = typeof parsed.concessions === 'string' ? parsed.concessions : null;
        const narrative = typeof parsed.narrative === 'string' ? parsed.narrative : null;

        await upsertOutcome({
          section_id: section.id,
          debate_day_id: day.id,
          winner_td_id: winnerTdId,
          runner_up_td_id: runnerTdId,
          outcome,
          confidence,
          concessions,
          narrative,
          metadata: {
            participants,
            promptLength: summary.consensus_summary?.length ?? 0
          }
        });

        console.log(`✅ Outcome saved for ${section.title || day.title || section.id}`);
      } catch (error) {
        console.error(`❌ Failed to parse outcome JSON for section ${section.id}`, error);
      }
    }
  }
}

main().catch((error) => {
  console.error('❌ Failed to generate debate outcomes:', error);
  process.exit(1);
});

