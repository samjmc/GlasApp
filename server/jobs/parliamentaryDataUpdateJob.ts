/**
 * Parliamentary Data Update Job
 * Fetches latest data from Oireachtas API and updates parliamentary scores
 * 
 * Runs weekly to keep parliamentary activity data fresh
 */

import cron from 'node-cron';
import { OireachtasAPIService } from '../services/oireachtasAPIService';
import fs from 'fs';
import path from 'path';
import { supabaseDb } from '../db';

export class ParliamentaryDataUpdateJob {
  private isRunning: boolean = false;
  
  /**
   * Start the cron job
   * Runs every Sunday at 3:00 AM
   */
  start() {
    console.log('📅 Parliamentary data update job scheduled (weekly on Sunday at 3:00 AM)');
    
    // Run every Sunday at 3:00 AM Irish time
    cron.schedule('0 3 * * 0', async () => {
      await this.execute();
    }, {
      timezone: 'Europe/Dublin'
    });
    
    // Also run on startup if flag set
    if (process.env.UPDATE_PARLIAMENTARY_ON_STARTUP === 'true') {
      console.log('🚀 Running parliamentary update on startup...');
      setTimeout(() => this.execute(), 10000); // Wait 10s for services to init
    }
  }
  
  /**
   * Execute the parliamentary data update
   */
  async execute(): Promise<{
    tdsProcessed: number;
    errors: number;
    duration: number;
  }> {
    if (this.isRunning) {
      console.log('⚠️  Parliamentary update already running, skipping...');
      return { tdsProcessed: 0, errors: 0, duration: 0 };
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('\n🏛️ ========================================');
      console.log('📊 STARTING PARLIAMENTARY DATA UPDATE');
      console.log(`📅 ${new Date().toLocaleString('en-IE')}`);
      console.log('==========================================\n');
      
      // Fetch all member activity from Oireachtas API
      const activityData = await OireachtasAPIService.fetchAllMemberActivity();
      
      console.log(`\n📊 Fetched data for ${activityData.size} TDs`);
      
      // Save to JSON file (for backward compatibility)
      await this.saveToJSONFile(activityData);

      // Update database (if available)
      await this.updateDatabase(activityData);

      // Feed the scoring module's parliamentary pillar, then recalculate.
      const scoringRows = await this.buildScoringRows(activityData);
      const { repository, recalculateAll } = await import('../scoring/index.js');
      const written = await repository.updateParliamentaryActivity(scoringRows);
      console.log(`\n📊 Parliamentary inputs written for ${written} TD(s)`);
      console.log('🔄 Recalculating TD scores...');
      await recalculateAll();
      
      const duration = Date.now() - startTime;
      
      console.log('\n==========================================');
      console.log('✅ PARLIAMENTARY DATA UPDATE COMPLETE');
      console.log('==========================================');
      console.log(`📊 Statistics:`);
      console.log(`   TDs processed: ${activityData.size}`);
      console.log(`   Duration: ${Math.round(duration / 1000)}s`);
      console.log('==========================================\n');
      
      return {
        tdsProcessed: activityData.size,
        errors: 0,
        duration
      };
      
    } catch (error: unknown) {
      console.error('❌ Parliamentary data update failed:', error);
      return {
        tdsProcessed: 0,
        errors: 1,
        duration: Date.now() - startTime
      };
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Save activity data to JSON file
   */
  private async saveToJSONFile(activityData: Map<string, any>): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'parliamentary-activity.json');
      const dataDir = path.dirname(dataPath);
      
      // Ensure directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Convert Map to object
      const dataObject: Record<string, any> = {};
      activityData.forEach((value, key) => {
        dataObject[key] = value;
      });
      
      // Save to file
      fs.writeFileSync(dataPath, JSON.stringify(dataObject, null, 2), 'utf8');
      
      console.log(`✅ Saved to ${dataPath}`);
      
    } catch (error: unknown) {
      console.error('❌ Failed to save JSON file:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Update database with parliamentary activity
   */
  private async updateDatabase(activityData: Map<string, any>): Promise<void> {
    if (!supabaseDb) {
      console.log('⚠️  Supabase not connected - skipping database update');
      return;
    }
    
    try {
      console.log('💾 Updating database with parliamentary data...');
      
      let updated = 0;
      
      for (const [, data] of Array.from(activityData)) {
        try {
          // Update or insert parliamentary activity
          const { error } = await supabaseDb
            .from('parliamentary_activity')
            .upsert({
              politician_name: data.fullName,
              member_id: data.memberId,
              member_code: data.memberCode,
              party: data.party,
              constituency: data.constituency,
              questions_asked: data.questionsAsked,
              oral_questions: data.oralQuestions,
              written_questions: data.writtenQuestions,
              debates: data.debates,
              votes: data.votes,
              estimated_attendance: data.estimatedAttendance,
              last_active: data.lastActive,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'politician_name'
            });
          
          if (error) {
            console.error(`   ❌ Error updating ${data.fullName}:`, error.message);
          } else {
            updated++;
          }
          
        } catch (error: unknown) {
          console.error(`   ❌ Error processing ${data.fullName}:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      console.log(`✅ Updated ${updated} TDs in database`);
      
    } catch (error: unknown) {
      console.error('❌ Database update failed:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Build the rows the scoring module's parliamentary pillar reads.
   *
   * Question counts come from the API's own totals and are used as-is. Attendance is
   * recomputed from divisions (votes cast / divisions held). The activity feed's
   * `estimatedAttendance` is NOT used: it is debate count over an assumed 100 sitting
   * days, which is a proxy, not attendance, and the pillar is 30% of a TD's score.
   * When it cannot be measured the value stays null and the pillar falls back to
   * questions alone rather than scoring a guess.
   */
  private async buildScoringRows(
    activityData: Map<string, any>
  ): Promise<Array<{ memberCode: string; questionsOral: number | null; questionsWritten: number | null; attendancePct: number | null }>> {
    const rows = [];
    for (const [, data] of Array.from(activityData)) {
      if (!data?.memberCode) continue;
      let attendancePct: number | null = null;
      try {
        const voting = await OireachtasAPIService.calculateVotingAttendance(data.memberCode);
        if (voting.totalVotes > 0) attendancePct = voting.votingAttendance;
      } catch {
        // Leave null: unknown attendance must not read as zero attendance.
      }
      rows.push({
        memberCode: data.memberCode,
        questionsOral: typeof data.oralQuestions === 'number' ? data.oralQuestions : null,
        questionsWritten: typeof data.writtenQuestions === 'number' ? data.writtenQuestions : null,
        attendancePct,
      });
    }
    return rows;
  }

  /**
   * Trigger manual update (for admin use)
   */
  async triggerManual(): Promise<unknown> {
    console.log('🔄 Manual parliamentary update triggered');
    return await this.execute();
  }
}

// Export singleton instance
/** Singleton job for updating parliamentary data. */
export const parliamentaryDataJob = new ParliamentaryDataUpdateJob();

