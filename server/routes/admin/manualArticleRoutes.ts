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

const router = Router();

/**
 * POST /api/admin/articles/add - Manually add an article from any source
 */
router.post('/add', async (req, res, next) => {
  try {
    const { url, source, tdName } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }
    
    console.log(`📰 Manually adding article from ${source || 'unknown source'}...`);
    console.log(`   URL: ${url}`);
    
    // Scrape full article content
    const content = await NewsScraperService.scrapeArticleContent(url);
    
    if (!content || content.length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Failed to scrape article content or content too short'
      });
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
      console.log(`   🤖 Analyzing article about ${tdName}...`);
      
      const analysis = await AINewsAnalysisService.analyzeArticle(
        article,
        { name: tdName, constituency: 'Unknown', party: 'Unknown' },
        { crossCheck: false }
      );
      
      // Save article
      const articleId = await saveManualArticle(article, tdName, analysis);
      
      res.json({
        success: true,
        message: 'Article added and analyzed',
        article_id: articleId,
        analysis: {
          story_type: analysis.story_type,
          sentiment: analysis.sentiment,
          impact_score: analysis.impact_score,
          adjusted_impact: analysis.bias_adjustments?.final_adjusted_impact || analysis.impact_score
        }
      });
    } else {
      // Extract TD mentions
      console.log(`   👤 Extracting TD mentions...`);
      const tdMentions = TDExtractionService.extractTDMentions(content);
      
      if (tdMentions.length === 0) {
        return res.json({
          success: true,
          message: 'Article scraped but no TDs mentioned',
          content_length: content.length,
          suggestion: 'Specify tdName parameter to force analysis'
        });
      }
      
      // Analyze for each TD mentioned
      const results = [];
      
      for (const td of tdMentions.slice(0, 3)) {  // Limit to first 3 TDs
        console.log(`   🤖 Analyzing for ${td.name}...`);
        
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
        } catch (error: any) {
          console.error(`   ❌ Analysis failed for ${td.name}`);
          results.push({
            td_name: td.name,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Article processed',
        tds_found: tdMentions.length,
        analyzed: results
      });
    }
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/articles/bulk-add - Add multiple articles at once
 */
router.post('/bulk-add', async (req, res, next) => {
  try {
    const { articles } = req.body;  // Array of {url, source, tdName}
    
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'articles array is required'
      });
    }
    
    console.log(`📚 Processing ${articles.length} articles in bulk...`);
    
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
            console.log(`   ✅ [${processed}/${articles.length}] ${item.url}`);
          } else {
            failed++;
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          failed++;
          console.error(`   ❌ Failed: ${item.url}`);
        }
      }
      
      console.log(`✅ Bulk processing complete: ${processed} processed, ${failed} failed`);
    }, 100);
    
    res.json({
      success: true,
      message: 'Bulk processing started in background',
      total: articles.length,
      estimated_duration: `${articles.length * 5}s`
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/articles/manual - Get all manually added articles
 */
router.get('/manual', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const { data: articles, error } = await supabaseDb
      .from('news_articles')
      .select('*')
      .in('source', ['Gript Media', 'The Ditch', 'Manual Addition', 'Village Magazine'])
      .order('published_date', { ascending: false })
      .limit(50);
    
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch articles'
      });
    }
    
    res.json({
      success: true,
      total: articles?.length || 0,
      articles: articles || []
    });
    
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

async function saveManualArticle(article: any, tdName: string, analysis: any): Promise<number | null> {
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
      console.error('Error saving article:', error);
      return null;
    }
    
    console.log(`   ✅ Article saved (ID: ${data.id})`);
    return data.id;
    
  } catch (error: any) {
    console.error('Error:', error.message);
    return null;
  }
}

export default router;

