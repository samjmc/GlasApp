import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { 
  quizResults, 
  quizResultsHistory,
  type InsertQuizResult, 
  type QuizResult,
  type InsertQuizResultHistory,
  type QuizResultHistory
} from "@shared/schema";
import { IdeologicalDimensions } from "@shared/quizTypes";

/**
 * QuizResultsService manages saving and retrieving quiz results,
 * including tracking a history of results over time
 */
export class QuizResultsService {
  /**
   * Save quiz results to the database.
   * If a user already has results, the current results are archived in history
   * and the new results become the active ones.
   */
  async saveQuizResults(
    userId: number, 
    dimensions: IdeologicalDimensions, 
    analysis: {
      ideology?: string;
      description?: string;
      detailedAnalysis?: string;
      politicalValues?: any;
      irishContextInsights?: any;
    },
    shareCode?: string
  ): Promise<QuizResult> {
    // Check if the user already has an active quiz result
    const existingResult = await this.getUserActiveResult(userId);
    
    // If there's an existing result, archive it to history
    if (existingResult) {
      await this.archiveQuizResult(existingResult);
      
      // Deactivate the existing result
      await db.update(quizResults)
        .set({ isActive: 0 })
        .where(eq(quizResults.id, existingResult.id));
    }
    
    // Create a new quiz result
    const newResult: InsertQuizResult = {
      userId,
      economicDimension: Number(dimensions.economic),
      socialDimension: Number(dimensions.social),
      culturalDimension: Number(dimensions.cultural),
      globalismDimension: Number(dimensions.globalism),
      environmentalDimension: Number(dimensions.environmental),
      authorityDimension: Number(dimensions.authority),
      welfareDimension: Number(dimensions.welfare),
      technocraticDimension: Number(dimensions.technocratic),
      ideology: analysis.ideology,
      description: analysis.description,
      shareCode: shareCode || this.generateShareCode(),
      isActive: 1,
      detailedAnalysis: analysis.detailedAnalysis,
      politicalValues: analysis.politicalValues ? JSON.stringify(analysis.politicalValues) : null,
      irishContextInsights: analysis.irishContextInsights ? JSON.stringify(analysis.irishContextInsights) : null,
    };
    
    // Insert the new result
    const [result] = await db.insert(quizResults).values(newResult).returning();
    return result;
  }
  
  /**
   * Archives a quiz result to the history table
   */
  private async archiveQuizResult(result: QuizResult): Promise<QuizResultHistory> {
    const historyEntry: InsertQuizResultHistory = {
      originalResultId: result.id,
      userId: result.userId,
      economicScore: result.economicScore,
      socialScore: result.socialScore,
      economicDimension: result.economicDimension,
      socialDimension: result.socialDimension,
      culturalDimension: result.culturalDimension,
      globalismDimension: result.globalismDimension,
      environmentalDimension: result.environmentalDimension,
      authorityDimension: result.authorityDimension,
      welfareDimension: result.welfareDimension,
      technocraticDimension: result.technocraticDimension,
      ideology: result.ideology,
      description: result.description,
      detailedAnalysis: result.detailedAnalysis,
      politicalValues: result.politicalValues,
      irishContextInsights: result.irishContextInsights,
    };
    
    const [history] = await db.insert(quizResultsHistory).values(historyEntry).returning();
    return history;
  }
  
  /**
   * Gets a user's active quiz result
   */
  async getUserActiveResult(userId: number): Promise<QuizResult | undefined> {
    const results = await db
      .select()
      .from(quizResults)
      .where(and(
        eq(quizResults.userId, userId),
        eq(quizResults.isActive, 1)
      ));
    
    return results[0];
  }
  
  /**
   * Gets a user's quiz result history
   */
  async getUserResultHistory(userId: number): Promise<QuizResultHistory[]> {
    return db
      .select()
      .from(quizResultsHistory)
      .where(eq(quizResultsHistory.userId, userId))
      .orderBy(desc(quizResultsHistory.archivedAt));
  }
  
  /**
   * Gets a quiz result by share code
   */
  async getResultByShareCode(shareCode: string): Promise<QuizResult | undefined> {
    const results = await db
      .select()
      .from(quizResults)
      .where(eq(quizResults.shareCode, shareCode));
    
    return results[0];
  }
  
  /**
   * Generates a random share code
   */
  private generateShareCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const codeLength = 12;
    let code = '';
    
    for (let i = 0; i < codeLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }
    
    return code;
  }
  
  /**
   * Calculate changes between current and previous quiz results
   */
  async calculateProfileChanges(userId: number): Promise<any | null> {
    const currentResult = await this.getUserActiveResult(userId);
    if (!currentResult) return null;
    
    const historyResults = await this.getUserResultHistory(userId);
    if (historyResults.length === 0) return null;
    
    const previousResult = historyResults[0]; // Most recent history entry
    
    // Calculate changes in each dimension
    const changes = {
      economic: this.calculateChange(currentResult.economicDimension, previousResult.economicDimension),
      social: this.calculateChange(currentResult.socialDimension, previousResult.socialDimension),
      cultural: this.calculateChange(currentResult.culturalDimension, previousResult.culturalDimension),
      globalism: this.calculateChange(currentResult.globalismDimension, previousResult.globalismDimension),
      environmental: this.calculateChange(currentResult.environmentalDimension, previousResult.environmentalDimension),
      authority: this.calculateChange(currentResult.authorityDimension, previousResult.authorityDimension),
      welfare: this.calculateChange(currentResult.welfareDimension, previousResult.welfareDimension),
      technocratic: this.calculateChange(currentResult.technocraticDimension, previousResult.technocraticDimension),
      timeSinceLastQuiz: this.calculateTimeDifference(currentResult.createdAt, previousResult.archivedAt),
    };
    
    return {
      changes,
      current: this.extractDimensions(currentResult),
      previous: this.extractDimensions(previousResult),
      previousTimestamp: previousResult.archivedAt,
    };
  }
  
  /**
   * Calculate the difference between two scores
   */
  private calculateChange(current: number | null, previous: number | null): number | null {
    if (current === null || previous === null) return null;
    return Number(current) - Number(previous);
  }
  
  /**
   * Extract dimensions from a quiz result
   */
  private extractDimensions(result: QuizResult | QuizResultHistory): any {
    return {
      economic: result.economicDimension,
      social: result.socialDimension,
      cultural: result.culturalDimension,
      globalism: result.globalismDimension,
      environmental: result.environmentalDimension,
      authority: result.authorityDimension,
      welfare: result.welfareDimension,
      technocratic: result.technocraticDimension,
    };
  }
  
  /**
   * Calculate the time difference between two dates
   */
  private calculateTimeDifference(current: Date, previous: Date): string {
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;
    const msPerYear = msPerDay * 365;

    const elapsed = current.getTime() - previous.getTime();

    if (elapsed < msPerMinute) {
      return Math.round(elapsed/1000) + ' seconds ago';   
    } else if (elapsed < msPerHour) {
      return Math.round(elapsed/msPerMinute) + ' minutes ago';   
    } else if (elapsed < msPerDay ) {
      return Math.round(elapsed/msPerHour) + ' hours ago';   
    } else if (elapsed < msPerMonth) {
      return Math.round(elapsed/msPerDay) + ' days ago';   
    } else if (elapsed < msPerYear) {
      return Math.round(elapsed/msPerMonth) + ' months ago';   
    } else {
      return Math.round(elapsed/msPerYear) + ' years ago';   
    }
  }
}

// Create an instance for use throughout the application
export const quizResultsService = new QuizResultsService();