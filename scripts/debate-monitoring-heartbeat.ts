import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

async function main() {
  const { data: dayRows, error: dayError, count: dayCount } = await supabase
    .from('debate_days')
    .select('id, date, ingested_at', { count: 'exact' })
    .order('date', { ascending: false })
    .limit(1);

  if (dayError) {
    throw new Error(`Failed to fetch debate days: ${dayError.message}`);
  }

  const latestDay = dayRows && dayRows.length > 0 ? dayRows[0] : null;

  const { count: sectionCount, error: sectionError } = await supabase
    .from('debate_sections')
    .select('id', { count: 'exact', head: true });

  if (sectionError) {
    throw new Error(`Failed to fetch debate sections: ${sectionError.message}`);
  }

  const { count: speechCount, error: speechError } = await supabase
    .from('debate_speeches')
    .select('id', { count: 'exact', head: true });

  if (speechError) {
    throw new Error(`Failed to fetch debate speeches: ${speechError.message}`);
  }

  const { data: taskRows, error: taskError } = await supabase
    .from('debate_section_tasks')
    .select('status');

  if (taskError) {
    throw new Error(`Failed to fetch task queue: ${taskError.message}`);
  }

  const { data: alertRows, error: alertError } = await supabase
    .from('debate_alerts')
    .select('status');

  if (alertError) {
    throw new Error(`Failed to fetch alerts: ${alertError.message}`);
  }

  const taskCounts = new Map<string, number>();
  for (const row of taskRows || []) {
    const status = row.status || 'unknown';
    taskCounts.set(status, (taskCounts.get(status) || 0) + 1);
  }

  const alertCounts = new Map<string, number>();
  for (const row of alertRows || []) {
    const status = row.status || 'unknown';
    alertCounts.set(status, (alertCounts.get(status) || 0) + 1);
  }

  const { data: lastExportRows, error: lastExportError } = await supabase
    .from('debate_exports')
    .select('created_at, status')
    .order('created_at', { ascending: false })
    .limit(1);

  if (lastExportError) {
    throw new Error(`Failed to fetch export history: ${lastExportError.message}`);
  }

  console.log('\n🩺 Debate Monitoring Summary\n');
  console.log(`• Debate days ingested: ${dayCount ?? 0}`);
  console.log(`• Sections: ${sectionCount ?? 0} | Speeches: ${speechCount ?? 0}`);

  if (latestDay) {
    console.log(
      `• Latest ingest: ${latestDay.date} (ingested_at ${latestDay.ingested_at || 'unknown'})`
    );
  } else {
    console.log('• Latest ingest: n/a');
  }

  console.log('\nQueue status:');
  if (taskCounts.size === 0) {
    console.log('  - No queued tasks');
  } else {
    taskCounts.forEach((count, status) => {
      console.log(`  - ${status}: ${count}`);
    });
  }

  console.log('\nAlert totals:');
  if (alertCounts.size === 0) {
    console.log('  - No alerts logged');
  } else {
    alertCounts.forEach((count, status) => {
      console.log(`  - ${status}: ${count}`);
    });
  }

  const lastExport = lastExportRows && lastExportRows.length > 0 ? lastExportRows[0] : null;
  console.log(
    `\nExports: ${lastExport ? `last run ${lastExport.created_at} (status ${lastExport.status})` : 'none recorded'}`
  );
}

main().catch((error) => {
  console.error('❌ Monitoring heartbeat failed:', error);
  process.exit(1);
});

