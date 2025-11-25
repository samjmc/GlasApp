import express, { type Request, type Response } from 'express';
import { supabaseDb } from '../services/db.js';
import { PersonalRankingsService } from '../services/personalRankingsService.js';
import { IdeologySnapshotService } from '../services/ideologySnapshotService.js';
import { IDEOLOGY_DIMENSIONS } from '../constants/ideology.js';

const router = express.Router();

/**
 * GET /api/ideology-timeline/:userId - Get ideology evolution with snapshots, events, and comparisons
 * Query params:
 *   - weeks: number of weeks to show (default: 12)
 *   - format: 'json' | 'csv' (default: json)
 *   - fromDate: ISO date string (optional)
 *   - toDate: ISO date string (optional)
 *   - compareParty: party name to overlay (optional)
 *   - compareAverage: true to show average user (optional)
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { weeks = 12 } = req.query;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.json({
        success: true,
        timeline: [],
        message: 'Complete the enhanced quiz to see your ideology evolution',
      });
    }

    if (!supabaseDb) {
      return res.status(500).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Get quiz baseline
    const { data: quizData } = await supabaseDb
      .from('political_evolution')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_version', 'enhanced')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!quizData) {
      return res.json({
        success: true,
        timeline: [],
      });
    }

    const quizDate = new Date(quizData.created_at);
    const weeksToFetch = Number(weeks) || 12;
    
    // Get current ideology profile
    const { data: currentProfile } = await supabaseDb
      .from('user_ideology_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Calculate weekly data points
    const weeklyData: any[] = [];
    
    // Add quiz baseline as starting point
    weeklyData.push({
      weekStart: quizDate.toISOString(),
      weekLabel: 'Quiz',
      economic: Number(quizData.economic_score) || 0,
      social: Number(quizData.social_score) || 0,
      cultural: Number(quizData.cultural_score) || 0,
      authority: Number(quizData.authority_score) || 0,
      environmental: Number(quizData.environmental_score) || 0,
      welfare: Number(quizData.welfare_score) || 0,
      globalism: Number(quizData.globalism_score) || 0,
      technocratic: Number(quizData.technocratic_score) || 0,
    });

    // Get all daily sessions grouped by week
    const { data: sessions } = await supabaseDb
      .from('daily_sessions')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', quizDate.toISOString())
      .order('completed_at', { ascending: true });

    if (sessions && sessions.length > 0 && currentProfile) {
      // Group sessions by week
      const weekMap = new Map<string, Date>();
      
      sessions.forEach((session: any) => {
        const sessionDate = new Date(session.completed_at);
        const weekKey = getWeekKey(sessionDate);
        
        if (!weekMap.has(weekKey) || sessionDate > weekMap.get(weekKey)!) {
          weekMap.set(weekKey, sessionDate);
        }
      });

      const baseline = {
        economic: Number(quizData.economic_score) || 0,
        social: Number(quizData.social_score) || 0,
        cultural: Number(quizData.cultural_score) || 0,
        authority: Number(quizData.authority_score) || 0,
        environmental: Number(quizData.environmental_score) || 0,
        welfare: Number(quizData.welfare_score) || 0,
        globalism: Number(quizData.globalism_score) || 0,
        technocratic: Number(quizData.technocratic_score) || 0,
      };

      const current = {
        economic: Number(currentProfile.economic) || 0,
        social: Number(currentProfile.social) || 0,
        cultural: Number(currentProfile.cultural) || 0,
        authority: Number(currentProfile.authority) || 0,
        environmental: Number(currentProfile.environmental) || 0,
        welfare: Number(currentProfile.welfare) || 0,
        globalism: Number(currentProfile.globalism) || 0,
        technocratic: Number(currentProfile.technocratic) || 0,
      };

      // Create interpolated data points for each week with activity
      const weeks = Array.from(weekMap.entries()).sort((a, b) => 
        a[1].getTime() - b[1].getTime()
      );

      weeks.forEach(([weekKey, lastDate], index) => {
        const progress = (index + 1) / weeks.length;
        
        const interpolated: any = {};
        Object.keys(baseline).forEach(dim => {
          interpolated[dim] = baseline[dim as keyof typeof baseline] + 
            (current[dim as keyof typeof current] - baseline[dim as keyof typeof baseline]) * progress;
        });

        weeklyData.push({
          weekStart: getStartOfWeek(lastDate).toISOString(),
          weekLabel: formatWeekLabel(lastDate),
          ...interpolated,
        });
      });
    } else if (currentProfile) {
      // Just show quiz and current if we have a profile but no sessions yet
      const now = new Date();
      const daysSinceQuiz = (now.getTime() - quizDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceQuiz > 1) {
        weeklyData.push({
          weekStart: now.toISOString(),
          weekLabel: 'Now',
          economic: Number(currentProfile.economic) || 0,
          social: Number(currentProfile.social) || 0,
          cultural: Number(currentProfile.cultural) || 0,
          authority: Number(currentProfile.authority) || 0,
          environmental: Number(currentProfile.environmental) || 0,
          welfare: Number(currentProfile.welfare) || 0,
          globalism: Number(currentProfile.globalism) || 0,
          technocratic: Number(currentProfile.technocratic) || 0,
        });
      }
    }

    // Limit to requested weeks
    const timeline = weeklyData.slice(-weeksToFetch);

    res.json({
      success: true,
      timeline,
      quizDate: quizData.created_at,
    });
    
  } catch (error: any) {
    console.error('Ideology timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ideology timeline',
    });
  }
});

// Helper functions
function getWeekKey(date: Date): string {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNum}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

export default router;

