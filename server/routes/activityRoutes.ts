import { Router, Request, Response } from 'express';
import { ActivityTracker } from '../services/activityTracker';
import { isAuthenticated } from '../middleware/sessionMiddleware';
import { z } from 'zod';

const router = Router();

// Log a custom activity
router.post('/log', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { action, metadata } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required'
      });
    }

    const userId = (req as any).user.id;
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
router.get('/history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 50;

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
router.get('/stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const days = parseInt(req.query.days as string) || 30;

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
router.get('/global-stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
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