import { requireAuth } from '../auth';
import express, { type Request, type Response } from 'express';
import { supabaseDb } from '../db.js';
import { PersonalRankingsService } from '../services/personalRankingsService.js';
import { IdeologySnapshotService } from '../services/ideologySnapshotService.js';
import { IDEOLOGY_DIMENSIONS } from '../constants/ideology.js';

const router = express.Router();

interface IdeologyDimensionScores {
  economic: number;
  social: number;
  cultural: number;
  authority: number;
  environmental: number;
  welfare: number;
  globalism: number;
  technocratic: number;
}

interface IdeologySnapshotRow {
  snapshot_date: string;
  economic?: string | number | null;
  social?: string | number | null;
  cultural?: string | number | null;
  authority?: string | number | null;
  environmental?: string | number | null;
  welfare?: string | number | null;
  globalism?: string | number | null;
  technocratic?: string | number | null;
  session_count?: number | null;
}

interface IdeologyEventRow {
  event_date: string;
  event_type?: string | null;
  label?: string | null;
  icon?: string | null;
  dimension?: string | null;
  magnitude?: number | null;
}

interface TimelinePoint {
  date: string;
  dateLabel: string;
  economic: number;
  social: number;
  cultural: number;
  authority: number;
  environmental: number;
  welfare: number;
  globalism: number;
  technocratic: number;
  sessionCount?: number | null;
}

/**
 * GET /api/ideology-timeline/:userId - Enhanced ideology timeline with all features
 * Authenticated + ownership (or admin). Sensitive personal data.
 * Query params:
 *   - weeks: number of weeks (default: 12)
 *   - format: 'json' | 'csv' (default: json)
 *   - fromDate: ISO date string
 *   - toDate: ISO date string
 *   - compareParty: party name for comparison
 *   - compareAverage: 'true' to show average user
 */
router.get('/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const caller = req.user as { id?: string | number; app_metadata?: { role?: string } } | null | undefined;

    // Ownership or admin: users may only read their own timeline unless admin.
    if (String(caller?.id) !== userId && caller?.app_metadata?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const {
      weeks = 12,
      format = 'json',
      fromDate,
      toDate,
      compareParty,
      compareAverage
    } = req.query;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.json({
        success: true,
        timeline: [],
        events: [],
        message: 'Complete the enhanced quiz to see your ideology evolution',
      });
    }

    if (!supabaseDb) {
      return res.status(500).json({
        success: false,
        message: 'Database not configured',
      });
    }

    // Parse date range
    const from = fromDate ? new Date(fromDate as string) : undefined;
    const to = toDate ? new Date(toDate as string) : undefined;

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
      return res.json({ success: true, timeline: [], events: [] });
    }

    const quizDate = new Date(quizData.created_at);

    // Try to use snapshots first (accurate), fallback to interpolation
    const snapshots = await IdeologySnapshotService.getSnapshots(userId, from, to);
    
    let timeline: TimelinePoint[] = [];

    if (snapshots.length > 0) {
      // Use snapshots for accurate data
      timeline = snapshots.map(snapshot => {
        const row = snapshot as IdeologySnapshotRow;
        return {
          date: row.snapshot_date,
          dateLabel: formatDateLabel(new Date(row.snapshot_date)),
          economic: Number(row.economic),
          social: Number(row.social),
          cultural: Number(row.cultural),
          authority: Number(row.authority),
          environmental: Number(row.environmental),
          welfare: Number(row.welfare),
          globalism: Number(row.globalism),
          technocratic: Number(row.technocratic),
          sessionCount: row.session_count,
        };
      });
    } else {
      // Fallback to interpolation (legacy behavior)
      const { data: currentProfile } = await supabaseDb
        .from('user_ideology_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Add quiz baseline
      timeline.push({
        date: quizDate.toISOString().split('T')[0],
        dateLabel: 'Quiz',
        ...extractDimensions(quizData, 'quiz'),
        sessionCount: 0,
      });

      if (currentProfile) {
        // Get sessions for interpolation
        const { data: sessions } = await supabaseDb
          .from('daily_sessions')
          .select('completed_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('completed_at', quizDate.toISOString())
          .order('completed_at', { ascending: true });

        if (sessions && sessions.length > 0) {
          const weekMap = groupByWeek(sessions);
          const baseline = extractDimensions(quizData, 'quiz');
          const current = extractDimensions(currentProfile, 'profile');

          const weeks = Array.from(weekMap.entries()).sort((a, b) => 
            a[1].getTime() - b[1].getTime()
          );

          weeks.forEach(([weekKey, lastDate], index) => {
            const progress = (index + 1) / weeks.length;
            const interpolated = interpolateDimensions(baseline, current, progress);

            timeline.push({
              date: lastDate.toISOString().split('T')[0],
              dateLabel: formatDateLabel(lastDate),
              ...interpolated,
              sessionCount: 0,
            });
          });
        } else if (daysSince(quizDate) > 1) {
          timeline.push({
            date: new Date().toISOString().split('T')[0],
            dateLabel: 'Now',
            ...extractDimensions(currentProfile, 'profile'),
            sessionCount: 0,
          });
        }
      }
    }

    // Get events for annotations
    const events = await IdeologySnapshotService.getEvents(userId, from, to);
    const formattedEvents = events.map(event => {
      const row = event as IdeologyEventRow;
      return {
        date: new Date(row.event_date).toISOString().split('T')[0],
        type: row.event_type,
        label: row.label,
        icon: row.icon,
        dimension: row.dimension,
        magnitude: row.magnitude,
      };
    });

    // Get comparison data if requested
    let comparisonData = null;

    if (compareParty) {
      const { data: partyProfile } = await supabaseDb
        .from('party_ideology_profiles')
        .select('*')
        .eq('party', compareParty)
        .maybeSingle();

      if (partyProfile) {
        comparisonData = {
          type: 'party',
          name: compareParty as string,
          data: extractDimensions(partyProfile, 'profile'),
        };
      }
    } else if (compareAverage === 'true') {
      // Calculate average user profile
      const { data: allProfiles } = await supabaseDb
        .from('user_ideology_profiles')
        .select('*')
        .gt('total_weight', 0);

      if (allProfiles && allProfiles.length > 0) {
        const averages: Record<string, number> = {};
        IDEOLOGY_DIMENSIONS.forEach(dim => {
          const values = allProfiles.map(p => Number(p[dim]) || 0);
          averages[dim] = values.reduce((sum, val) => sum + val, 0) / values.length;
        });

        comparisonData = {
          type: 'average',
          name: 'Average User',
          data: averages,
        };
      }
    }

    // Limit to requested weeks if not using date range
    const weeksToShow = Number(weeks) || 12;
    const limitedTimeline = timeline.slice(-weeksToShow);

    // Handle CSV export
    if (format === 'csv') {
      const csv = exportToCSV(limitedTimeline);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ideology-timeline-${userId}.csv"`);
      return res.send(csv);
    }

    // JSON response
    res.json({
      success: true,
      timeline: limitedTimeline,
      events: formattedEvents,
      comparison: comparisonData,
      quizDate: quizData.created_at,
      usingSnapshots: snapshots.length > 0,
    });

  } catch (error: unknown) {
    console.error('Ideology timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ideology timeline',
    });
  }
});

// Helper functions
function extractDimensions(data: Record<string, unknown>, type: 'quiz' | 'profile'): IdeologyDimensionScores {
  if (type === 'quiz') {
    return {
      economic: Number(data.economic_score) || 0,
      social: Number(data.social_score) || 0,
      cultural: Number(data.cultural_score) || 0,
      authority: Number(data.authority_score) || 0,
      environmental: Number(data.environmental_score) || 0,
      welfare: Number(data.welfare_score) || 0,
      globalism: Number(data.globalism_score) || 0,
      technocratic: Number(data.technocratic_score) || 0,
    };
  } else {
    return {
      economic: Number(data.economic) || 0,
      social: Number(data.social) || 0,
      cultural: Number(data.cultural) || 0,
      authority: Number(data.authority) || 0,
      environmental: Number(data.environmental) || 0,
      welfare: Number(data.welfare) || 0,
      globalism: Number(data.globalism) || 0,
      technocratic: Number(data.technocratic) || 0,
    };
  }
}

function interpolateDimensions(baseline: IdeologyDimensionScores, current: IdeologyDimensionScores, progress: number): IdeologyDimensionScores {
  const result = {} as IdeologyDimensionScores;
  IDEOLOGY_DIMENSIONS.forEach(dim => {
    result[dim] = baseline[dim] + (current[dim] - baseline[dim]) * progress;
  });
  return result;
}

function groupByWeek(sessions: Array<{ completed_at: string }>): Map<string, Date> {
  const weekMap = new Map<string, Date>();
  
  sessions.forEach((session) => {
    const sessionDate = new Date(session.completed_at);
    const weekKey = getWeekKey(sessionDate);
    
    if (!weekMap.has(weekKey) || sessionDate > weekMap.get(weekKey)!) {
      weekMap.set(weekKey, sessionDate);
    }
  });

  return weekMap;
}

function getWeekKey(date: Date): string {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNum}`;
}

function formatDateLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function daysSince(date: Date): number {
  return (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function exportToCSV(timeline: TimelinePoint[]): string {
  if (timeline.length === 0) return '';

  // Header
  const headers = ['Date', 'Date Label', ...IDEOLOGY_DIMENSIONS.map(d => d.charAt(0).toUpperCase() + d.slice(1)), 'Sessions'];
  let csv = headers.join(',') + '\n';

  // Rows
  timeline.forEach(point => {
    const row = [
      point.date,
      `"${point.dateLabel}"`,
      ...IDEOLOGY_DIMENSIONS.map(dim => point[dim].toFixed(2)),
      point.sessionCount || 0
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

export default router;


