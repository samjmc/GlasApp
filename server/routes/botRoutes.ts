import { Router, Request, Response } from 'express';
import { BotService } from '../services/botService';
import { requireAdminAccess } from '../middleware/adminAccess';
import { requestLogger } from '../utils/logger';

const router = Router();

// Create a bot account
router.post('/create', requireAdminAccess, async (req: Request, res: Response) => {
  try {
    const { username, email, firstName, lastName, county, bio, profileImageUrl } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    requestLogger(req).info(
      { operation: 'admin.bots.create', actor: (req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId },
      'Bot admin action'
    );

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
router.get('/list', requireAdminAccess, async (req: Request, res: Response) => {
  try {
    const bots = await BotService.getAllBots();
    requestLogger(req).info(
      { operation: 'admin.bots.list', actor: (req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId },
      'Bot admin action'
    );
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
router.delete('/:username', requireAdminAccess, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    await BotService.deleteBotAccount(username);

    requestLogger(req).info(
      { operation: 'admin.bots.delete', actor: (req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId, username },
      'Bot admin action'
    );
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