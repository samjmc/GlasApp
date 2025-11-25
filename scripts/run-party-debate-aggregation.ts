import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials for party aggregation script');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run(): Promise<void> {
  console.log('📊 Aggregating debate metrics by party…');

  const { data: latestPeriod, error: latestError } = await supabase
    .from('td_debate_metrics')
    .select('period_start, period_end')
    .order('period_end', { ascending: false })
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  if (!latestPeriod) {
    console.log('⚠️ No TD debate metrics found; skipping party aggregation.');
    return;
  }

  const { data: metrics, error: metricsError } = await supabase
    .from('td_debate_metrics')
    .select('td_id, speeches, words_spoken, unique_topics, metadata')
    .eq('period_start', latestPeriod.period_start)
    .eq('period_end', latestPeriod.period_end);

  if (metricsError) {
    throw metricsError;
  }

  const { data: tdRows, error: tdError } = await supabase
    .from('td_scores')
    .select('id, party');

  if (tdError) {
    throw tdError;
  }

  const tdPartyMap = new Map<number, string>();
  for (const row of tdRows || []) {
    if (typeof row.id === 'number') {
      tdPartyMap.set(row.id, row.party || 'Independent/Other');
    }
  }

  const aggregates = new Map<string, {
    party: string;
    tdCount: number;
    totalSpeeches: number;
    totalWords: number;
    totalTopics: number;
    totalMinutes: number;
  }>();

  for (const row of metrics || []) {
    const party = tdPartyMap.get(row.td_id) || 'Independent/Other';
    const minutes = Number(row.metadata?.totalMinutes || 0);

    const record = aggregates.get(party) || {
      party,
      tdCount: 0,
      totalSpeeches: 0,
      totalWords: 0,
      totalTopics: 0,
      totalMinutes: 0
    };

    record.tdCount += 1;
    record.totalSpeeches += row.speeches || 0;
    record.totalWords += row.words_spoken || 0;
    record.totalTopics += row.unique_topics || 0;
    record.totalMinutes += minutes;

    aggregates.set(party, record);
  }

  const payload = Array.from(aggregates.values()).map((record) => ({
    party: record.party,
    td_count: record.tdCount,
    period_start: latestPeriod.period_start,
    period_end: latestPeriod.period_end,
    total_speeches: record.totalSpeeches,
    total_words: record.totalWords,
    total_topics: record.totalTopics,
    total_minutes: record.totalMinutes,
    avg_words: record.tdCount ? Math.round(record.totalWords / record.tdCount) : 0,
    avg_minutes: record.tdCount ? Number((record.totalMinutes / record.tdCount).toFixed(1)) : 0
  }));

  const { error: insertError } = await supabase
    .from('party_debate_metrics')
    .upsert(payload, { onConflict: 'party,period_start,period_end' });

  if (insertError) {
    throw insertError;
  }

  console.log(`✅ Aggregated debate metrics for ${payload.length} parties (${latestPeriod.period_start} → ${latestPeriod.period_end})`);
}

run().catch((error) => {
  console.error('❌ Failed to aggregate party debate metrics:', error);
  process.exit(1);
});

