/**
 * Comprehensive TD Data Validation
 * Validates all dimensional scores and identifies data issues
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

interface ValidationIssue {
  td_name: string;
  issue_type: string;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

async function validateAllTDData() {
  console.log('🔍 COMPREHENSIVE TD DATA VALIDATION');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  const issues: ValidationIssue[] = [];

  // STEP 1: Get 34th Dáil members from API (source of truth)
  console.log('📡 Fetching 34th Dáil members from API...');
  const apiUrl = 'https://api.oireachtas.ie/v1/members?chamber_id=/ie/oireachtas/house/dail/34&limit=200';
  const apiResponse = await fetch(apiUrl);
  const apiData = await apiResponse.json();
  
  const api34thDail = apiData.results.map((r: any) => ({
    name: r.member.fullName,
    code: r.member.memberCode
  }));

  console.log(`✅ API has ${api34thDail.length} TDs in 34th Dáil\n`);

  // STEP 2: Get all TDs from our database
  const { data: dbTDs } = await supabase
    .from('td_scores')
    .select('*');

  const activeTDs = dbTDs?.filter(td => td.is_active) || [];
  console.log(`✅ Database has ${activeTDs.length} active TDs\n`);

  // STEP 3: Check for mismatches
  console.log('🔍 VALIDATION CHECKS:');
  console.log('─'.repeat(70));

  // Check 1: TDs in DB but not in API
  for (const dbTD of activeTDs) {
    const inApi = api34thDail.find(api => 
      api.code === dbTD.member_code ||
      api.name.toLowerCase() === dbTD.politician_name.toLowerCase()
    );

    if (!inApi) {
      issues.push({
        td_name: dbTD.politician_name,
        issue_type: 'NOT_IN_34TH_DAIL',
        details: `Marked active but not in 34th Dáil API (likely lost seat Nov 2024)`,
        severity: 'critical'
      });
    }
  }

  // Check 2: TDs in API but not in DB
  for (const apiTD of api34thDail) {
    const inDb = dbTDs?.find(db => 
      db.member_code === apiTD.code ||
      db.politician_name.toLowerCase() === apiTD.name.toLowerCase()
    );

    if (!inDb) {
      issues.push({
        td_name: apiTD.name,
        issue_type: 'MISSING_FROM_DB',
        details: `In 34th Dáil but not in database`,
        severity: 'critical'
      });
    } else if (!inDb.is_active) {
      issues.push({
        td_name: apiTD.name,
        issue_type: 'MARKED_INACTIVE',
        details: `In 34th Dáil but marked inactive in DB`,
        severity: 'critical'
      });
    }
  }

  // Check 3: TDs with no questions (but should have some)
  for (const td of activeTDs) {
    const totalQuestions = (td.question_count_oral || 0) + (td.question_count_written || 0);
    
    if (totalQuestions === 0) {
      // Get their questions from td_questions table
      const { count } = await supabase
        .from('td_questions')
        .select('*', { count: 'exact', head: true })
        .eq('td_id', td.id);

      if (count && count > 0) {
        issues.push({
          td_name: td.politician_name,
          issue_type: 'QUESTION_COUNT_MISMATCH',
          details: `td_scores shows 0 questions but td_questions has ${count}`,
          severity: 'critical'
        });
      } else if (inApi34thDail(td, api34thDail)) {
        issues.push({
          td_name: td.politician_name,
          issue_type: 'NO_QUESTIONS',
          details: `Active TD with 0 questions (might be new or inactive)`,
          severity: 'warning'
        });
      }
    }
  }

  // Check 4: TDs with no votes
  for (const td of activeTDs) {
    if (!td.total_votes || td.total_votes === 0) {
      const { count } = await supabase
        .from('td_votes')
        .select('*', { count: 'exact', head: true })
        .eq('td_id', td.id);

      if (count && count > 0) {
        issues.push({
          td_name: td.politician_name,
          issue_type: 'VOTE_COUNT_MISMATCH',
          details: `td_scores shows 0 votes but td_votes has ${count}`,
          severity: 'critical'
        });
      } else if (inApi34thDail(td, api34thDail)) {
        issues.push({
          td_name: td.politician_name,
          issue_type: 'NO_VOTES',
          details: `Active TD with 0 votes - likely lost seat or data missing`,
          severity: 'critical'
        });
      }
    }
  }

  // Check 5: Dimensional scores not calculated
  for (const td of activeTDs) {
    if (td.effectiveness_score === null || td.effectiveness_score === undefined) {
      issues.push({
        td_name: td.politician_name,
        issue_type: 'MISSING_EFFECTIVENESS',
        details: `Effectiveness score not calculated`,
        severity: 'warning'
      });
    }

    if (td.constituency_service_score === null || td.constituency_service_score === undefined) {
      issues.push({
        td_name: td.politician_name,
        issue_type: 'MISSING_CONSTITUENCY',
        details: `Constituency service score not calculated`,
        severity: 'warning'
      });
    }
  }

  // PRINT RESULTS
  console.log('\n' + '═'.repeat(70));
  console.log('📋 VALIDATION RESULTS');
  console.log('═'.repeat(70));

  const critical = issues.filter(i => i.severity === 'critical');
  const warnings = issues.filter(i => i.severity === 'warning');

  console.log(`\n🚨 CRITICAL ISSUES: ${critical.length}`);
  if (critical.length > 0) {
    const byType = groupBy(critical, 'issue_type');
    for (const [type, typeIssues] of Object.entries(byType)) {
      console.log(`\n${type} (${typeIssues.length}):`);
      typeIssues.forEach((issue: any) => {
        console.log(`   - ${issue.td_name}: ${issue.details}`);
      });
    }
  }

  console.log(`\n⚠️  WARNINGS: ${warnings.length}`);
  if (warnings.length > 0 && warnings.length <= 10) {
    warnings.forEach(issue => {
      console.log(`   - ${issue.td_name}: ${issue.details}`);
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));
  console.log(`34th Dáil (API): ${api34thDail.length} TDs`);
  console.log(`Database Active: ${activeTDs.length} TDs`);
  console.log(`Critical Issues: ${critical.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log('═'.repeat(70));

  // Create fix recommendations
  console.log('\n💡 RECOMMENDED FIXES:');
  console.log('─'.repeat(70));

  const notInDail = critical.filter(i => i.issue_type === 'NOT_IN_34TH_DAIL');
  if (notInDail.length > 0) {
    console.log(`\n1. Mark ${notInDail.length} TDs as inactive (lost seats):`);
    notInDail.forEach(i => console.log(`   - ${i.td_name}`));
  }

  const missing = critical.filter(i => i.issue_type === 'MISSING_FROM_DB');
  if (missing.length > 0) {
    console.log(`\n2. Add ${missing.length} TDs to database:`);
    missing.forEach(i => console.log(`   - ${i.td_name}`));
  }

  const markedInactive = critical.filter(i => i.issue_type === 'MARKED_INACTIVE');
  if (markedInactive.length > 0) {
    console.log(`\n3. Reactivate ${markedInactive.length} TDs:`);
    markedInactive.forEach(i => console.log(`   - ${i.td_name}`));
  }

  const noVotes = critical.filter(i => i.issue_type === 'NO_VOTES');
  if (noVotes.length > 0) {
    console.log(`\n4. ${noVotes.length} TDs need vote extraction (or are inactive)`);
  }

  console.log('\n');
}

function inApi34thDail(td: any, apiMembers: any[]): boolean {
  return apiMembers.some(api => 
    api.code === td.member_code ||
    api.name.toLowerCase() === td.politician_name.toLowerCase()
  );
}

function groupBy(array: any[], key: string) {
  return array.reduce((result: any, item: any) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

validateAllTDData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




