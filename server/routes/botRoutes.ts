import { Router, Request, Response } from 'express';
import { BotService } from '../services/botService';
import { isAuthenticated } from '../middleware/sessionMiddleware';

const router = Router();

// Admin-only middleware (you can expand this based on your needs)
const isAdmin = (req: Request, res: Response, next: any) => {
  // For now, just check if user is authenticated
  // You can add proper admin role checking here
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
};

// Create a bot account
router.post('/create', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { username, email, firstName, lastName, county, bio, profileImageUrl } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    const bot = await BotService.createBotAccount({
      username,
      email,
      firstName,
      lastName,
      county,
      bio,
      profileImageUrl
    });

    res.status(201).json({
      success: true,
      message: 'Bot account created successfully',
      bot: {
        id: bot.id,
        username: bot.username,
        email: bot.email,
        role: bot.role
      }
    });
  } catch (error) {
    console.error('Error creating bot account:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create bot account'
    });
  }
});

// List all bot accounts
router.get('/list', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const bots = await BotService.getAllBots();
    res.json({
      success: true,
      bots
    });
  } catch (error) {
    console.error('Error listing bots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list bot accounts'
    });
  }
});

// Delete a bot account
router.delete('/:username', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    await BotService.deleteBotAccount(username);
    
    res.json({
      success: true,
      message: `Bot account ${username} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete bot account'
    });
  }
});

export default router;