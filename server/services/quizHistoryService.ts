import { db } from "../db";
import { sql } from "drizzle-orm";
import { IdeologicalDimensions } from "@shared/quizTypes";

// Quiz history result type
interface QuizHistoryResult {
  id: number;
  user_id: number;
  economic_score: number;
  social_score: number;
  cultural_score: number;
  globalism_score: number;
  environmental_score: number;
  authority_score: number;
  welfare_score: number;
  technocratic_score: number;
  ideology: string | null;
  description: string | null;
  created_at: Date;
  is_current: boolean;
}

/**
 * Service to manage quiz history for users
 */
export class QuizHistoryService {
  /**
   * Save a new quiz result for a user
   * This will set any existing results to not current
   */
  async saveQuizResult(
    userId: number, 
    dimensions: IdeologicalDimensions, 
    ideology?: string,
    description?: string
  ): Promise<QuizHistoryResult> {
    try {
      // First, set any existing results to not current
      await db.execute(sql`
        UPDATE quiz_history 
        SET is_current = false 
        WHERE user_id = ${userId} AND is_current = true
      `);
      
      // Insert the new result
      const result = await db.execute(sql`
        INSERT INTO quiz_history (
          user_id, 
          economic_score, 
          social_score, 
          cultural_score,
          globalism_score,
          environmental_score,
          authority_score,
          welfare_score,
          technocratic_score,
          ideology,
          description,
          is_current
        ) VALUES (
          ${userId},
          ${dimensions.economic},
          ${dimensions.social},
          ${dimensions.cultural},
          ${dimensions.globalism},
          ${dimensions.environmental},
          ${dimensions.authority},
          ${dimensions.welfare},
          ${dimensions.technocratic},
          ${ideology || null},
          ${description || null},
          true
        )
        RETURNING *
      `);
      
      return result.rows[0] as QuizHistoryResult;
    } catch (error) {
      console.error("Error saving quiz result:", error);
      throw error;
    }
  }
  
  /**
   * Get all quiz history for a user
   */
  async getUserQuizHistory(userId: number): Promise<QuizHistoryResult[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM quiz_history 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `);
      
      return result.rows as QuizHistoryResult[];
    } catch (error) {
      console.error("Error getting quiz history:", error);
      throw error;
    }
  }
  
  /**
   * Get the current quiz result for a user
   */
  async getCurrentQuizResult(userId: number): Promise<QuizHistoryResult | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM quiz_history 
        WHERE user_id = ${userId} AND is_current = true
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0] as QuizHistoryResult;
    } catch (error) {
      console.error("Error getting current quiz result:", error);
      throw error;
    }
  }
  
  /**
   * Calculate the changes between the current and previous quiz results
   */
  async calculateChanges(userId: number): Promise<any | null> {
    try {
      const history = await this.getUserQuizHistory(userId);
      
      if (history.length < 2) {
        return null;
      }
      
      const current = history.find(h => h.is_current);
      const previous = history.filter(h => !h.is_current)[0];
      
      if (!current || !previous) {
        return null;
      }
      
      // Calculate the changes
      const changes = {
        economic: this.formatChange(current.economic_score, previous.economic_score),
        social: this.formatChange(current.social_score, previous.social_score),
        cultural: this.formatChange(current.cultural_score, previous.cultural_score),
        globalism: this.formatChange(current.globalism_score, previous.globalism_score),
        environmental: this.formatChange(current.environmental_score, previous.environmental_score),
        authority: this.formatChange(current.authority_score, previous.authority_score),
        welfare: this.formatChange(current.welfare_score, previous.welfare_score),
        technocratic: this.formatChange(current.technocratic_score, previous.technocratic_score),
        timeSince: this.formatDate(previous.created_at),
        previousIdeology: previous.ideology,
        currentIdeology: current.ideology,
      };
      
      return {
        changes,
        current,
        previous,
      };
    } catch (error) {
      console.error("Error calculating changes:", error);
      throw error;
    }
  }
  
  /**
   * Format the change between two scores with direction
   */
  private formatChange(current: number, previous: number): { value: number; direction: string } {
    const change = current - previous;
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'increased' : change < 0 ? 'decreased' : 'unchanged'
    };
  }
  
  /**
   * Format a date into a readable string
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
  }
}

// Export a singleton instance
export const quizHistoryService = new QuizHistoryService();