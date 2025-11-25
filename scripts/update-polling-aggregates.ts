/**
 * Update Polling Aggregates
 * 
 * Calculates time series, trends, correlations, and updates cache
 */

import { aggregateAllParties } from '../server/services/pollingAggregationService';

async function main() {
  console.log('🔄 Starting polling aggregation service...\n');
  
  try {
    await aggregateAllParties();
    console.log('\n✅ Aggregation complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();























