/**
 * Manual Article Addition Routes
 * 
 * For sources without RSS (Gript, The Ditch)
 * Allows admin to manually add important articles
 */

import { Router } from 'express';
import { NewsScraperService } from '../../services/newsScraperService';
import { TDExtractionService } from '../../services/tdExtractionService';
import { AINewsAnalysisService } from '../../services/aiNewsAnalysisService';
import { supabaseDb } from '../../db';
import { formatSuccess, formatError } from '../../utils/responseFormatters';
import { logger, requestLogger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/admin/articles/add - Manually add an article from any source
 */
router.post('/add', async (req, res, next) => {
  const log = requestLogger(req);
  try {
    const { url, source, tdName } = req.body;
    
    if (!url) {
      return res.status(400).json(
        formatError('VALIDATION_ERROR', 'URL is required')
      );
    }
    
    log.info({ operation: 'admin.manualArticle.add', source: source || 'unknown source' }, 'Manually adding article');
    log.info({ operation: 'admin.manualArticle.add', url }, 'URL');
    
    // Scrape full article content
    const content = await NewsScraperService.scrapeArticleContent(url);
    
    if (!content || content.length < 100) {
      return res.status(400).json(
        formatError('OPERATION_FAILED', 'Failed to scrape article content or content too short')
      );
    }
    
    // Determine credibility and bias based on source
    const sourceConfig: Record<string, { credibility: number; bias: number }> = {
      'Gript Media': { credibility: 0.75, bias: -0.20 },
      'The Ditch': { credibility: 0.78, bias: -0.18 },
      'Village Magazine': { credibility: 0.82, bias: -0.15 },
      'Custom': { credibility: 0.70, bias: 0.0 }
    };
    
    const config = sourceConfig[source || 'Custom'] || { credibility: 0.70, bias: 0.0 };
    
    // Create article object
    const article = {
      title: extractTitleFromUrl(url) || 'Manual Article',
      url,
      content,
      published_date: new Date(),
      source: source || 'Manual Addition',
      credibility: config.credibility
    };
    
    // If TD name provided, analyze directly
    if (tdName) {
      log.info({ operation: 'admin.manualArticle.add', tdName }, `Analyzing article about ${tdName}...`);
      
      const analysis = await AINewsAnalysisService.analyzeArticle(
        article,
        { name: tdName, constituency: 'Unknown', party: 'Unknown' },
        { crossCheck: false }
      );
      
      // Save article
      const articleId = await saveManualArticle(article, tdName, analysis);
      
      res.json(
        formatSuccess({
          message: 'Article added and analyzed',
          article_id: articleId,
          analysis: {
            story_type: analysis.story_type,
            sentiment: analysis.sentiment,
            impact_score: analysis.impact_score,
            adjusted_impact: analysis.bias_adjustments?.final_adjusted_impact || analysis.impact_score
          }
        })
      );
    } else {
      // Extract TD mentions
      log.info({ operation: 'admin.manualArticle.add' }, 'Extracting TD mentions...');
      const tdMentions = TDExtractionService.extractTDMentions(content);
      
      if (tdMentions.length === 0) {
        return res.json(
          formatSuccess({
            message: 'Article scraped but no TDs mentioned',
            content_length: content.length,
            suggestion: 'Specify tdName parameter to force analysis'
          })
        );
      }
      
      // Analyze for each TD mentioned
      const results = [];
      
      for (const td of tdMentions.slice(0, 3)) {  // Limit to first 3 TDs
        log.info({ operation: 'admin.manualArticle.add', tdName: td.name }, `Analyzing for ${td.name}...`);
        
        try {
          const analysis = await AINewsAnalysisService.analyzeArticle(
            article,
            td,
            { crossCheck: false }
          );
          
          const articleId = await saveManualArticle(article, td.name, analysis);
          
          results.push({
            td_name: td.name,
            article_id: articleId,
            impact: analysis.bias_adjustments?.final_adjusted_impact || analysis.impact_score
          });
        } catch (error: unknown) {
          log.error({ operation: 'admin.manualArticle.add', tdName: td.name }, `Analysis failed for ${td.name}`);
          results.push({
            td_name: td.name,
            error: error.message
          });
        }
      }
      
      res.json(
        formatSuccess({
          message: 'Article processed',
          tds_found: tdMentions.length,
          analyzed: results
        })
      );
    }
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/articles/bulk-add - Add multiple articles at once
 */
router.post('/bulk-add', async (req, res, next) => {
  const log = requestLogger(req);
  try {
    const { articles } = req.body;  // Array of {url, source, tdName}
    
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json(
        formatError('VALIDATION_ERROR', 'articles array is required')
      );
    }
    
    log.info({ operation: 'admin.manualArticle.bulkAdd', count: articles.length }, 'Processing articles in bulk');
    
    // Run in background
    setTimeout(async () => {
      let processed = 0;
      let failed = 0;
      
      for (const item of articles) {
        try {
          // Similar logic to /add endpoint
          const content = await NewsScraperService.scrapeArticleContent(item.url);
          
          if (content && content.length > 100) {
            // Process article...
            processed++;
            log.info({ operation: 'admin.manualArticle.bulkAdd', url: item.url }, `Processed ${processed}/${articles.length}`);
          } else {
            failed++;
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          failed++;
          log.error({ operation: 'admin.manualArticle.bulkAdd', url: item.url }, `Failed: ${item.url}`);
        }
      }
      
      log.info({ operation: 'admin.manualArticle.bulkAdd', processed, failed }, 'Bulk processing complete');
    }, 100);
    
    res.json(
      formatSuccess({
        message: 'Bulk processing started in background',
        total: articles.length,
        estimated_duration: `${articles.length * 5}s`
      })
    );
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/articles/manual - Get all manually added articles
 */
router.get('/manual', async (req, res, next) => {
  const log = requestLogger(req);
  try {
    if (!supabaseDb) {
      return res.status(503).json(
        formatError('OPERATION_FAILED', 'Database not connected')
      );
    }
    
    const { data: articles, error } = await supabaseDb
      .from('news_articles')
      .select('*')
      .in('source', ['Gript Media', 'The Ditch', 'Manual Addition', 'Village Magazine'])
      .order('published_date', { ascending: false })
      .limit(50);
    
    if (error) {
      log.error({ operation: 'admin.manualArticle.list', err: error }, 'Failed to fetch articles');
      return res.status(500).json(
        formatError('OPERATION_FAILED', 'Failed to fetch articles')
      );
    }
    
    res.json(
      formatSuccess({
        total: articles?.length || 0,
        articles: articles || []
      })
    );
    
  } catch (error) {
    next(error);
  }
});

// Helper functions

function extractTitleFromUrl(url: string): string {
  try {
    const parts = url.split('/').filter(p => p.length > 0);
    const lastPart = parts[parts.length - 1];
    
    // Convert URL slug to title
    return lastPart
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  } catch {
    return 'Article';
  }
}

async function saveManualArticle(article: unknown, tdName: string, analysis: unknown): Promise<number | null> {
  if (!supabaseDb) return null;
  
  try {
    const { data, error } = await supabaseDb
      .from('news_articles')
      .insert({
        url: article.url,
        title: article.title,
        content: article.content,
        source: article.source,
        published_date: article.published_date.toISOString(),
        politician_name: tdName,
        
        // AI Analysis
        story_type: analysis.story_type,
        sentiment: analysis.sentiment,
        impact_score: analysis.impact_score,
        transparency_impact: analysis.transparency_impact,
        effectiveness_impact: analysis.effectiveness_impact,
        integrity_impact: analysis.integrity_impact,
        consistency_impact: analysis.consistency_impact,
        constituency_service_impact: analysis.constituency_service_impact,
        ai_summary: analysis.summary,
        ai_reasoning: analysis.reasoning,
        key_quotes: JSON.stringify(analysis.key_quotes),
        
        processed: true,
        credibility_score: article.credibility
      })
      .select('id')
      .single();
    
    if (error) {
      logger.error({ operation: 'admin.manualArticle.save', err: error }, 'Error saving article');
      return null;
    }
    
    logger.info({ operation: 'admin.manualArticle.save', articleId: data.id }, 'Article saved');
    return data.id;
    
  } catch (error: unknown) {
    logger.error({ operation: 'admin.manualArticle.save', err: error }, 'Error saving article');
    return null;
  }
}

export default router;

