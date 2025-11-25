import { db } from '../db';
import { userActivity, InsertUserActivity } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export interface ActivityMetadata {
  category?: string;
  pollId?: number;
  postId?: number;
  quizScore?: number;
  constituency?: string;
  partyInteraction?: string;
  duration?: number;
  location?: {
    latitude: number;
    longitude: number;
    county?: string;
  };
  [key: string]: any;
}

export class ActivityTracker {
  
  static async logActivity(
    userId: number,
    action: string,
    metadata?: ActivityMetadata,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const activityData: InsertUserActivity = {
        userId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      };

      const [activity] = await db.insert(userActivity).values(activityData).returning();
      return activity;
    } catch (error) {
      console.error('Error logging user activity:', error);
      throw error;
    }
  }

  static async getUserActivity(userId: number, limit: number = 50) {
    try {
      const activities = await db
        .select()
        .from(userActivity)
        .where(eq(userActivity.userId, userId))
        .orderBy(desc(userActivity.createdAt))
        .limit(limit);

      return activities.map(activity => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null
      }));
    } catch (error) {
      console.error('Error retrieving user activity:', error);
      throw error;
    }
  }

  static async getActivityStats(userId: number, days: number = 30) {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      const stats = await db
        .select({
          action: userActivity.action,
          count: sql<number>`count(*)::int`
        })
        .from(userActivity)
        .where(
          and(
            eq(userActivity.userId, userId),
            gte(userActivity.createdAt, dateThreshold)
          )
        )
        .groupBy(userActivity.action);

      return stats;
    } catch (error) {
      console.error('Error retrieving activity stats:', error);
      throw error;
    }
  }

  static async getGlobalActivityStats(days: number = 7) {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      const stats = await db
        .select({
          action: userActivity.action,
          count: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct user_id)::int`
        })
        .from(userActivity)
        .where(gte(userActivity.createdAt, dateThreshold))
        .groupBy(userActivity.action);

      return stats;
    } catch (error) {
      console.error('Error retrieving global activity stats:', error);
      throw error;
    }
  }

  // Helper methods for common activity types
  static async logQuizCompletion(
    userId: number,
    quizData: {
      economicScore: number;
      socialScore: number;
      ideology: string;
      duration?: number;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.logActivity(
      userId,
      'completed_quiz',
      {
        category: 'political_engagement',
        quizScore: quizData.economicScore,
        socialScore: quizData.socialScore,
        ideology: quizData.ideology,
        duration: quizData.duration
      },
      ipAddress,
      userAgent
    );
  }

  static async logPollVote(
    userId: number,
    pollId: number,
    choice: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.logActivity(
      userId,
      'voted_poll',
      {
        category: 'civic_participation',
        pollId,
        choice
      },
      ipAddress,
      userAgent
    );
  }

  static async logConstituencyView(
    userId: number,
    constituency: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.logActivity(
      userId,
      'viewed_constituency',
      {
        category: 'geographic_exploration',
        constituency
      },
      ipAddress,
      userAgent
    );
  }

  static async logPartyInteraction(
    userId: number,
    partyName: string,
    interactionType: 'view' | 'compare' | 'match',
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.logActivity(
      userId,
      `${interactionType}_party`,
      {
        category: 'political_research',
        partyInteraction: partyName,
        interactionType
      },
      ipAddress,
      userAgent
    );
  }

  static async logLocationCapture(
    userId: number,
    location: { latitude: number; longitude: number; county?: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.logActivity(
      userId,
      'captured_location',
      {
        category: 'user_setup',
        location
      },
      ipAddress,
      userAgent
    );
  }
}