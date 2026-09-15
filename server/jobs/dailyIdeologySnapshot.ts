/**
 * Daily Ideology Snapshot Job
 * Runs once per day to capture ideology profiles for all users
 * Enables accurate time-series visualization
 */

import { IdeologySnapshotService } from '../services/ideologySnapshotService.js';

async function runDailySnapshot() {
  console.log('\n================================');
  console.log('📸 DAILY IDEOLOGY SNAPSHOT JOB');
  console.log('================================\n');

  try {
    const stats = await IdeologySnapshotService.createAllSnapshots();

    console.log('\n📊 Snapshot Summary:');
    console.log(`   ✓ Snapshots created: ${stats.created}`);
    console.log(`   ✗ Errors: ${stats.errors}`);
    console.log('================================\n');

    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error: unknown) {
    console.error('❌ Daily snapshot job failed:', error instanceof Error ? error.message : String(error));
    console.error(error instanceof Error ? error.stack : undefined);
    process.exit(1);
  }
}

runDailySnapshot();


