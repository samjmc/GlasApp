/**
 * Historical Baseline Service
 * Uses AI to systematically research each TD and assign fair historical baselines
 * 
 * This creates a neutral, documented starting point for each TD based on:
 * - Tribunal findings
 * - Past scandals/achievements  
 * - Historical reputation
 * - Public service record
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabaseDb } from '../db';

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required but not set. Baseline scoring features are disabled.');
    }
    anthropic = new Anthropic({ 
      apiKey: process.env.ANTHROPIC_API_KEY 
    });
  }
  return anthropic;
}

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set. Baseline scoring features are disabled.');
    }
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }
  return openai;
}

// ============================================
// BASELINE SCORING GUIDELINES
// ============================================

const BASELINE_SCORING_PROMPT = (tdName: string, constituency: string, party: string) => `
You are an objective political analyst tasked with researching Irish TD ${tdName} (${party}, ${constituency}) to establish a fair historical baseline score.

# YOUR TASK

Research this TD's historical record and assign a baseline modifier between 0.50 and 1.30 based on documented facts.

# RESEARCH AREAS

1. **Tribunal Findings** - Any official tribunal reports or findings
2. **Criminal Convictions** - Any court convictions related to their role
3. **Major Scandals** - Documented corruption, ethics violations, or abuse of office
4. **Ethics Investigations** - SIPO investigations, Dáil inquiries, etc.
5. **Historical Achievements** - Major contributions, awards, distinguished service
6. **Public Service Record** - Length and quality of service, leadership roles
7. **Controversies** - Significant but unproven allegations or policy failures

# BASELINE MODIFIER SCALE

**0.50-0.69: SEVERE HISTORICAL ISSUES**
- Criminal convictions related to office
- **Tribunal findings on corruption, conflicts of interest, or financial impropriety** ← IMPORTANT
- Tax evasion convictions or findings
- Taking bribes, undeclared payments from interested parties
- Systematic abuse of office for personal gain
- Examples: **Moriarty Tribunal findings (Lowry), McCracken Tribunal findings, major corruption scandals**
- **NOTE: ANY tribunal finding of corruption/impropriety = SEVERE, not moderate**

**0.70-0.84: MODERATE HISTORICAL ISSUES**  
- Significant scandals WITHOUT official tribunal/court findings
- Proven ethics violations (but no corruption finding)
- Major policy failures causing documented harm
- Expenses irregularities (if deliberate and substantial)
- Examples: Unproven allegations with significant evidence, policy scandals, ministerial failures
- **NOTE: If there IS a tribunal/court finding, use SEVERE category above**

**0.85-0.94: MINOR HISTORICAL ISSUES**
- Minor scandals or controversies
- Small ethics concerns (later resolved)
- Allegations that were not proven
- Minor policy disagreements
- Examples: Expense irregularities (no intent), minor conflicts resolved

**0.95-1.05: NEUTRAL (DEFAULT)**
- No significant positive or negative historical record
- Standard political career
- No major achievements or scandals
- New TDs with limited history
- Clean record with normal controversies

**1.06-1.15: GOOD HISTORICAL RECORD**
- Significant achievements in public service
- Leadership in important reforms
- Strong reputation for integrity
- Notable contributions to Ireland
- Examples: Successful ministers, reform leaders, distinguished careers

**1.16-1.30: EXCEPTIONAL HISTORICAL RECORD**
- Presidential service or equivalent
- International recognition for public service
- Major contributions to Irish democracy/society
- Unblemished record with exceptional achievements
- Examples: Former presidents, major reformers, internationally respected figures

# EVIDENCE REQUIREMENTS

**For modifiers BELOW 0.95:**
- Must cite specific tribunal reports, court judgments, or official investigations
- Must provide dates and brief summary of findings
- Must distinguish between proven facts and allegations

**For modifiers ABOVE 1.05:**
- Must cite specific achievements, awards, or service records
- Must provide context on significance of contributions
- Must be based on documented impact, not opinion

# OUTPUT FORMAT

Respond with ONLY valid JSON (no markdown, no explanation):

{
  "politician_name": "${tdName}",
  "baseline_modifier": 1.00,
  "baseline_score_0_100": 50,
  "confidence": 0.85,
  
  "category": "neutral | minor_issues | moderate_issues | severe_issues | good_record | exceptional_record",
  
  "historical_summary": "2-3 sentence summary of their historical record",
  
  "key_findings": [
    {
      "type": "tribunal | conviction | scandal | achievement | service",
      "title": "Brief title",
      "year": "2010" or "2005-2012",
      "description": "What happened",
      "impact": "How this affects baseline",
      "source": "Moriarty Tribunal Report 2011 | Court judgment | Official record"
    }
  ],
  
  "reasoning": "Detailed explanation of why this modifier was chosen. Reference specific events, dates, and sources. Explain how each factor was weighted.",
  
  "controversies_noted": [
    "List any controversies or allegations that were NOT included in the baseline (e.g., unproven, too minor, etc.)"
  ],
  
  "data_quality": {
    "sources_found": 5,
    "primary_sources": 2,
    "confidence_factors": "What made you confident or uncertain",
    "research_date": "2025-10-31"
  }
}

# IMPORTANT PRINCIPLES

1. **Evidence-Based**: Only use documented, verifiable facts
2. **Neutral**: No political bias - apply same standards to all parties
3. **Fair but Critical**: Distinguish between proven facts and allegations, but BE CRITICAL when facts are proven
4. **Proportional**: Punishment fits the crime - tribunal findings = SEVERE (not moderate)
5. **Transparent**: All reasoning must be documented and defensible
6. **Redemption**: This is a STARTING point - TDs can improve from here
7. **Recency Balance**: Very old issues (20+ years) should have less weight unless part of a pattern
8. **BE STRICT**: Voters deserve accountability - don't be soft on corruption/impropriety
9. **Tribunal Findings = SEVERE**: Any official tribunal finding of corruption, conflicts, or impropriety should result in SEVERE category (0.50-0.69), not moderate

# CONTEXT

- This baseline sets their STARTING score for ongoing news analysis
- They can improve through good work (same rate as everyone)
- This must be defensible to the public and media
- **DO NOT err on side of leniency for tribunal findings** - voters deserve accountability
- Be tough on corruption (0.50-0.69), fair on proven mistakes (0.70-0.84), lenient only on allegations (0.85-0.94)

# SPECIFIC EXAMPLES TO FOLLOW

**Michael Lowry** should receive:
- Baseline: 0.65-0.70 (SEVERE ISSUES)
- Reasoning: Moriarty Tribunal findings (corruption, conflicts of interest), tax conviction
- This is NOT moderate - this is severe

**Bertie Ahern** should receive:
- Baseline: 0.75-0.80 (MODERATE-SEVERE)
- Reasoning: Mahon Tribunal findings on payments, but less severe than Lowry

**TDs with clean records** should receive:
- Baseline: 0.95-1.05 (NEUTRAL)
- Most TDs fall here

# RESEARCH

Now research ${tdName} thoroughly and provide your assessment.
Focus on verifiable facts from reliable sources (tribunal reports, court records, official documents).
`;

// ============================================
// TYPES
// ============================================

export interface HistoricalBaseline {
  politician_name: string;
  baseline_modifier: number;
  baseline_score_0_100: number;
  confidence: number;
  category: string;
  historical_summary: string;
  key_findings: Array<{
    type: string;
    title: string;
    year: string;
    description: string;
    impact: string;
    source: string;
  }>;
  reasoning: string;
  controversies_noted: string[];
  data_quality: {
    sources_found: number;
    primary_sources: number;
    confidence_factors: string;
    research_date: string;
  };
}

// ============================================
// MAIN RESEARCH FUNCTION
// ============================================

/**
 * Research a TD and generate historical baseline using AI
 */
