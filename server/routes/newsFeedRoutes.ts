import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabaseDb } from '../db';
import { getCachedOrFetch, CACHE_TTL } from '../utils/serverCache';
import {
  DEFAULT_REGION_CODE,
  REGION_NEWS_MOCK,
  type RegionCode,
} from '@shared/region-config';

const router = Router();

// GET /api/news-feed - Get all news articles with optional sorting
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('📰 News feed request received');
    const { limit = 20, offset = 0, sort = 'recent' } = req.query;
    const regionCode: RegionCode = req.regionCode || DEFAULT_REGION_CODE;

    const mockResponse = REGION_NEWS_MOCK[regionCode];
    if (mockResponse) {
      console.log(`📡 Serving mock news feed for region ${regionCode}`);
      return res.json({
        ...mockResponse,
        last_updated: new Date().toISOString(),
        regionCode,
      });
    }
    
    // Fetch from Supabase database
    if (supabaseDb) {
      try {
        console.log('🔍 Fetching from Supabase...');
        
        let articles: any[] = [];
        let count = 0;
        let error = null;
        
        // Highest Impact sorting - get ALL articles with TD impact OR policy opportunities
        if (sort === 'score' || sort === 'highest') {
          console.log('🎯 Finding highest impact articles (with TD effects or policy votes)...');
          
          // Get articles with either TD scores or policy vote opportunities
          // Only show visible articles (passed triage)
          const { data: allArticles, error: allError } = await supabaseDb
            .from('news_articles')
            .select(`
              *,
              article_td_scores(impact_score),
              policy_vote_opportunities(id, question_text, answer_options, policy_domain, policy_topic, confidence, rationale, source_hint),
              news_sources!inner(logo_url)
            `)
            .eq('visible', true)  // Only show visible articles
            .order('published_date', { ascending: false })
            .limit(200); // Get recent 200 articles to calculate impact
          
          if (allError) {
            console.error('Error fetching articles:', allError);
            articles = [];
            error = allError;
          } else {
            // Calculate total TD impact for each article (sum of all affected TDs' impact scores)
            const articlesWithTotalImpact = (allArticles || []).map((article: any) => {
              const tdScores = article.article_td_scores || [];
              const policyVotes = article.policy_vote_opportunities || [];
              const totalTDImpact = tdScores.reduce(
                (sum: number, td: any) => sum + Math.abs(Number(td.impact_score) || 0),
                0
              );
              const hasPolicyOpportunity = policyVotes.length > 0;
              return {
                ...article,
                totalTDImpact,
                policyVotes,
                policyVoteOpportunity: policyVotes[0] || null,
                hasPolicyOpportunity,
                hasAnyImpact: totalTDImpact > 0 || hasPolicyOpportunity
              };
            });
            
            // Filter for articles with impact, then sort by recency (most recent first)
            // Include articles that have TD effects OR policy voting opportunities
            articles = articlesWithTotalImpact
              .filter((a: any) => a.hasAnyImpact)
              .sort((a: any, b: any) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
              .slice(0, Number(limit));
            
            count = articles.length;
            console.log(`✨ Found ${count} high-impact articles (sorted by recency). ${articles.filter((a: any) => a.totalTDImpact > 0).length} with TD effects, ${articles.filter((a: any) => a.hasPolicyOpportunity).length} with policy opportunities.`);
          }
        } else if (sort === 'today') {
          // TODAY'S (or most recent) Biggest Impact
          console.log('🎯 Finding biggest impact article from recent articles...');
          
          // Try today first
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startOfDay = today.toISOString();
          
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);
          const endOfDayISO = endOfDay.toISOString();
          
          // Get articles from today with TD scores OR policy vote opportunities
          // Only show visible articles (passed triage)
          const { data: todayArticles } = await supabaseDb
            .from('news_articles')
            .select(`
              *,
              article_td_scores(impact_score),
              policy_vote_opportunities(id, question_text, answer_options, policy_domain, policy_topic, confidence, rationale, source_hint),
              news_sources!inner(logo_url)
            `)
            .eq('visible', true)  // Only show visible articles
            .gte('published_date', startOfDay)
            .lte('published_date', endOfDayISO);
          
          let candidateArticles = todayArticles || [];
          let dateRange = 'today';
          
          // If no articles from today, get the most recent articles (last 7 days)
          if (candidateArticles.length === 0) {
            console.log('📅 No articles from today, checking last 7 days...');
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const { data: recentArticles } = await supabaseDb
              .from('news_articles')
              .select(`
                *,
                article_td_scores(impact_score),
                policy_vote_opportunities(id, question_text, answer_options, policy_domain, policy_topic, confidence, rationale, source_hint),
                news_sources!inner(logo_url)
              `)
              .eq('visible', true)  // Only show visible articles
              .gte('published_date', sevenDaysAgo.toISOString())
              .order('published_date', { ascending: false })
              .limit(50); // Get recent 50 to find the best one
            
            candidateArticles = recentArticles || [];
            dateRange = 'last 7 days';
          }
          
          // Calculate total TD impact for each article
          const articlesWithTotalImpact = candidateArticles.map((article: any) => {
            const tdScores = article.article_td_scores || [];
            const policyVotes = article.policy_vote_opportunities || [];
            const totalTDImpact = tdScores.reduce(
              (sum: number, td: any) => sum + Math.abs(Number(td.impact_score) || 0),
              0
            );
            const hasPolicyOpportunity = policyVotes.length > 0;
            return {
              ...article,
              totalTDImpact,
              policyVotes,
              policyVoteOpportunity: policyVotes[0] || null,
              hasPolicyOpportunity,
              hasAnyImpact: totalTDImpact > 0 || hasPolicyOpportunity
            };
          });
          
          // Sort by total TD impact and take top article(s)
          articles = articlesWithTotalImpact
            .filter((a: any) => a.hasAnyImpact)
            .sort((a: any, b: any) => b.totalTDImpact - a.totalTDImpact)
            .slice(0, Number(limit));
          
          count = articles.length;
          console.log(`✨ Found ${count} impactful articles from ${dateRange}. Top impact: ${articles[0]?.totalTDImpact || 0}`);
        } else {
          // Regular sorting by date - join with news_sources to get logo_url
          // Only show visible articles (passed triage)
          let query = supabaseDb.from('news_articles').select(`
            *,
            policy_vote_opportunities(id, question_text, answer_options, policy_domain, policy_topic, confidence, rationale, source_hint),
            news_sources!inner(logo_url)
          `, { count: 'exact' });
          query = query.eq('visible', true);  // Only show visible articles
          query = query.order('published_date', { ascending: false });
          
          // Apply pagination
          query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
          
          const result = await query;
          articles = result.data || [];
          error = result.error;
          count = result.count || 0;
        }
        
        if (error) throw error;
        
        console.log(`✅ Fetched ${articles?.length || 0} articles from Supabase`);
        
        // Fetch all TD scores for these articles
        const articleIds = (articles || []).map((a: any) => a.id);
        const { data: allTDScores } = await supabaseDb
          .from('article_td_scores')
          .select('*')
          .in('article_id', articleIds);
        
        // Fetch all TD policy stances for these articles
        const { data: allTDStances } = await supabaseDb
          .from('td_policy_stances')
          .select('*')
          .in('article_id', articleIds);
        
        // Group TD scores by article
        const tdScoresByArticle = new Map();
        (allTDScores || []).forEach((score: any) => {
          if (!tdScoresByArticle.has(score.article_id)) {
            tdScoresByArticle.set(score.article_id, []);
          }
          tdScoresByArticle.get(score.article_id).push(score);
        });
        
        // Group TD stances by article + politician
        const tdStancesMap = new Map();
        (allTDStances || []).forEach((stance: any) => {
          const key = `${stance.article_id}_${stance.politician_name}`;
          tdStancesMap.set(key, stance);
        });
        
        // Transform database articles to match frontend expected structure
        const transformedArticles = (articles || []).map((article: any) => {
          const publishDate = article.published_date ? new Date(article.published_date).toISOString() : new Date().toISOString();
          
          // Use actual image_url from database (AI-generated or RSS image)
          const imageUrl = article.image_url || '/news-images/article_0_5748.png'; // Fallback to placeholder if missing
          
          // Extract logo_url from news_sources relation
          const sourceLogoUrl = article.news_sources?.logo_url || null;
          const policyVoteRaw = Array.isArray(article.policy_vote_opportunities)
            ? article.policy_vote_opportunities[0]
            : article.policy_vote_opportunities || article.policyVoteOpportunity;
          const policyVote = policyVoteRaw
            ? {
                id: policyVoteRaw.id,
                question: policyVoteRaw.question_text,
                options: policyVoteRaw.answer_options,
                domain: policyVoteRaw.policy_domain,
                topic: policyVoteRaw.policy_topic,
                confidence: policyVoteRaw.confidence,
                rationale: policyVoteRaw.rationale,
                sourceHint: policyVoteRaw.source_hint,
              }
            : null;
          
          return {
            id: article.id,
            title: article.title,
            source: article.source,
            sourceLogoUrl: sourceLogoUrl,
            publishedDate: publishDate,
            imageUrl: imageUrl,
            aiSummary: article.ai_summary || article.content?.substring(0, 500) || 'No summary available',
            url: article.url,
            politicianName: article.politician_name,
            constituency: article.constituency,
            party: article.party,
            impactScore: Number(article.impact_score) || 0,
            storyType: article.story_type || 'neutral',
            sentiment: article.sentiment || 'neutral',
            aiReasoning: article.ai_reasoning,
            transparencyScore: article.transparency_score,
            integrityScore: article.integrity_score,
            effectivenessScore: article.effectiveness_score,
            consistencyScore: article.consistency_score,
            transparencyReasoning: article.transparency_reasoning,
            integrityReasoning: article.integrity_reasoning,
            effectivenessReasoning: article.effectiveness_reasoning,
            consistencyReasoning: article.consistency_reasoning,
            isIdeologicalPolicy: article.is_ideological_policy,
            policyDirection: article.policy_direction,
            // Parse JSONB fields (Supabase returns them as objects already)
            policyFacts: typeof article.policy_facts === 'string' 
              ? JSON.parse(article.policy_facts) 
              : article.policy_facts,
            perspectives: typeof article.perspectives === 'string'
              ? JSON.parse(article.perspectives)
              : article.perspectives,
            isOppositionAdvocacy: article.is_opposition_advocacy,
            hasPolicyOpportunity: !!policyVote,
            policyVote,
            
            // Multiple TDs affected by this article
            affectedTDs: (tdScoresByArticle.get(article.id) || []).map((tdScore: any) => {
              // Get TD's policy stance from pre-fetched map (much faster!)
              const stanceKey = `${article.id}_${tdScore.politician_name}`;
              const stanceData = tdStancesMap.get(stanceKey);
              
              return {
                name: tdScore.politician_name,
                impactScore: Number(tdScore.impact_score) || 0,
                transparencyScore: tdScore.transparency_score,
                integrityScore: tdScore.integrity_score,
                effectivenessScore: tdScore.effectiveness_score,
                consistencyScore: tdScore.consistency_score,
                transparencyReasoning: tdScore.transparency_reasoning,
                integrityReasoning: tdScore.integrity_reasoning,
                effectivenessReasoning: tdScore.effectiveness_reasoning,
                consistencyReasoning: tdScore.consistency_reasoning,
                aiReasoning: tdScore.ai_reasoning,
                isOppositionAdvocacy: tdScore.is_opposition_advocacy,
                flipFlopDetected: tdScore.flip_flop_detected,
                flipFlopExplanation: tdScore.flip_flop_explanation,
                suspiciousTiming: tdScore.suspicious_timing,
                needsReview: tdScore.needs_review,
                eloChange: tdScore.elo_change,
                storyType: tdScore.story_type,
                sentiment: tdScore.sentiment,
                // Policy stance data
                tdStance: stanceData?.stance,
                tdStanceStrength: stanceData?.stance_strength,
                tdStanceEvidence: stanceData?.evidence
              };
            }),
            
            likes: 0,
            commentCount: 0,
            comments: []
          };
        });
        
        return res.json({
          success: true,
          articles: transformedArticles,
          total: count || 0,
          has_more: (Number(offset) + (articles?.length || 0)) < (count || 0),
          last_updated: new Date().toISOString(),
          source: 'Supabase Database',
          sort: sort,
          regionCode,
        });
        
      } catch (dbError: any) {
        console.error('Supabase fetch failed:', dbError.message);
        throw dbError;
      }
    }
    
    // Fallback if no database
    res.json({
      success: true,
      articles: [],
      total: 0,
      has_more: false,
      last_updated: new Date().toISOString(),
      source: 'No Database',
      message: 'Database not connected',
      regionCode,
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching news feed:', error);
    res.status(500).json({
      success: false,
      articles: [],
      total: 0,
      message: 'Failed to fetch news feed',
      error: error.message,
      regionCode: req.regionCode || DEFAULT_REGION_CODE,
    });
  }
});

