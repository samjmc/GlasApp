import 'dotenv/config';
import { supabaseDb } from '../db';
import { PolicyOpportunityService } from '../services/policyOpportunityService';

const DEFAULT_LOOKBACK_DAYS = Number(process.env.POLICY_BACKFILL_DAYS ?? '90');
const BATCH_SIZE = Number(process.env.POLICY_BACKFILL_BATCH ?? '50');

async function backfill() {
  if (!supabaseDb) {
    throw new Error('Supabase client not initialised. Ensure credentials are configured.');
  }

  const lookbackDays = Number.isNaN(DEFAULT_LOOKBACK_DAYS)
    ? 90
    : Math.max(7, Math.min(365, DEFAULT_LOOKBACK_DAYS));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startIso = startDate.toISOString();

  console.log('🗳️  Backfilling policy vote opportunities...');
  console.log(`   Lookback: ${lookbackDays} days (>= ${startIso})`);

  let offset = 0;
  let processed = 0;
  let opportunitiesCreated = 0;
  let batches = 0;

  while (true) {
    const { data, error } = await supabaseDb
      .from('news_articles')
      .select(
        `
          id,
          title,
          content,
          source,
          published_date,
          policy_vote_opportunities(id)
        `,
      )
      .gte('published_date', startIso)
      .order('published_date', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Failed to load articles:', error.message);
      break;
    }

    if (!data || data.length === 0) {
      console.log('✅ No more articles to process.');
      break;
    }

    batches++;
    console.log(`   📦 Batch ${batches} — processing ${data.length} articles (offset ${offset})`);

    for (const article of data) {
      processed++;
      const existingVotes = Array.isArray(article.policy_vote_opportunities)
        ? article.policy_vote_opportunities.length
        : article.policy_vote_opportunities
        ? 1
        : 0;

      if (existingVotes > 0) {
        continue;
      }

      const created = await PolicyOpportunityService.generateAndSave(article.id, {
        id: article.id,
        title: article.title,
        content: article.content,
        source: article.source,
        published_date: new Date(article.published_date),
      });

      if (created) {
        opportunitiesCreated++;
      }
    }

    if (data.length < BATCH_SIZE) {
      console.log('✅ Reached end of dataset.');
      break;
    }

    offset += BATCH_SIZE;
  }

  const coverage =
    processed > 0 ? Math.round((opportunitiesCreated / processed) * 100) : 0;

  console.log('\n==========================================');
  console.log('📈 Policy vote backfill complete');
  console.log('==========================================');
  console.log(`   Articles scanned: ${processed}`);
  console.log(`   Opportunities created: ${opportunitiesCreated}`);
  console.log(`   Coverage: ${coverage}%`);
  console.log(`   Batches processed: ${batches}`);
  console.log('==========================================\n');
}

backfill()
  .then(() => {
    console.log('🎉 Backfill finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });



