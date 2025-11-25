/**
 * TD Ratings Routes
 * Allows users to rate TDs on various dimensions
 * Feeds into public trust score calculation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { supabaseDb } from '../../db';
import { z } from 'zod';

const router = Router();

// Validation schema
const ratingSchema = z.object({
  tdName: z.string().min(1),
  transparency: z.number().min(0).max(100).optional(),
  effectiveness: z.number().min(0).max(100).optional(),
  integrity: z.number().min(0).max(100).optional(),
  consistency: z.number().min(0).max(100).optional(),
  constituencyService: z.number().min(0).max(100).optional(),
  comment: z.string().max(500).optional()
});

/**
 * POST /api/ratings/submit - Submit rating for a TD
 */
router.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const validated = ratingSchema.parse(req.body);
    
    // Get user ID (from session if logged in, or generate anonymous)
    const userId = req.session?.userId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isAnonymous = !req.session?.userId;
    
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Check if user has already rated this TD
    const { data: existingRating } = await supabaseDb
      .from('user_td_ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('politician_name', validated.tdName)
      .maybeSingle();
    
    if (existingRating) {
      // Update existing rating
      const { error } = await supabaseDb
        .from('user_td_ratings')
        .update({
          transparency_rating: validated.transparency,
          effectiveness_rating: validated.effectiveness,
          integrity_rating: validated.integrity,
          consistency_rating: validated.consistency,
          constituency_service_rating: validated.constituencyService,
          comment: validated.comment,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRating.id);
      
      if (error) {
        console.error('Error updating rating:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update rating'
        });
      }
      
      res.json({
        success: true,
        message: 'Rating updated successfully',
        rating_id: existingRating.id
      });
      
    } else {
      // Create new rating
      const { data, error } = await supabaseDb
        .from('user_td_ratings')
        .insert({
          user_id: userId,
          politician_name: validated.tdName,
          transparency_rating: validated.transparency,
          effectiveness_rating: validated.effectiveness,
          integrity_rating: validated.integrity,
          consistency_rating: validated.consistency,
          constituency_service_rating: validated.constituencyService,
          comment: validated.comment,
          is_anonymous: isAnonymous
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating rating:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to save rating'
        });
      }
      
      res.json({
        success: true,
        message: 'Rating submitted successfully',
        rating_id: data.id
      });
    }
    
    // Trigger score recalculation in background
    setTimeout(async () => {
      try {
        const { unifiedScoreJob } = await import('../../jobs/unifiedScoreCalculationJob');
        await unifiedScoreJob.triggerManual();
      } catch (error) {
        console.error('Failed to trigger score recalculation:', error);
      }
    }, 1000);
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ratings/td/:name - Get ratings for a specific TD
 */
router.get('/td/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tdName = req.params.name;
    
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Get all ratings for this TD
    const { data: ratings, error } = await supabaseDb
      .from('user_td_ratings')
      .select('*')
      .eq('politician_name', tdName);
    
    if (error) {
      console.error('Error fetching ratings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch ratings'
      });
    }
    
    if (!ratings || ratings.length === 0) {
      return res.json({
        success: true,
        total_ratings: 0,
        averages: {
          transparency: null,
          effectiveness: null,
          integrity: null,
          consistency: null,
          constituency_service: null,
          overall: null
        },
        distribution: {
          transparency: [],
          effectiveness: [],
          integrity: [],
          consistency: [],
          constituency_service: []
        }
      });
    }
    
    // Calculate averages
    const totals = {
      transparency: 0,
      effectiveness: 0,
      integrity: 0,
      consistency: 0,
      constituency_service: 0,
      count: {
        transparency: 0,
        effectiveness: 0,
        integrity: 0,
        consistency: 0,
        constituency_service: 0
      }
    };
    
    ratings.forEach(r => {
      if (r.transparency_rating != null) {
        totals.transparency += r.transparency_rating;
        totals.count.transparency++;
      }
      if (r.effectiveness_rating != null) {
        totals.effectiveness += r.effectiveness_rating;
        totals.count.effectiveness++;
      }
      if (r.integrity_rating != null) {
        totals.integrity += r.integrity_rating;
        totals.count.integrity++;
      }
      if (r.consistency_rating != null) {
        totals.consistency += r.consistency_rating;
        totals.count.consistency++;
      }
      if (r.constituency_service_rating != null) {
        totals.constituency_service += r.constituency_service_rating;
        totals.count.constituency_service++;
      }
    });
    
    const averages = {
      transparency: totals.count.transparency > 0 ? Math.round(totals.transparency / totals.count.transparency) : null,
      effectiveness: totals.count.effectiveness > 0 ? Math.round(totals.effectiveness / totals.count.effectiveness) : null,
      integrity: totals.count.integrity > 0 ? Math.round(totals.integrity / totals.count.integrity) : null,
      consistency: totals.count.consistency > 0 ? Math.round(totals.consistency / totals.count.consistency) : null,
      constituency_service: totals.count.constituency_service > 0 ? Math.round(totals.constituency_service / totals.count.constituency_service) : null
    };
    
    // Calculate overall average
    const validAverages = Object.values(averages).filter(v => v !== null);
    const overall = validAverages.length > 0
      ? Math.round(validAverages.reduce((sum, val) => sum + (val || 0), 0) / validAverages.length)
      : null;
    
    res.json({
      success: true,
      total_ratings: ratings.length,
      averages: {
        ...averages,
        overall
      },
      recent_comments: ratings
        .filter(r => r.comment)
        .slice(0, 5)
        .map(r => ({
          comment: r.comment,
          date: r.created_at
        }))
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ratings/user/:tdName - Get user's own rating for a TD
 */
router.get('/user/:tdName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.json({
        success: true,
        has_rating: false,
        rating: null
      });
    }
    
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const { data: rating } = await supabaseDb
      .from('user_td_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('politician_name', req.params.tdName)
      .maybeSingle();
    
    res.json({
      success: true,
      has_rating: !!rating,
      rating: rating ? {
        transparency: rating.transparency_rating,
        effectiveness: rating.effectiveness_rating,
        integrity: rating.integrity_rating,
        consistency: rating.consistency_rating,
        constituency_service: rating.constituency_service_rating,
        comment: rating.comment,
        submitted_at: rating.created_at,
        updated_at: rating.updated_at
      } : null
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ratings/stats - Get overall rating statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Get total ratings count
    const { count: totalRatings } = await supabaseDb
      .from('user_td_ratings')
      .select('*', { count: 'exact', head: true });
    
    // Get unique TDs rated
    const { data: uniqueTDs } = await supabaseDb
      .from('user_td_ratings')
      .select('politician_name')
      .limit(1000);
    
    const uniqueTDCount = uniqueTDs
      ? new Set(uniqueTDs.map(r => r.politician_name)).size
      : 0;
    
    // Get recent ratings
    const { data: recentRatings } = await supabaseDb
      .from('user_td_ratings')
      .select('politician_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    res.json({
      success: true,
      stats: {
        total_ratings: totalRatings || 0,
        unique_tds_rated: uniqueTDCount,
        recent_ratings: recentRatings || []
      }
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;

