import OpenAI from 'openai';
import { supabaseDb } from '../db';
import { normalisePolicyTopic } from '../constants/policyTopics';
import type { ArticleForOpportunity } from './policyOpportunityService';
import { TDIdeologyProfileService } from './tdIdeologyProfileService';

type StanceValue = 'support' | 'oppose' | 'neutral' | 'unclear';

interface ExtractedStance {
  name: string;
  entity_type: 'td' | 'party' | 'government' | 'organisation';
  stance: StanceValue;
  strength?: number;
  evidence?: string;
  ideology_delta?: Record<string, number>;
  ideology_confidence?: number;
}

interface DebateSnippet {
  speaker: string;
  party?: string | null;
  chamber?: string | null;
  date?: string | null;
  text: string;
  source?: string;
}

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. Skipping stance harvesting.');
    return null;
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const ARTICLE_STANCE_PROMPT = ({
  articleTitle,
  articleContent,
  policyTopic,
}: {
  articleTitle: string;
  articleContent: string;
  policyTopic: string;
}) => `
You are extracting Irish political stances from a news article to help voters understand where TDs and parties stand.

Article Title: ${articleTitle}
Policy Topic: ${policyTopic}
Content:
${articleContent.slice(0, 4000)}

Tasks:
1. Identify any TDs, Ministers, parties, or Government factions whose stance on the policy topic is implied or stated.
2. For each, determine whether they SUPPORT, OPPOSE, or remain NEUTRAL/UNCLEAR about taking MORE GOVERNMENT ACTION versus maintaining the current approach.
3. Rate stance strength 1-5 (5 = very strong/explicit stance).
4. Provide a short evidence quote or paraphrased sentence from the content.
5. Estimate how this stance shifts the subject's ideology along the following axes (scale -2 to +2, where negative = left/progressive/global integration and positive = right/conservative/national preservation):
   - economic (market vs collective)
   - social (traditional vs progressive)
   - cultural (nationalism vs multiculturalism)
   - authority (authoritarian vs libertarian)
   - environmental (pro-business vs pro-climate)
   - welfare (increase welfare vs decrease welfare)
   - globalism (global integration vs national preservation)
   - technocratic (expert-led vs populist)
   Value 0 means no shift detected.

Return strict JSON:
{
  "stances": [
    {
      "name": "Mary Lou McDonald",
      "entity_type": "td|party|government|organisation",
      "stance": "support|oppose|neutral|unclear",
      "strength": 1-5,
      "evidence": "Short quote or summary",
      "ideology_delta": {
        "economic": -1.2,
        "social": -0.5,
        "cultural": -0.8,
        "authority": -0.2,
        "environmental": 0.0,
        "welfare": -1.5,
        "globalism": -0.7,
        "technocratic": 0.3
      },
      "ideology_confidence": 0.7
    }
  ]
}

Rules:
- If no stances are clear, return an empty array.
- focus on the given policy topic (ignore unrelated issues).
- For Government position, use name "Government" with entity_type "government".
`.trim();

const DEBATE_PROMPT = ({
  snippets,
  policyTopic,
}: {
  snippets: DebateSnippet[];
  policyTopic: string;
}) => `
You are reviewing excerpts from recent Oireachtas debates to capture policy stances.

Policy Topic: ${policyTopic}

Debate Snippets:
${snippets
  .map(
    (snippet, index) => `
[${index + 1}]
Speaker: ${snippet.speaker}${snippet.party ? ` (${snippet.party})` : ''}
Date: ${snippet.date ?? 'unknown'}
Source: ${snippet.source ?? 'unknown'}
Excerpt:
${snippet.text.slice(0, 600)}
`.trim(),
  )
  .join('\n\n')}

Return JSON:
{
  "stances": [
    {
      "name": "Heather Humphreys",
      "entity_type": "td|party|government|organisation",
      "stance": "support|oppose|neutral|unclear",
      "strength": 1-5,
      "evidence": "Quote from snippet",
      "ideology_delta": {
        "economic": 0.0,
        "social": 0.5,
        "cultural": 0.2,
        "authority": 0.4,
        "environmental": -0.3,
        "welfare": 0.0,
        "globalism": 0.1,
        "technocratic": 0.2
      },
      "ideology_confidence": 0.6
    }
  ]
}

Rules:
- Restrict to the policy topic.
- Treat Government ministers speaking on behalf of Government as entity_type "government".
- If stance unclear, mark as "unclear" with strength 1-2.
- Evidence must reference the snippet.
`.trim();

async function callLLMForStances(
  title: string,
  content: string,
  policyTopic: string,
): Promise<ExtractedStance[]> {
  const client = getOpenAIClient();
  if (!client) return [];

  try {
    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      input: [
        {
          role: 'system',
          content: 'You extract factual Irish political policy stances for voter guidance.',
        },
        {
          role: 'user',
          content: ARTICLE_STANCE_PROMPT({
            articleTitle: title,
            articleContent: content,
            policyTopic,
          }),
        },
      ],
    });

    const text = response.output_text;
    if (!text) return [];

    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.stances) ? parsed.stances : [];
  } catch (error: any) {
    console.error('❌ Policy stance LLM error:', error.message || error);
    return [];
  }
}

