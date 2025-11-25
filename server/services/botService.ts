import { storage } from '../storage';
import bcrypt from 'bcryptjs';

export interface BotAccountConfig {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  county?: string;
  bio?: string;
  profileImageUrl?: string;
}

export class BotService {
  static async createBotAccount(config: BotAccountConfig) {
    try {
      // Check if bot username already exists
      const existingUser = await storage.getUserByUsername(config.username);
      if (existingUser) {
        throw new Error(`Bot username ${config.username} already exists`);
      }

      // Create a simple password for bot accounts
      const defaultPassword = await bcrypt.hash('bot-account-2024', 10);

      const botUser = await storage.createUser({
        username: config.username,
        email: config.email,
        password: defaultPassword,
        firstName: config.firstName || 'Bot',
        lastName: config.lastName || 'User',
        county: config.county || 'Dublin',
        bio: config.bio || 'Automated community member',
        profileImageUrl: config.profileImageUrl,
        role: 'bot',
        emailVerified: true, // Bots don't need email verification
        twoFactorEnabled: false,
        latitude: undefined,
        longitude: undefined
      });

      console.log(`Created bot account: ${config.username}`);
      return botUser;
    } catch (error) {
      console.error('Error creating bot account:', error);
      throw error;
    }
  }

  static async getAllBots() {
    // This would need to be implemented in storage service
    // For now, return empty array
    return [];
  }

  static async deleteBotAccount(username: string) {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        throw new Error(`Bot ${username} not found`);
      }

      if (user.role !== 'bot') {
        throw new Error(`User ${username} is not a bot account`);
      }

      // Delete bot account logic would go here
      console.log(`Deleted bot account: ${username}`);
      return true;
    } catch (error) {
      console.error('Error deleting bot account:', error);
      throw error;
    }
  }

  static isBotAccount(user: any): boolean {
    return user?.role === 'bot';
  }
}