// POST /api/news-feed/save - Save article from Python aggregator
router.post('/save', async (req: Request, res: Response) => {
  try {
    const article = req.body;
    console.log(`📰 Saving article: ${article.title?.substring(0, 60)}...`);
    
    if (!supabaseDb) {
      console.warn('⚠️  Supabase not connected - article not saved');
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Map Python aggregator fields to database schema
    const dbArticle = {
      url: article.url,
      title: article.title,
      content: article.content || article.aiSummary || article.summary || '',
      source: article.source,
      published_date: new Date(article.publishedDate || article.published_date).toISOString(),
      politician_name: article.politicianName || article.politician_name || null,
      constituency: article.constituency || null,
      party: article.party || null,
      story_type: article.storyType || article.story_type || 'neutral',
      sentiment: article.sentiment || 'neutral',
      impact_score: article.impactScore || article.impact_score || 0,
      ai_summary: article.aiSummary || article.ai_summary || article.summary || null,
      processed: false, // Will be processed by TD scoring
      score_applied: false,
      credibility_score: article.credibilityScore || 0.8
    };
    
    // Upsert using Supabase (insert or update based on unique URL)
    const { data: saved, error } = await supabaseDb
      .from('news_articles')
      .upsert(dbArticle, { onConflict: 'url' })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving to Supabase:', error);
      throw error;
    }
    
    console.log(`✅ Article saved to Supabase: ID ${saved.id}`);
    
    res.status(201).json({
      success: true,
      message: 'Article saved to database',
      article_id: saved.id
    });
    
  } catch (error: any) {
    console.error('Error saving article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save article',
      error: error.message
    });
  }
});

// GET /api/news-feed/td/:name - Get recent news articles for a specific TD
router.get('/td/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { limit = 3 } = req.query;
    
    if (!supabaseDb) {
      return res.json({
        success: true,
        articles: [],
        message: 'Database not connected'
      });
    }
    
    // Fetch articles mentioning this TD
    const { data: articles, error } = await supabaseDb
      .from('news_articles')
      .select('*')
      .ilike('politician_name', `%${name}%`)
      .order('published_date', { ascending: false })
      .limit(Number(limit));
    
    if (error) {
      console.error('Error fetching TD news:', error);
      return res.json({
        success: true,
        articles: []
      });
    }
    
    // Transform articles for frontend
    const transformedArticles = (articles || []).map((article: any) => ({
      id: article.id,
      title: article.title,
      source: article.source,
      published_date: article.published_date,
      url: article.url,
      ai_summary: article.ai_summary,
      sentiment: article.sentiment,
      story_type: article.story_type,
      impact_score: article.impact_score
    }));
    
    res.json({
      success: true,
      articles: transformedArticles,
      count: transformedArticles.length
    });
    
  } catch (error: any) {
    console.error('Error in TD news endpoint:', error);
    res.json({
      success: true,
      articles: []
    });
  }
});

export default router;