async function callLLMForDebateStances(
  snippets: DebateSnippet[],
  policyTopic: string,
): Promise<ExtractedStance[]> {
  if (!snippets.length) return [];
  const client = getOpenAIClient();
  if (!client) return [];

  try {
    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      input: [
        {
          role: 'system',
          content:
            'You extract clear positions from the Irish Oireachtas debates to keep voters informed.',
        },
        {
          role: 'user',
          content: DEBATE_PROMPT({ snippets, policyTopic }),
        },
      ],
    });
    const text = response.output_text;
    if (!text) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.stances) ? parsed.stances : [];
  } catch (error: any) {
    console.error('❌ Debate stance LLM error:', error.message || error);
    return [];
  }
}

async function upsertStances(
  articleId: number | null,
  policyTopic: string,
  stances: ExtractedStance[],
  sourceHint?: string | null,
) {
  if (!supabaseDb || !stances.length) return;

  const nowIso = new Date().toISOString();

  for (const stance of stances) {
    if (!stance?.name || !stance.stance) continue;

    const label =
      stance.entity_type && stance.entity_type !== 'td'
        ? `${stance.name} (${stance.entity_type})`
        : stance.name;

    try {
      await supabaseDb
        .from('td_policy_stances')
        .upsert(
          {
            article_id: articleId,
            politician_name: label,
            stance: stance.stance,
            stance_strength: stance.strength ?? null,
            evidence: stance.evidence ?? sourceHint ?? null,
            policy_topic: policyTopic,
            policy_dimension: null,
            created_at: nowIso,
          },
          { onConflict: 'article_id,politician_name,policy_topic' },
        );
    } catch (error: any) {
      console.error('❌ Failed to upsert policy stance:', error.message);
    }
  }
}

function ideologyWeightFromStance(stance: ExtractedStance): number {
  const strength = Number(stance.strength ?? 0);
  if (!Number.isFinite(strength) || strength <= 0) {
    return 0.5;
  }
  return Math.max(0.25, Math.min(2, strength / 2));
}

async function applyIdeologyAdjustments(
  stances: ExtractedStance[],
  metadata: AdjustmentMetadataParams,
): Promise<void> {
  for (const stance of stances) {
    if (stance.entity_type !== 'td') continue;
    if (!stance.ideology_delta) continue;

    const weight = ideologyWeightFromStance(stance);
    const confidence =
      Number.isFinite(Number(stance.ideology_confidence))
        ? Number(stance.ideology_confidence)
        : 0.7;

    await TDIdeologyProfileService.applyAdjustments(stance.name, stance.ideology_delta, {
      sourceType: metadata.sourceType,
      sourceId: metadata.sourceId,
      policyTopic: metadata.policyTopic,
      weight,
      confidence,
    });
  }
}

interface AdjustmentMetadataParams {
  sourceType: 'article' | 'debate';
  sourceId?: number | null;
  policyTopic: string;
}

async function fetchRecentDebateSnippets(topic: string): Promise<DebateSnippet[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const params = new URLSearchParams({
      search: topic.replace(/_/g, ' '),
      date_start: start.toISOString().split('T')[0],
      date_end: end.toISOString().split('T')[0],
      chamber_type: 'dail',
      limit: '25',
      start: '0',
    });

    const response = await fetch(`https://api.oireachtas.ie/v1/debates?${params.toString()}`, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(
        `⚠️ Oireachtas API returned ${response.status} for topic ${topic}: ${await response.text()}`,
      );
      return [];
    }

    const data = await response.json();
    const records = data?.results ?? [];
    return records
      .map((result: any) => {
        const debate = result?.debate ?? {};
        const speech = debate?.speech ?? {};
        const member = speech?.by ?? {};
        return {
          speaker: member?.fullName ?? speech?.byName ?? 'Unknown',
          party: member?.party?.as?.name,
          chamber: debate?.house ?? null,
          date: debate?.date ?? null,
          text: speech?.speechText ?? '',
          source: debate?.uri ?? null,
        } as DebateSnippet;
      })
      .filter((snippet: DebateSnippet) => snippet.text && snippet.text.length > 120)
      .slice(0, 10);
  } catch (error: any) {
    console.error('⚠️ Failed to fetch debate snippets:', error.message || error);
    return [];
  }
}

export const PolicyStanceHarvester = {
  async extractFromArticle(articleId: number, article: ArticleForOpportunity, policyTopic: string) {
    const stances = await callLLMForStances(article.title, article.content, policyTopic);
    if (!stances.length) return;
    await upsertStances(articleId, policyTopic, stances, article.source);
    await applyIdeologyAdjustments(stances, {
      sourceType: 'article',
      sourceId: articleId,
      policyTopic,
    });
  },

  async harvestRecentDebates(policyTopic: string) {
    const topic = normalisePolicyTopic(policyTopic);
    const snippets = await fetchRecentDebateSnippets(topic);
    if (!snippets.length) return;
    const stances = await callLLMForDebateStances(snippets, topic);
    if (!stances.length) return;
    await upsertStances(null, topic, stances, 'Oireachtas debates');
    await applyIdeologyAdjustments(stances, {
      sourceType: 'debate',
      sourceId: null,
      policyTopic: topic,
    });
  },
};

