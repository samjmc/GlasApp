/**
 * Promise Verification Job
 * 
 * BIAS PROTECTION SYSTEM
 * Checks if political promises/announcements were actually delivered
 * Rewards delivery, penalizes broken promises
 * 
 * Runs monthly to verify promises that are due
 */

import cron from 'node-cron';
import { supabaseDb } from '../db';
import { OutcomesTrackingService } from '../services/outcomesTrackingService';

export class PromiseVerificationJob {
  private isRunning: boolean = false;
  
  /**
   * Start the cron job
   * Runs on the 1st of every month at 4:00 AM
   */
  start() {
    console.log('📅 Promise verification job scheduled (monthly on 1st at 4:00 AM)');
    
    // Run on 1st of every month at 4:00 AM
    cron.schedule('0 4 1 * *', async () => {
      await this.execute();
    }, {
      timezone: 'Europe/Dublin'
    });
  }
  
  /**
   * Execute promise verification
   */
  async execute(): Promise<{
    promisesChecked: number;
    delivered: number;
    partial: number;
    broken: number;
    scoresAdjusted: number;
  }> {
    
    if (this.isRunning) {
      console.log('⚠️  Promise verification already running, skipping...');
      return { promisesChecked: 0, delivered: 0, partial: 0, broken: 0, scoresAdjusted: 0 };
    }
    
    this.isRunning = true;
    
    try {
      console.log('\n📋 ========================================');
      console.log('🔍 STARTING PROMISE VERIFICATION');
      console.log(`📅 ${new Date().toLocaleString('en-IE')}`);
      console.log('==========================================\n');
      
      if (!supabaseDb) {
        console.log('❌ Database not connected');
        return { promisesChecked: 0, delivered: 0, partial: 0, broken: 0, scoresAdjusted: 0 };
      }
      
      // Get promises that are due for checking
      const today = new Date().toISOString().split('T')[0];
      
      const { data: promises, error } = await supabaseDb
        .from('policy_promises')
        .select('*')
        .eq('status', 'pending')
        .lte('next_check_date', today)
        .limit(50);  // Process 50 per run
      
      if (error || !promises || promises.length === 0) {
        console.log('✅ No promises due for verification\n');
        return { promisesChecked: 0, delivered: 0, partial: 0, broken: 0, scoresAdjusted: 0 };
      }
      
      console.log(`📋 Found ${promises.length} promises to verify\n`);
      
      const stats = {
        promisesChecked: 0,
        delivered: 0,
        partial: 0,
        broken: 0,
        scoresAdjusted: 0
      };
      
      for (const promise of promises) {
        try {
          console.log(`\n📋 Promise #${promise.id}: ${promise.politician_name}`);
          console.log(`   Announced: ${promise.announced_date}`);
          console.log(`   Promise: "${promise.promise_text.substring(0, 80)}..."`);
          
          // Verify if promise was delivered
          const verification = await OutcomesTrackingService.verifyPromiseOutcome(promise.id);
          
          stats.promisesChecked++;
          
          if (verification.delivered) {
            stats.delivered++;
            console.log(`   ✅ DELIVERED - Bonus: +${verification.score_adjustment} points`);
          } else if (promise.status === 'partial') {
            stats.partial++;
            console.log(`   ⚠️  PARTIALLY DELIVERED - Adjustment: ${verification.score_adjustment} points`);
          } else {
            stats.broken++;
            console.log(`   ❌ NOT DELIVERED - Penalty: ${verification.score_adjustment} points`);
          }
          
          stats.scoresAdjusted++;
          
          // Rate limiting
          await sleep(3000);  // 3 seconds between verifications
          
        } catch (error: any) {
          console.error(`   ❌ Error verifying promise ${promise.id}: ${error.message}`);
        }
      }
      
      console.log('\n==========================================');
      console.log('✅ PROMISE VERIFICATION COMPLETE');
      console.log('==========================================');
      console.log(`📊 Statistics:`);
      console.log(`   Promises checked: ${stats.promisesChecked}`);
      console.log(`   Delivered: ${stats.delivered} ✅`);
      console.log(`   Partially delivered: ${stats.partial} ⚠️`);
      console.log(`   Broken: ${stats.broken} ❌`);
      console.log(`   Scores adjusted: ${stats.scoresAdjusted}`);
      console.log('==========================================\n');
      
      return stats;
      
    } catch (error: any) {
      console.error('❌ Promise verification failed:', error);
      return { promisesChecked: 0, delivered: 0, partial: 0, broken: 0, scoresAdjusted: 0 };
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Trigger manual verification
   */
  async triggerManual(): Promise<any> {
    console.log('🔄 Manual promise verification triggered');
    return await this.execute();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export singleton
export const promiseVerificationJob = new PromiseVerificationJob();

