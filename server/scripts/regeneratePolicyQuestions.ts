/**
 * Regenerate Policy Questions Script
 * Backfills existing policy vote opportunities with new scenario-based question framing
 */

import { supabaseDb } from '../db';
import { PolicyOpportunityService } from '../services/policyOpportunityService';

interface ArticleRecord {
  id: number;
  title: string;
  content: string | null;
  source: string;
  published_date: string;
  policy_vote_opportunities?: {
    question_text: string;
  } | null;
}

/**
 * Check if question uses old directive framing
 */
function usesOldFraming(question: string): boolean {
  const oldPatterns = [
    /^should\s+(the\s+)?government/i,
    /^should\s+(ireland|we|they)/i,
    /^do\s+you\s+support/i,
    /^do\s+you\s+agree/i,
  ];
  
  return oldPatterns.some((pattern) => pattern.test(question.trim()));
}

/**
 * Regenerate policy questions for articles with old-style questions
 */
export async function regeneratePolicyQuestions(
  batchSize: number = 10,
  dryRun: boolean = false
): Promise<void> {
  if (!supabaseDb) {
    console.error('❌ Supabase not connected');
    return;
  }

  console.log('\n🔄 Starting policy question regeneration...');
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}\n`);

  try {
    // Fetch articles with old-style questions
    const { data: articles, error } = await supabaseDb
      .from('news_articles')
      .select(`
        id,
        title,
        content,
        source,
        published_date,
        policy_vote_opportunities!inner(question_text)
      `)
      .limit(batchSize * 10); // Get more to filter

    if (error) {
      console.error('❌ Failed to fetch articles:', error.message);
      return;
    }

    if (!articles || articles.length === 0) {
      console.log('✅ No articles found');
      return;
    }

    // Filter for articles with old-style questions
    const articlesToUpdate = articles.filter((article: ArticleRecord) => {
      const question = Array.isArray(article.policy_vote_opportunities)
        ? article.policy_vote_opportunities[0]?.question_text
        : article.policy_vote_opportunities?.question_text;
      
      if (!question) return false;
      return usesOldFraming(question);
    });

    console.log(`📊 Found ${articlesToUpdate.length} articles with old-style questions\n`);

    if (articlesToUpdate.length === 0) {
      console.log('✅ No articles need regeneration');
      return;
    }

    const batch = articlesToUpdate.slice(0, batchSize);
    let successCount = 0;
    let errorCount = 0;

    for (const article of batch) {
      try {
        console.log(`\n📰 Processing: "${article.title.substring(0, 70)}..."`);
        
        if (dryRun) {
          console.log('   [DRY RUN] Would regenerate question');
          continue;
        }

        const success = await PolicyOpportunityService.generateAndSave(
          article.id,
          {
            id: article.id,
            title: article.title,
            content: article.content || '',
            source: article.source,
            published_date: new Date(article.published_date),
          },
          { force: true }
        );

        if (success) {
          successCount++;
          console.log('   ✅ Question regenerated');
        } else {
          errorCount++;
          console.log('   ⚠️  Failed to regenerate question');
        }

        // Rate limiting - 2 seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n==========================================');
    console.log('✅ Regeneration Complete');
    console.log('==========================================');
    console.log(`   Processed: ${batch.length}`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('==========================================\n');

  } catch (error: any) {
    console.error('❌ Regeneration failed:', error.message);
  }
}

/**
 * Validate existing questions
 */
export async function validateExistingQuestions(
  limit: number = 50
): Promise<void> {
  if (!supabaseDb) {
    console.error('❌ Supabase not connected');
    return;
  }

  console.log('\n🔍 Validating existing policy questions...\n');

  try {
    const { data: opportunities, error } = await supabaseDb
      .from('policy_vote_opportunities')
      .select('id, question_text, answer_options')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Failed to fetch opportunities:', error.message);
      return;
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('✅ No questions found');
      return;
    }

    let validCount = 0;
    let invalidCount = 0;
    const invalidQuestions: Array<{ id: number; issues: string[] }> = [];

    for (const opp of opportunities) {
      const question = opp.question_text || '';
      const options = opp.answer_options 
        ? Object.values(opp.answer_options as Record<string, string>)
        : [];

      const validation = PolicyOpportunityService.validateQuestion(question, options);
      
      if (validation.isValid) {
        validCount++;
      } else {
        invalidCount++;
        invalidQuestions.push({
          id: opp.id,
          issues: validation.issues,
        });
        console.log(`\n⚠️  Question ID ${opp.id}:`);
        console.log(`   Question: ${question.substring(0, 80)}...`);
        console.log(`   Issues: ${validation.issues.join('; ')}`);
      }
    }

    console.log('\n==========================================');
    console.log('✅ Validation Complete');
    console.log('==========================================');
    console.log(`   Total: ${opportunities.length}`);
    console.log(`   Valid: ${validCount}`);
    console.log(`   Invalid: ${invalidCount}`);
    console.log('==========================================\n');

    if (invalidQuestions.length > 0) {
      console.log(`\n💡 Run regeneration script for ${invalidQuestions.length} invalid questions:\n`);
      console.log(`   npm run policy-votes:regenerate -- --batch ${Math.min(invalidQuestions.length, 20)}`);
    }

  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const validate = args.includes('--validate');
  const batchArg = args.find((arg) => arg.startsWith('--batch'));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1] || '10', 10) : 10;

  if (validate) {
    const limitArg = args.find((arg) => arg.startsWith('--limit'));
    const limit = limitArg ? parseInt(limitArg.split('=')[1] || '50', 10) : 50;
    validateExistingQuestions(limit)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  } else {
    regeneratePolicyQuestions(batchSize, dryRun)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  }
}

