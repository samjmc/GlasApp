/**
 * News Scraper Admin Routes
 * Endpoints for managing and testing the news scraping system
 */

import { Router } from 'express';
import { DailyNewsScraperJob } from '../../jobs/dailyNewsScraper';
import { NewsScraperService } from '../../services/newsScraperService';
import { TDExtractionService } from '../../services/tdExtractionService';
import { AINewsAnalysisService } from '../../services/aiNewsAnalysisService';
import { supabaseDb } from '../../db';

const router = Router();

/**
 * POST /api/admin/news-scraper/test - Test news scraping with one source
 */
router.post('/test', async (req, res, next) => {
  try {
    console.log('🧪 Testing news scraper...');
    
    // Fetch from one source only (The Journal - reliable and fast)
    const testArticles = await NewsScraperService.fetchRSSFeed(
      'https://www.thejournal.ie/feed/',
      'The Journal',
      0.90
    );
    
    console.log(`📰 Found ${testArticles.length} articles`);
    
    // Filter for political content
    const politicalArticles = await NewsScraperService.filterPoliticalArticles(testArticles);
    console.log(`🔍 ${politicalArticles.length} political articles`);
    
    // Extract TD mentions from first political article
    if (politicalArticles.length > 0) {
      const firstArticle = politicalArticles[0];
      const tdMentions = await TDExtractionService.extractTDMentions(
        firstArticle.title + ' ' + firstArticle.content
      );
      
      console.log(`👤 Found ${tdMentions.length} TD mentions`);
      
      res.json({
        success: true,
        test_results: {
          total_articles: testArticles.length,
          political_articles: politicalArticles.length,
          td_mentions: tdMentions.length,
          sample_article: {
            title: firstArticle.title,
            source: firstArticle.source,
            published: firstArticle.published_date,
            tds_mentioned: tdMentions.map(m => m.name)
          }
        },
        message: 'News scraper test successful!'
      });
    } else {
      res.json({
        success: true,
        test_results: {
          total_articles: testArticles.length,
          political_articles: 0,
          message: 'No political articles found in this batch'
        }
      });
    }
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/news-scraper/analyze-sample - Test AI analysis on one article
 */
router.post('/analyze-sample', async (req, res, next) => {
  try {
    const { articleUrl, tdName } = req.body;
    
    if (!articleUrl || !tdName) {
      return res.status(400).json({
        success: false,
        message: 'articleUrl and tdName required'
      });
    }
    
    console.log(`🧪 Testing AI analysis for ${tdName}...`);
    
    // Scrape article content
    const content = await NewsScraperService.scrapeArticleContent(articleUrl);
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Failed to scrape article content'
      });
    }
    
    // Create article object
    const article = {
      title: 'Test Article',
      url: articleUrl,
      content,
      published_date: new Date(),
      source: 'Manual Test',
      credibility: 0.9
    };
    
    // Analyze with AI
    const analysis = await AINewsAnalysisService.analyzeArticle(
      article,
      { name: tdName, constituency: 'Unknown', party: 'Unknown' },
      { crossCheck: false } // Disable cross-check for testing
    );
    
    res.json({
      success: true,
      analysis: {
        story_type: analysis.story_type,
        sentiment: analysis.sentiment,
        impact_score: analysis.impact_score,
        dimensions: {
          transparency: analysis.transparency_impact,
          effectiveness: analysis.effectiveness_impact,
          integrity: analysis.integrity_impact,
          consistency: analysis.consistency_impact,
          constituency_service: analysis.constituency_service_impact
        },
        summary: analysis.summary,
        reasoning: analysis.reasoning,
        key_quotes: analysis.key_quotes,
        credibility: analysis.credibility_check
      }
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/news-scraper/run - Trigger full news scrape
 */
router.post('/run', async (req, res, next) => {
  try {
    const { limit } = req.body;
    
    console.log('🚀 Triggering full news scrape...');
    
    // Run in background
    setTimeout(async () => {
      try {
        await DailyNewsScraperJob.run();
        console.log('✅ News scrape completed');
      } catch (error) {
        console.error('❌ News scrape failed:', error);
      }
    }, 100);
    
    res.json({
      success: true,
      message: 'News scraping job started in background',
      estimated_duration: '30-60 minutes',
      note: 'Check server logs for progress'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/news-scraper/stats - Get scraping statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Get article count
    const { count: articleCount } = await supabaseDb
      .from('news_articles')
      .select('*', { count: 'exact', head: true });
    
    // Get TD score count
    const { count: tdCount } = await supabaseDb
      .from('td_scores')
      .select('*', { count: 'exact', head: true });
    
    // Get recent articles
    const { data: recentArticles } = await supabaseDb
      .from('news_articles')
      .select('title, source, politician_name, published_date, impact_score')
      .order('published_date', { ascending: false })
      .limit(10);
    
    res.json({
      success: true,
      stats: {
        total_articles: articleCount || 0,
        tds_with_scores: tdCount || 0,
        sources_active: NewsScraperService.IRISH_NEWS_SOURCES?.length || 6,
        recent_articles: recentArticles || []
      }
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;

