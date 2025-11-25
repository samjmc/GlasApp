/**
 * Unified Score Calculation Job
 * 
 * Automatically recalculates all TD scores on a schedule
 * Runs daily at 7 AM to ensure fresh scores
 */

import cron from 'node-cron';
import { recalculateAllScores } from '../services/comprehensiveTDScoringService';
import { db } from '../db';
import { scoreCalculationLog } from '@shared/schema';

export class UnifiedScoreCalculationJob {
  private isRunning: boolean = false;
  
  /**
   * Start the cron job
   * Runs daily at 7:00 AM
   */
  start() {
    console.log('📅 Unified score calculation job scheduled (daily at 7:00 AM)');
    
    // Run every day at 7:00 AM
    cron.schedule('0 7 * * *', async () => {
      await this.execute();
    });
    
    // Also run on startup (for testing)
    if (process.env.RUN_SCORE_CALC_ON_STARTUP === 'true') {
      console.log('🚀 Running score calculation on startup...');
      setTimeout(() => this.execute(), 5000); // Wait 5s for DB to connect
    }
  }
  
  /**
   * Execute the score calculation
   */
  async execute(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Score calculation already running, skipping...');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting unified score recalculation...');
      
      // Log start
      const logId = await this.logCalculationStart();
      
      // Recalculate all scores
      const result = await recalculateAllScores();
      
      // Log completion
      await this.logCalculationComplete(logId, result);
      
      console.log(`✅ Score calculation complete:`);
      console.log(`   - TDs processed: ${result.processed}`);
      console.log(`   - Errors: ${result.errors}`);
      console.log(`   - Duration: ${(result.duration / 1000).toFixed(1)}s`);
      
      // Update rankings after calculation
      await this.updateRankings();
      
    } catch (error) {
      console.error('❌ Unified score calculation failed:', error);
      
      // Log error
      if (db) {
        await db.insert(scoreCalculationLog).values({
          calculationType: 'full_recalc',
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        });
      }
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Log calculation start
   */
  private async logCalculationStart(): Promise<number | null> {
    if (!db) return null;
    
    try {
      const [log] = await db.insert(scoreCalculationLog).values({
        calculationType: 'full_recalc',
        status: 'running',
        tdsAffected: 0
      }).returning({ id: scoreCalculationLog.id });
      
      return log.id;
    } catch (error) {
      console.error('Error logging calculation start:', error);
      return null;
    }
  }
  
  /**
   * Log calculation completion
   */
  private async logCalculationComplete(
    logId: number | null,
    result: { processed: number; errors: number; duration: number }
  ): Promise<void> {
    if (!db || !logId) return;
    
    try {
      await db
        .update(scoreCalculationLog)
        .set({
          status: result.errors === 0 ? 'completed' : 'completed_with_errors',
          tdsAffected: result.processed,
          durationMs: result.duration,
          completedAt: new Date()
        })
        .where(eq(scoreCalculationLog.id, logId));
    } catch (error) {
      console.error('Error logging calculation completion:', error);
    }
  }
  
  /**
   * Update national, constituency, and party rankings
   */
  private async updateRankings(): Promise<void> {
    if (!db) return;
    
    try {
      console.log('📊 Updating rankings...');
      
      // Get all scores ordered by overall score
      const allScores = await db
        .select()
        .from(unifiedTDScores)
        .orderBy(desc(unifiedTDScores.overallScore));
      
      // Update national ranks
      for (let i = 0; i < allScores.length; i++) {
        await db
          .update(unifiedTDScores)
          .set({ nationalRank: i + 1 })
          .where(eq(unifiedTDScores.id, allScores[i].id));
      }
      
      // Update constituency ranks (group by constituency)
      const constituencies = [...new Set(allScores.map(td => td.constituency))];
      
      for (const constituency of constituencies) {
        const constituencyTDs = allScores
          .filter(td => td.constituency === constituency)
          .sort((a, b) => parseFloat(b.overallScore) - parseFloat(a.overallScore));
        
        for (let i = 0; i < constituencyTDs.length; i++) {
          await db
            .update(unifiedTDScores)
            .set({ constituencyRank: i + 1 })
            .where(eq(unifiedTDScores.id, constituencyTDs[i].id));
        }
      }
      
      // Update party ranks (group by party)
      const parties = [...new Set(allScores.filter(td => td.party).map(td => td.party!))];
      
      for (const party of parties) {
        const partyTDs = allScores
          .filter(td => td.party === party)
          .sort((a, b) => parseFloat(b.overallScore) - parseFloat(a.overallScore));
        
        for (let i = 0; i < partyTDs.length; i++) {
          await db
            .update(unifiedTDScores)
            .set({ partyRank: i + 1 })
            .where(eq(unifiedTDScores.id, partyTDs[i].id));
        }
      }
      
      console.log('✅ Rankings updated');
      
    } catch (error) {
      console.error('Error updating rankings:', error);
    }
  }
  
  /**
   * Trigger manual recalculation (for admin use)
   */
  async triggerManual(): Promise<void> {
    console.log('🔄 Manual score recalculation triggered');
    await this.execute();
  }
}

// Export singleton instance
export const unifiedScoreJob = new UnifiedScoreCalculationJob();

