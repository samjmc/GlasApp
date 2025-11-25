import OpenAI from 'openai';
import NodeCache from 'node-cache';
import { normalisePolicyTopic, type PolicyDomain } from '../constants/policyTopics';

const cache = new NodeCache({
  stdTTL: 60 * 60, // 1 hour
  maxKeys: 5000,
});

let openai: OpenAI | null = null;

interface TopicClassificationResult {
  isPolitical: boolean;
  relevance: number;
  domain?: PolicyDomain | 'other';
  topic?: string;
  confidence: number;
  reasoning?: string;
}

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. Topic classifier disabled.');
    return null;
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const CLASSIFIER_PROMPT = ({
  title,
  snippet,
  source,
}: {
  title: string;
  snippet: string;
  source: string;
}) => `
Classify this Irish news article for political relevance.

Title: ${title}
Source: ${source}
Summary:
${snippet}

Decide if this article is about Irish politics, government policy, or issues that voters could answer in a policy vote (Gaza aid, housing, climate, public spending, immigration, healthcare, etc). Include stories about Irish decisions abroad.

Return JSON:
{
  "is_political": true|false,
  "relevance": 0-1,  // heuristic strength of link to politics/policy
  "confidence": 0-1,
  "policy_domain": "foreign_policy|humanitarian_aid|housing|health|economy|taxation|climate|immigration|justice|education|infrastructure|agriculture|technology|other",
  "policy_topic": "slug",
  "reasoning": "short explanation"
}

Rules:
- Treat government ministers, departments, budgets, TDs, parties, referenda, international aid, climate targets, public services, justice, migration, or EU/UN positions involving Ireland as political.
- If relevance < 0.25 or confidence < 0.5, set is_political=false.
- Policy topic should be short snake_case (e.g. foreign_aid, housing_supply, climate_targets).
`.trim();

function buildCacheKey(title: string, content: string): string {
  return `${title}|${content}`.toLowerCase();
}

export interface ArticleForClassification {
  title: string;
  content: string;
  source: string;
}

export const TopicClassificationService = {
  async classifyArticle(article: ArticleForClassification): Promise<TopicClassificationResult | null> {
    const key = buildCacheKey(article.title, article.content.slice(0, 500));
    const cached = cache.get<TopicClassificationResult>(key);
    if (cached) return cached;

    const client = getOpenAIClient();
    if (!client) return null;

    try {
      const response = await client.responses.create({
        model: 'gpt-4.1-mini',
        temperature: 0,
        input: [
          {
            role: 'system',
            content: 'You are a precise political classifier for Irish news articles.',
          },
          {
            role: 'user',
            content: CLASSIFIER_PROMPT({
              title: article.title,
              snippet: article.content.slice(0, 1500),
              source: article.source,
            }),
          },
        ],
      });

      const text = response.output_text;
      if (!text) return null;

      const parsed = JSON.parse(text);
      const result: TopicClassificationResult = {
        isPolitical: Boolean(parsed.is_political),
        relevance: typeof parsed.relevance === 'number' ? parsed.relevance : 0,
        domain: parsed.policy_domain,
        topic: parsed.policy_topic ? normalisePolicyTopic(parsed.policy_topic) : undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        reasoning: parsed.reasoning,
      };

      cache.set(key, result);
      return result;
    } catch (error: any) {
      console.error('❌ Topic classification error:', error.message || error);
      return null;
    }
  },

  getCache(): NodeCache {
    return cache;
  },
};