export async function researchTDBaseline(
  tdName: string,
  constituency: string = 'Unknown',
  party: string = 'Unknown',
  options: {
    crossCheck?: boolean;  // Use both Claude and GPT-4 for verification
    useProvider?: 'claude' | 'gpt4' | 'both';
  } = {}
): Promise<HistoricalBaseline> {
  
  console.log(`🔍 Researching historical baseline for ${tdName}...`);
  
  // Auto-detect which provider to use based on available API keys
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  let useProvider = options.useProvider;
  if (!useProvider) {
    if (hasAnthropic) {
      useProvider = 'claude';
    } else if (hasOpenAI) {
      useProvider = 'gpt4';
      console.log('   Using GPT-4 (Anthropic key not found)');
    } else {
      throw new Error('No AI API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
    }
  }
  
  const crossCheck = options.crossCheck || false;
  
  try {
    if (useProvider === 'claude' || useProvider === 'both') {
      const claudeResult = await researchWithClaude(tdName, constituency, party);
      
      if (!crossCheck) {
        return claudeResult;
      }
      
      // Cross-check with GPT-4
      const gpt4Result = await researchWithGPT4(tdName, constituency, party);
      
      // Compare results
      const diff = Math.abs(claudeResult.baseline_modifier - gpt4Result.baseline_modifier);
      
      if (diff > 0.15) {
        console.warn(`⚠️ Large discrepancy between Claude (${claudeResult.baseline_modifier}) and GPT-4 (${gpt4Result.baseline_modifier})`);
        console.warn(`   Flagging for manual review`);
        
        // Average the two but mark for review
        return {
          ...claudeResult,
          baseline_modifier: (claudeResult.baseline_modifier + gpt4Result.baseline_modifier) / 2,
          confidence: Math.min(claudeResult.confidence, gpt4Result.confidence) * 0.8,
          reasoning: `CROSS-CHECK DISCREPANCY - Claude: ${claudeResult.baseline_modifier}, GPT-4: ${gpt4Result.baseline_modifier}\n\nClaude reasoning: ${claudeResult.reasoning}\n\nGPT-4 reasoning: ${gpt4Result.reasoning}`
        };
      }
      
      // Results agree - higher confidence
      return {
        ...claudeResult,
        confidence: Math.min(1.0, (claudeResult.confidence + gpt4Result.confidence) / 2 + 0.1)
      };
    }
    
    if (useProvider === 'gpt4') {
      return await researchWithGPT4(tdName, constituency, party);
    }
    
    throw new Error('Invalid provider specified');
    
  } catch (error: any) {
    console.error(`❌ Error researching ${tdName}:`, error.message);
    
    // Return neutral baseline on error
    return {
      politician_name: tdName,
      baseline_modifier: 1.00,
      baseline_score_0_100: 50,
      confidence: 0.0,
      category: 'neutral',
      historical_summary: 'Error during research - defaulting to neutral baseline',
      key_findings: [],
      reasoning: `Research failed: ${error.message}. Defaulting to neutral baseline (1.00) to be safe.`,
      controversies_noted: [],
      data_quality: {
        sources_found: 0,
        primary_sources: 0,
        confidence_factors: 'Research error',
        research_date: new Date().toISOString().split('T')[0]
      }
    };
  }
}

/**
 * Research using Claude
 */
async function researchWithClaude(
  tdName: string,
  constituency: string,
  party: string
): Promise<HistoricalBaseline> {
  
  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: BASELINE_SCORING_PROMPT(tdName, constituency, party)
    }]
  });
  
  const responseText = message.content[0].type === 'text' 
    ? message.content[0].text 
    : '';
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in Claude response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  console.log(`   Claude baseline: ${result.baseline_modifier}x (${result.category})`);
  
  return result;
}

