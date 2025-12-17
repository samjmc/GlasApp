/**
 * API endpoint for TDs with proper historical research
 * Use this for homepage until all 200 TDs are researched
 */

import { Router } from 'express';
import { supabaseDb } from '../db';

const router = Router();

/**
 * GET /api/researched-tds
 * Returns TDs that have actual AI historical research (not fallback scores)
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseDb
      .from('td_scores')
      .select(`
        politician_name,
        overall_elo,
        baseline_modifier,
        historical_summary,
        party,
        constituency,
        transparency_elo,
        effectiveness_elo,
        integrity_elo,
        consistency_elo,
        constituency_service_elo,
        parliamentary_activity_score,
        question_count_oral,
        question_count_written,
        total_votes,
        attendance_percentage,
        offices,
        is_minister,
        ministerial_role,
        image_url,
        last_updated
      `)
      .eq('is_active', true)  // Only active TDs
      .order('overall_elo', { ascending: false });

    if (error) {
      throw error;
    }

    // Add rankings and convert scores
    const rankedData = data?.map((td, index) => {
      const hasHistoricalResearch = td.historical_summary && 
        td.historical_summary !== 'Error during research - defaulting to neutral baseline' &&
        !td.historical_summary.startsWith('No verifiable') &&
        !td.historical_summary.startsWith('There is no') &&
        !td.historical_summary.startsWith('As of the current knowledge');

      return {
        ...td,
        rank: index + 1,
        overall_score: Math.round(((td.overall_elo - 1000) / 10)), // Correct ELO to 0-100 conversion
        score_0_100: Math.round(((td.overall_elo - 1000) / 10)),
        label: getScoreLabel(Math.round(((td.overall_elo - 1000) / 10))),
        has_historical_research: hasHistoricalResearch,
        parliamentary_score: td.parliamentary_activity_score || 0
      };
    });

    // Count TDs with historical research
    const researchedCount = rankedData?.filter(td => td.has_historical_research).length || 0;

    res.json({
      success: true,
      count: rankedData?.length || 0,
      researched_count: researchedCount,
      tds: rankedData || [],
      note: `Showing all ${rankedData?.length || 0} active TDs. ${researchedCount} have completed AI historical research.`
    });

  } catch (error: any) {
    console.error('Error fetching researched TDs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/researched-tds/stats
 * Returns statistics about TD research progress
 */
router.get('/stats', async (req, res) => {
  try {
    const { data: activeTDs } = await supabaseDb
      .from('td_scores')
      .select('politician_name, historical_summary', { count: 'exact' })
      .eq('is_active', true);  // Only active TDs

    const researchedTDs = activeTDs?.filter(td => 
      td.historical_summary && 
      td.historical_summary !== 'Error during research - defaulting to neutral baseline' &&
      !td.historical_summary.startsWith('No verifiable') &&
      !td.historical_summary.startsWith('There is no') &&
      !td.historical_summary.startsWith('As of the current knowledge')
    ) || [];

    const totalActiveTDs = activeTDs?.length || 169;

    res.json({
      success: true,
      stats: {
        total_tds: totalActiveTDs,  // Total active TDs
        tds_in_database: totalActiveTDs,
        tds_researched: researchedTDs.length,
        tds_pending: totalActiveTDs - researchedTDs.length,
        tds_fallback: totalActiveTDs - researchedTDs.length,
        completion_percentage: Math.round((researchedTDs.length / totalActiveTDs) * 100)
      }
    });

  } catch (error: any) {
    console.error('Error fetching research stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getScoreLabel(elo: number): string {
  if (elo >= 1700) return 'Excellent';
  if (elo >= 1550) return 'Good';
  if (elo >= 1400) return 'Average';
  if (elo >= 1250) return 'Below Average';
  return 'Poor';
}

export default router;

