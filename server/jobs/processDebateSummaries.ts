import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const MAX_STANCE_SPEECHES_PER_SECTION = 5;
const MIN_WORDS_FOR_STANCE = 120;

type DebateTask = {
  id: string;
  section_id: string;
  task_type: string;
  status: string;
  priority: number;
  attempts: number;
  payload: Record<string, any> | null;
};

type SectionDetails = {
  id: string;
  section_code: string | null;
  title: string | null;
  debate_type: string | null;
  recorded_time: string | null;
  metadata: Record<string, any> | null;
  word_count: number;
  speech_count: number;
  debate_day_id: string;
};

type DebateDayDetails = {
  id: string;
  date: string;
  chamber: string;
  title: string | null;
};

type SpeechDetails = {
  id?: string;
  speaker_name: string | null;
  speaker_role: string | null;
  paragraphs: string[];
  word_count: number;
};

interface SummaryResult {
  summaryPrimary: string | null;
  primaryModel: string | null;
  summarySecondary: string | null;
  secondaryModel: string | null;
  consensusSummary: string | null;
  confidence: number | null;
  tokensPrimary: number | null;
  tokensSecondary: number | null;
}

interface StanceResult {
  topic: string;
  position: string | null;
  sentiment: string | null;
  certainty: number | null;
  summary: string | null;
  evidence: string | null;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

const openaiApiKey = process.env.OPENAI_API_KEY;

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

if (!openai) {
  console.warn('⚠️  OPENAI_API_KEY not set. No summaries will be generated.');
}

async function run(): Promise<void> {
  const limit = parseLimitArg(process.argv);
  const concurrency = parseConcurrencyArg(process.argv);
  console.log(`\n🗣️  Processing debate summarisation tasks (limit ${limit}, concurrency ${concurrency})`);

  const tasks = await fetchPendingTasks(limit);
  if (tasks.length === 0) {
    console.log('✅ No pending tasks to process.');
    return;
  }

  const safeConcurrency = Math.max(1, concurrency);

  for (let i = 0; i < tasks.length; i += safeConcurrency) {
    const batch = tasks.slice(i, i + safeConcurrency);
    await Promise.all(
      batch.map(async (task) => {
        console.log(`\n⚙️  Task ${task.id} (${task.section_id})`);

        const locked = await lockTask(task.id, task.attempts);
        if (!locked) {
          console.log('   ⏭️  Skipping task (already picked up by another worker).');
          return;
        }

        try {
          const { section, day, speeches } = await loadSectionContext(task.section_id);

          if (!openai) {
            throw new Error('OPENAI_API_KEY not configured.');
          }

          const summary = await generateSummaries(section, day, speeches);

          await saveSummary(section.id, summary);
          await generateAndSaveStances(section, day, speeches, summary);
          await markTaskComplete(task.id);

          console.log(`   ✅ Summary saved (confidence ${summary.confidence ?? 'n/a'})`);
        } catch (error: any) {
          console.error(`   ❌ Task failed: ${error?.message || error}`);
          await handleTaskFailure(task);
        }
      })
    );
  }
}

function parseLimitArg(argv: string[]): number {
  const limitFlagIndex = argv.findIndex((arg) => arg === '--limit');
  if (limitFlagIndex !== -1 && argv[limitFlagIndex + 1]) {
    const parsed = parseInt(argv[limitFlagIndex + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_BATCH_SIZE;
}

function parseConcurrencyArg(argv: string[]): number {
  const flagIndex = argv.findIndex((arg) => arg === '--concurrency');
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    const parsed = parseInt(argv[flagIndex + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_CONCURRENCY;
}

async function fetchPendingTasks(limit: number): Promise<DebateTask[]> {
  const { data, error } = await supabase
    .from('debate_section_tasks')
    .select('id, section_id, task_type, status, priority, attempts, payload')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load pending tasks: ${error.message}`);
  }

  return data || [];
}

async function lockTask(taskId: string, attempts: number): Promise<boolean> {
  const newAttempts = (attempts ?? 0) + 1;
  const { error, data } = await supabase
    .from('debate_section_tasks')
    .update({
      status: 'processing',
      attempts: newAttempts,
      last_attempted_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    throw new Error(`Failed to lock task: ${error.message}`);
  }

  return (data || []).length > 0;
}

async function loadSectionContext(sectionId: string) {
  const { data: sectionData, error: sectionError } = await supabase
    .from('debate_sections')
    .select('id, section_code, title, debate_type, recorded_time, metadata, word_count, speech_count, debate_day_id')
    .eq('id', sectionId)
    .maybeSingle();

  const section = (sectionData ?? null) as SectionDetails | null;

  if (sectionError || !section) {
    throw new Error(sectionError?.message || 'Section not found');
  }

  const { data: dayData, error: dayError } = await supabase
    .from('debate_days')
    .select('id, date, chamber, title')
    .eq('id', section.debate_day_id)
    .maybeSingle();

  const day = (dayData ?? null) as DebateDayDetails | null;

  if (dayError || !day) {
    throw new Error(dayError?.message || 'Debate day not found');
  }

  const { data: speechData, error: speechError } = await supabase
    .from('debate_speeches')
    .select('id, speaker_name, speaker_role, paragraphs, word_count')
    .eq('section_id', sectionId)
    .order('created_at', { ascending: true });

  if (speechError) {
    throw new Error(speechError.message);
  }

  const speeches = ((speechData ?? []) as SpeechDetails[]);

  return {
    section,
    day,
    speeches
  };
}

async function generateSummaries(
  section: SectionDetails,
  day: DebateDayDetails,
  speeches: SpeechDetails[]
): Promise<SummaryResult> {
  const prompt = buildSummaryPrompt(section, day, speeches);

  const primary = await runOpenAISummary(prompt);
  const secondary = await runOpenAISummary(prompt, 'reflective');

  const consensus = buildConsensus(primary?.text ?? null, secondary?.text ?? null);
  const confidence = computeConfidence(primary?.text ?? null, secondary?.text ?? null);

  return {
    summaryPrimary: primary?.text ?? null,
    primaryModel: primary?.model ?? null,
    summarySecondary: secondary?.text ?? null,
    secondaryModel: secondary?.model ?? null,
    consensusSummary: consensus,
    confidence,
    tokensPrimary: primary?.tokens ?? null,
    tokensSecondary: secondary?.tokens ?? null
  };
}

function buildSummaryPrompt(
  section: SectionDetails,
  day: DebateDayDetails,
  speeches: SpeechDetails[]
): string {
  const question = section.metadata?.question;
  const topSpeeches = speeches.slice(0, 12);

  const speechSnippets = topSpeeches
    .map((speech, index) => {
      const speaker = speech.speaker_name || 'Unknown speaker';
      const role = speech.speaker_role ? ` (${speech.speaker_role})` : '';
      const text = (speech.paragraphs || []).join('\n').trim();
      return `Speech ${index + 1}: ${speaker}${role}\n${text}`;
    })
    .join('\n\n');

  const questionText = question?.text || question?.questionText || question?.subject;

  return `You are generating an accurate, neutral summary of an Irish parliamentary debate section.

Debate metadata:
- Date: ${day.date}
- Chamber: ${day.chamber}
- Debate title: ${day.title ?? 'N/A'}
- Section: ${section.title ?? section.section_code ?? 'Unknown'}
- Section type: ${section.debate_type ?? 'unknown'}
- Recorded time: ${section.recorded_time ?? 'unknown'}
- Word count: ${section.word_count}
- Speech count: ${section.speech_count}

If a formal parliamentary question exists, summarise the question and answer context. Question text:
${questionText ?? 'No formal question'}

Summarise key positions, commitments, disagreements, and any concrete outcomes. Highlight notable speaker contributions. Keep it within 4-6 bullet points.

Transcript excerpts:
${speechSnippets}`;
}

async function runOpenAISummary(prompt: string, variant: 'direct' | 'reflective' = 'direct') {
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          variant === 'direct'
            ? 'You are Glas Politics debate summariser. Provide accurate, neutral bullet-point summaries.'
            : 'You are Glas Politics debate analyst. Cross-check the initial summary and highlight additional nuance or context in bullet points.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 420
  });

  const summary = response.choices?.[0]?.message?.content?.trim();

  return {
    text: summary ?? null,
    model: response.model,
    tokens: response.usage?.total_tokens ?? null
  };
}

function buildConsensus(primary: string | null, secondary: string | null): string | null {
  if (primary && secondary) {
    if (primary === secondary) {
      return primary;
    }
    // Simple heuristic: if summaries are similar length, prefer the OpenAI wording but note agreement
    const lengthRatio = secondary.length > 0 ? primary.length / secondary.length : 1;
    if (lengthRatio > 0.8 && lengthRatio < 1.2) {
      return primary;
    }
    return `${primary}\n\nCross-check notes:\n${secondary}`;
  }
  return primary || secondary || null;
}

function computeConfidence(primary: string | null, secondary: string | null): number | null {
  if (primary && secondary) {
    return 0.85;
  }
  if (primary) {
    return 0.6;
  }
  return null;
}

async function saveSummary(sectionId: string, summary: SummaryResult): Promise<void> {
  const payload = {
    section_id: sectionId,
    summary_primary: summary.summaryPrimary,
    model_primary: summary.primaryModel,
    summary_secondary: summary.summarySecondary,
    model_secondary: summary.secondaryModel,
    consensus_summary: summary.consensusSummary,
    confidence: summary.confidence,
    status: 'complete',
    tokens_used_primary: summary.tokensPrimary,
    tokens_used_secondary: summary.tokensSecondary,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('debate_section_summaries')
    .upsert(payload, { onConflict: 'section_id' });

  if (error) {
    throw new Error(`Failed to save summary: ${error.message}`);
  }
}

async function markTaskComplete(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('debate_section_tasks')
    .update({ status: 'complete' })
    .eq('id', taskId);

  if (error) {
    throw new Error(`Failed to mark task complete: ${error.message}`);
  }
}

async function handleTaskFailure(task: DebateTask): Promise<void> {
  const attempts = (task.attempts ?? 0) + 1;
  const nextStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

  const { error } = await supabase
    .from('debate_section_tasks')
    .update({
      status: nextStatus,
      attempts,
      last_attempted_at: new Date().toISOString()
    })
    .eq('id', task.id);

  if (error) {
    console.error(`   ⚠️  Failed to update task status: ${error.message}`);
  }
}

async function generateAndSaveStances(
  section: SectionDetails,
  day: DebateDayDetails,
  speeches: SpeechDetails[],
  summary: SummaryResult
) {
  if (!openai) return;

  const candidates = speeches
    .filter((speech) => (speech.word_count || 0) >= MIN_WORDS_FOR_STANCE && speech.id)
    .sort((a, b) => (b.word_count || 0) - (a.word_count || 0))
    .slice(0, MAX_STANCE_SPEECHES_PER_SECTION);

  if (candidates.length === 0) return;

  const stanceRows: Array<{
    speech_id: string;
    topic: string;
    position: string | null;
    sentiment: string | null;
    certainty: number | null;
    summary: string | null;
    evidence_span: string | null;
    model: string | null;
  }> = [];

  for (const speech of candidates) {
    try {
      const stance = await generateSpeechStance(section, day, speech, summary);
      if (!stance) continue;

      stanceRows.push({
        speech_id: speech.id as string,
        topic: stance.topic,
        position: stance.position,
        sentiment: stance.sentiment,
        certainty: stance.certainty,
        summary: stance.summary,
        evidence_span: stance.evidence,
        model: 'openai-gpt-4o-mini'
      });
    } catch (error: any) {
      console.error(`   ⚠️  Failed to analyse stance for speech ${speech.id}:`, error?.message || error);
    }
  }

  if (stanceRows.length === 0) return;

  const speechIds = stanceRows.map((row) => row.speech_id);

  const { error: deleteError } = await supabase
    .from('debate_speech_stances')
    .delete()
    .in('speech_id', speechIds);

  if (deleteError) {
    console.error(`   ⚠️  Failed to reset existing stances: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase
    .from('debate_speech_stances')
    .insert(stanceRows);

  if (insertError) {
    throw new Error(`Failed to insert speech stances: ${insertError.message}`);
  }
}

async function generateSpeechStance(
  section: SectionDetails,
  day: DebateDayDetails,
  speech: SpeechDetails,
  summary: SummaryResult
): Promise<StanceResult | null> {
  if (!openai) return null;

  const prompt = buildStancePrompt(section, day, speech, summary);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.25,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a policy analyst for Glas Politics. Analyse the speaker stance and respond with the requested JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 400
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StanceResult;
    if (!parsed.topic) return null;
    return parsed;
  } catch (error) {
    console.error('   ⚠️  Failed to parse stance JSON:', error);
    return null;
  }
}

function buildStancePrompt(
  section: SectionDetails,
  day: DebateDayDetails,
  speech: SpeechDetails,
  summary: SummaryResult
): string {
  const speechText = (speech.paragraphs || []).join('\n').slice(0, 2500);
  const aggregateSummary = summary.consensusSummary ?? summary.summaryPrimary ?? '';

  return [
    `Debate date: ${day.date}`,
    `Chamber: ${day.chamber}`,
    `Section: ${section.title ?? section.section_code ?? 'Unknown'}`,
    '',
    'Section summary:',
    aggregateSummary || 'Summary not available.',
    '',
    `Speaker: ${speech.speaker_name || 'Unknown speaker'}${speech.speaker_role ? ` (${speech.speaker_role})` : ''}`,
    `Approximate word count: ${speech.word_count}`,
    '',
    'Analyse the speaker stance using this JSON schema:',
    `{
  "topic": "<primary policy topic>",
  "position": "<short description of the action, policy or viewpoint the speaker promotes>",
  "sentiment": "<supportive|neutral|opposing>",
  "certainty": <0.0-1.0>,
  "summary": "<2-3 sentence recap>",
  "evidence": "<direct quote or concise evidence>"
}`,
    '',
    'Transcript excerpt:',
    speechText
  ].join('\n');
}

run().catch((error) => {
  console.error('❌ Debate summarisation job failed:', error);
  process.exit(1);
});