/**
 * Research using GPT-4
 */
async function researchWithGPT4(
  tdName: string,
  constituency: string,
  party: string
): Promise<HistoricalBaseline> {
  
  const completion = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{
      role: 'user',
      content: BASELINE_SCORING_PROMPT(tdName, constituency, party)
    }],
    temperature: 0.3,
    max_tokens: 4000
  });
  
  const responseText = completion.choices[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in GPT-4 response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  console.log(`   GPT-4 baseline: ${result.baseline_modifier}x (${result.category})`);
  
  return result;
}

// ============================================
// BATCH PROCESSING
// ============================================

/**
 * Research baselines for all TDs in the database
 */
export async function researchAllTDBaselines(options: {
  limit?: number;
  crossCheck?: boolean;
  onProgress?: (current: number, total: number, tdName: string) => void;
} = {}): Promise<HistoricalBaseline[]> {
  
  console.log('🔍 Researching historical baselines for all TDs...\n');
  
  // Get all TDs from database or Oireachtas API
  const { OireachtasAPIService } = await import('./oireachtasAPIService');
  const members = await OireachtasAPIService.getCurrentDailMembers();
  
  const tdsToResearch = options.limit 
    ? members.slice(0, options.limit)
    : members;
  
  console.log(`📊 Researching ${tdsToResearch.length} TDs...\n`);
  
  const results: HistoricalBaseline[] = [];
  
  for (let i = 0; i < tdsToResearch.length; i++) {
    const td = tdsToResearch[i];
    
    try {
      console.log(`\n[${i + 1}/${tdsToResearch.length}] ${td.fullName}`);
      
      const baseline = await researchTDBaseline(
        td.fullName,
        td.constituency || 'Unknown',
        td.party || 'Unknown',
        { crossCheck: options.crossCheck }
      );
      
      results.push(baseline);
      
      // Save to database
      await saveBaselineToDatabase(baseline);
      
      // Progress callback
      if (options.onProgress) {
        options.onProgress(i + 1, tdsToResearch.length, td.fullName);
      }
      
      // Rate limiting - be respectful to AI APIs
      await sleep(3000); // 3 seconds between requests
      
    } catch (error: any) {
      console.error(`❌ Error processing ${td.fullName}:`, error.message);
      results.push({
        politician_name: td.fullName,
        baseline_modifier: 1.00,
        baseline_score_0_100: 50,
        confidence: 0.0,
        category: 'neutral',
        historical_summary: `Error: ${error.message}`,
        key_findings: [],
        reasoning: 'Research failed - defaulting to neutral',
        controversies_noted: [],
        data_quality: {
          sources_found: 0,
          primary_sources: 0,
          confidence_factors: 'Error',
          research_date: new Date().toISOString().split('T')[0]
        }
      });
    }
  }
  
  console.log(`\n✅ Researched ${results.length} TDs`);
  console.log(`   Average modifier: ${(results.reduce((sum, r) => sum + r.baseline_modifier, 0) / results.length).toFixed(3)}`);
  console.log(`   Range: ${Math.min(...results.map(r => r.baseline_modifier))} - ${Math.max(...results.map(r => r.baseline_modifier))}`);
  
  return results;
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

/**
 * Save baseline to database
 */
async function saveBaselineToDatabase(baseline: HistoricalBaseline): Promise<void> {
  if (!supabaseDb) {
    console.warn('⚠️ Supabase not connected - cannot save baseline');
    return;
  }
  
  try {
    const { error } = await supabaseDb
      .from('td_historical_baselines')
      .upsert({
        politician_name: baseline.politician_name,
        baseline_modifier: baseline.baseline_modifier,
        baseline_score_0_100: baseline.baseline_score_0_100,
        confidence: baseline.confidence,
        category: baseline.category,
        historical_summary: baseline.historical_summary,
        key_findings: JSON.stringify(baseline.key_findings),
        reasoning: baseline.reasoning,
        controversies_noted: JSON.stringify(baseline.controversies_noted),
        data_quality: JSON.stringify(baseline.data_quality),
        research_date: baseline.data_quality.research_date,
        analyzed_by: 'claude',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'politician_name'
      });
    
    if (error) {
      console.error(`   ❌ Database save error: ${error.message}`);
    } else {
      console.log(`   ✅ Baseline saved to database`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error saving to database: ${error.message}`);
  }
}

/**
 * Get baseline from database
 */
export async function getStoredBaseline(tdName: string): Promise<HistoricalBaseline | null> {
  if (!supabaseDb) return null;
  
  try {
    const { data, error } = await supabaseDb
      .from('td_historical_baselines')
      .select('*')
      .eq('politician_name', tdName)
      .single();
    
    if (error || !data) return null;
    
    return {
      politician_name: data.politician_name,
      baseline_modifier: data.baseline_modifier,
      baseline_score_0_100: data.baseline_score_0_100,
      confidence: data.confidence,
      category: data.category,
      historical_summary: data.historical_summary,
      key_findings: JSON.parse(data.key_findings || '[]'),
      reasoning: data.reasoning,
      controversies_noted: JSON.parse(data.controversies_noted || '[]'),
      data_quality: JSON.parse(data.data_quality || '{}')
    };
  } catch (error) {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export service object
export const HistoricalBaselineService = {
  researchTDBaseline,
  researchAllTDBaselines,
  getStoredBaseline
};

