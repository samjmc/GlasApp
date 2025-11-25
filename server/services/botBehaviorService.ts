import { storage } from '../storage';
import { ActivityTracker } from './activityTracker';

interface BotBehaviorConfig {
  botId: number;
  activityTypes: string[];
  frequency: 'low' | 'medium' | 'high';
  interactionPatterns: {
    politicalLeanings?: string[];
    favoriteConstituencies?: string[];
    engagementStyle?: 'analytical' | 'emotional' | 'factual';
    responseLength?: 'short' | 'medium' | 'long';
  };
}

const ACTIVITY_FREQUENCIES = {
  low: { min: 1, max: 3 }, // 1-3 activities per day
  medium: { min: 3, max: 8 }, // 3-8 activities per day
  high: { min: 8, max: 15 } // 8-15 activities per day
};

const BOT_ACTIVITIES = [
  'viewed_constituency',
  'viewed_party',
  'compared_parties',
  'voted_poll',
  'map_interaction',
  'viewed_education',
  'started_quiz',
  'political_discussion'
];

export class BotBehaviorService {
  private static instance: BotBehaviorService;
  private activeSchedules: Map<number, NodeJS.Timeout> = new Map();

  static getInstance(): BotBehaviorService {
    if (!this.instance) {
      this.instance = new BotBehaviorService();
    }
    return this.instance;
  }

  async startBotBehavior(config: BotBehaviorConfig): Promise<void> {
    // Stop existing behavior for this bot
    this.stopBotBehavior(config.botId);

    const frequency = ACTIVITY_FREQUENCIES[config.frequency];
    const intervalMs = this.calculateInterval(frequency);

    const schedule = setInterval(async () => {
      try {
        await this.executeRandomActivity(config);
      } catch (error) {
        console.error(`Bot ${config.botId} activity failed:`, error);
      }
    }, intervalMs);

    this.activeSchedules.set(config.botId, schedule);
    console.log(`Started bot behavior for bot ${config.botId} with ${config.frequency} frequency`);
  }

  stopBotBehavior(botId: number): void {
    const schedule = this.activeSchedules.get(botId);
    if (schedule) {
      clearInterval(schedule);
      this.activeSchedules.delete(botId);
      console.log(`Stopped bot behavior for bot ${botId}`);
    }
  }

  stopAllBotBehaviors(): void {
    Array.from(this.activeSchedules.keys()).forEach(botId => {
      this.stopBotBehavior(botId);
    });
  }

  private calculateInterval(frequency: { min: number; max: number }): number {
    // Calculate interval in milliseconds
    const activitiesPerDay = Math.random() * (frequency.max - frequency.min) + frequency.min;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return millisecondsPerDay / activitiesPerDay;
  }

  private async executeRandomActivity(config: BotBehaviorConfig): Promise<void> {
    const availableActivities = config.activityTypes.length > 0 
      ? config.activityTypes 
      : BOT_ACTIVITIES;

    const randomActivity = availableActivities[Math.floor(Math.random() * availableActivities.length)];
    const metadata = this.generateActivityMetadata(randomActivity, config.interactionPatterns);

    await ActivityTracker.logActivity(config.botId, randomActivity, metadata);
  }

  private generateActivityMetadata(activity: string, patterns: BotBehaviorConfig['interactionPatterns']): any {
    const metadata: any = { category: 'bot_activity' };

    switch (activity) {
      case 'viewed_constituency':
        if (patterns.favoriteConstituencies && patterns.favoriteConstituencies.length > 0) {
          metadata.constituency = patterns.favoriteConstituencies[
            Math.floor(Math.random() * patterns.favoriteConstituencies.length)
          ];
        } else {
          // Random Irish constituency
          const constituencies = [
            'Dublin Central', 'Cork South-Central', 'Galway West', 'Limerick City',
            'Waterford', 'Dublin South', 'Dublin North', 'Cork North-Central'
          ];
          metadata.constituency = constituencies[Math.floor(Math.random() * constituencies.length)];
        }
        break;

      case 'viewed_party':
        const parties = ['Fianna Fáil', 'Fine Gael', 'Sinn Féin', 'Labour Party', 'Green Party', 'Social Democrats'];
        metadata.partyInteraction = parties[Math.floor(Math.random() * parties.length)];
        break;

      case 'compared_parties':
        const compareParties = ['Fianna Fáil', 'Fine Gael', 'Sinn Féin', 'Labour Party'];
        const selected = compareParties.sort(() => 0.5 - Math.random()).slice(0, 2);
        metadata.partyInteraction = selected.join(' vs ');
        break;

      case 'voted_poll':
        metadata.pollId = Math.floor(Math.random() * 10) + 1;
        metadata.choice = Math.random() > 0.5 ? 'yes' : 'no';
        break;

      case 'map_interaction':
        metadata.interactionType = ['zoom', 'pan', 'click'][Math.floor(Math.random() * 3)];
        break;

      case 'viewed_education':
        const pages = ['political-parties', 'voting-system', 'constituencies', 'election-process'];
        metadata.page = pages[Math.floor(Math.random() * pages.length)];
        break;

      case 'started_quiz':
        metadata.category = 'political_engagement';
        break;
    }

    return metadata;
  }

  async getBotActivity(botId: number, days: number = 7): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const activities = await storage.getUserActivityHistory(botId, startDate);
      return activities || [];
    } catch (error) {
      console.error('Failed to get bot activity:', error);
      return [];
    }
  }

  async initializeDefaultBotBehaviors(): Promise<void> {
    try {
      // Get all bot users
      const bots = await storage.getBotUsers();
      
      for (const bot of bots) {
        const config: BotBehaviorConfig = {
          botId: bot.id,
          activityTypes: BOT_ACTIVITIES,
          frequency: this.getRandomFrequency(),
          interactionPatterns: {
            engagementStyle: this.getRandomEngagementStyle(),
            responseLength: this.getRandomResponseLength()
          }
        };

        await this.startBotBehavior(config);
      }

      console.log(`Initialized behaviors for ${bots.length} bots`);
    } catch (error) {
      console.error('Failed to initialize bot behaviors:', error);
    }
  }

  private getRandomFrequency(): 'low' | 'medium' | 'high' {
    const frequencies: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    return frequencies[Math.floor(Math.random() * frequencies.length)];
  }

  private getRandomEngagementStyle(): 'analytical' | 'emotional' | 'factual' {
    const styles: ('analytical' | 'emotional' | 'factual')[] = ['analytical', 'emotional', 'factual'];
    return styles[Math.floor(Math.random() * styles.length)];
  }

  private getRandomResponseLength(): 'short' | 'medium' | 'long' {
    const lengths: ('short' | 'medium' | 'long')[] = ['short', 'medium', 'long'];
    return lengths[Math.floor(Math.random() * lengths.length)];
  }
}

export const botBehaviorService = BotBehaviorService.getInstance();