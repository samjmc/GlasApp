/**
 * Historical Baseline Admin Routes
 * Endpoints for AI-powered baseline research
 */

import { Router } from 'express';
import { HistoricalBaselineService } from '../../services/historicalBaselineService';
import { supabaseDb } from '../../db';

const router = Router();

/**
 * POST /api/admin/baselines/research/:name - Research one TD's baseline
 */
router.post('/research/:name', async (req, res, next) => {
  try {
    const tdName = req.params.name;
    const { crossCheck = false } = req.body;
    
    console.log(`🔍 Researching baseline for ${tdName}...`);
    
    const baseline = await HistoricalBaselineService.researchTDBaseline(
      tdName,
      'Unknown',
      'Unknown',
      { crossCheck }
    );
    
    res.json({
      success: true,
      baseline,
      interpretation: {
        starting_elo: Math.round(1500 * baseline.baseline_modifier),
        starting_percentage: baseline.baseline_score_0_100,
        category: baseline.category,
        summary: baseline.historical_summary
      }
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/baselines/research-all - Research all TDs (LONG RUNNING)
 */
router.post('/research-all', async (req, res, next) => {
  try {
    const { limit, crossCheck = false } = req.body;
    
    console.log('🔍 Starting baseline research for all TDs...');
    
    // Run in background
    setTimeout(async () => {
      try {
        const results = await HistoricalBaselineService.researchAllTDBaselines({
          limit,
          crossCheck,
          onProgress: (current, total, name) => {
            console.log(`   Progress: ${current}/${total} - ${name}`);
          }
        });
        
        console.log('✅ Baseline research complete!');
        console.log(`   Total researched: ${results.length}`);
        console.log(`   Average modifier: ${(results.reduce((sum, r) => sum + r.baseline_modifier, 0) / results.length).toFixed(3)}`);
      } catch (error) {
        console.error('❌ Baseline research failed:', error);
      }
    }, 100);
    
    res.json({
      success: true,
      message: 'Baseline research started in background',
      estimated_duration: limit ? `${limit * 3}s` : '10-15 minutes (200 TDs × 3s)',
      note: 'Check server logs for progress. Each TD takes ~3 seconds to research.',
      cost_estimate: limit ? `$${(limit * 0.02).toFixed(2)}` : '$4-6 for all 200 TDs'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/baselines/all - Get all stored baselines
 */
router.get('/all', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const { data: baselines, error } = await supabaseDb
      .from('td_historical_baselines')
      .select('*')
      .order('baseline_modifier', { ascending: true });
    
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch baselines'
      });
    }
    
    // Calculate statistics
    const stats = {
      total_tds: baselines?.length || 0,
      average_modifier: baselines && baselines.length > 0
        ? (baselines.reduce((sum, b) => sum + Number(b.baseline_modifier), 0) / baselines.length).toFixed(3)
        : 1.0,
      categories: {} as Record<string, number>
    };
    
    baselines?.forEach(b => {
      const cat = b.category || 'unknown';
      stats.categories[cat] = (stats.categories[cat] || 0) + 1;
    });
    
    res.json({
      success: true,
      baselines: baselines || [],
      stats
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/baselines/td/:name - Get specific TD's baseline
 */
router.get('/td/:name', async (req, res, next) => {
  try {
    const baseline = await HistoricalBaselineService.getStoredBaseline(req.params.name);
    
    if (!baseline) {
      return res.json({
        success: true,
        has_baseline: false,
        baseline: null,
        interpretation: {
          starting_elo: 1500,
          starting_percentage: 50,
          category: 'neutral',
          summary: 'No historical baseline - starts at neutral (1500 ELO, 50%)'
        }
      });
    }
    
    res.json({
      success: true,
      has_baseline: true,
      baseline,
      interpretation: {
        starting_elo: Math.round(1500 * baseline.baseline_modifier),
        starting_percentage: baseline.baseline_score_0_100,
        category: baseline.category,
        summary: baseline.historical_summary
      }
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/baselines/stats - Get baseline statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const { count } = await supabaseDb
      .from('td_historical_baselines')
      .select('*', { count: 'exact', head: true });
    
    const { data: baselines } = await supabaseDb
      .from('td_historical_baselines')
      .select('category, baseline_modifier')
      .limit(1000);
    
    const categoryBreakdown: Record<string, number> = {};
    let totalModifier = 0;
    
    baselines?.forEach(b => {
      const cat = b.category || 'unknown';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      totalModifier += Number(b.baseline_modifier);
    });
    
    const avgModifier = baselines && baselines.length > 0
      ? (totalModifier / baselines.length).toFixed(3)
      : '1.000';
    
    res.json({
      success: true,
      stats: {
        total_baselines: count || 0,
        average_modifier: avgModifier,
        category_breakdown: categoryBreakdown,
        coverage_percentage: Math.round(((count || 0) / 200) * 100)
      }
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;

