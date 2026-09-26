import { requireAdmin, requireAuth } from '../auth';
import { Router, Request, Response } from 'express';
import { ActivityTracker } from '../services/activityTracker';
import { z } from 'zod';

const router = Router();

// Log a custom activity
router.post('/log', requireAuth, async (req: Request, res: Response) => {
  try {
    const { action, metadata } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required'
      });
    }

    const userId = req.user!.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const activity = await ActivityTracker.logActivity(
      userId,
      action,
      metadata,
      ipAddress,
      userAgent
    );

    res.status(201).json({
      success: true,
      activity: {
        id: activity.id,
        action: activity.action,
        createdAt: activity.createdAt
      }
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log activity'
    });
  }
});

// Get user's activity history
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const activities = await ActivityTracker.getUserActivity(userId, limit);

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error retrieving activity history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity history'
    });
  }
});

// Get user's activity statistics
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);

    const stats = await ActivityTracker.getActivityStats(userId, days);

    res.json({
      success: true,
      stats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error retrieving activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity statistics'
    });
  }
});

// Get global platform statistics (admin only)
router.get('/global-stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 7, 365);
    const stats = await ActivityTracker.getGlobalActivityStats(days);

    res.json({
      success: true,
      stats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error retrieving global stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve global statistics'
    });
  }
});

export default router;