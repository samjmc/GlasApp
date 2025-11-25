/**
 * Polling Data Aggregation Service
 * 
 * Calculates time series, trends, correlations, and predictions
 * from raw polling data.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PollRecord {
  poll_date: string;
  first_preference: number;
  vote_share: number;
  source_reliability: number;
}

interface TimeSeriesResult {
  entity_type: string;
  entity_id: number;
  entity_name: string;
  period_start: string;
  period_end: string;
  granularity: string;
  mean_support: number;
  median_support: number;
  std_dev: number;
  min_support: number;
  max_support: number;
  poll_count: number;
  linear_trend: number;
  momentum: string;
  volatility: number;
  trend_direction: string;
  confidence_level: number;
  data_quality_score: number;
}

/**
 * Calculate time series aggregations for a party
 */
export async function calculatePartyTimeSeries(
  partyId: number,
  partyName: string,
  startDate: Date,
  endDate: Date,
  granularity: 'week' | 'month' | 'quarter' = 'month'
): Promise<TimeSeriesResult | null> {
  try {
    // Fetch polls for this party in date range
    const { data: polls, error } = await supabase
      .from('poll_party_results')
      .select(`
        first_preference,
        vote_share,
        polls!inner (
          poll_date,
          poll_sources!inner (
            reliability_score
          )
        )
      `)
      .eq('party_id', partyId)
      .gte('polls.poll_date', startDate.toISOString().split('T')[0])
      .lte('polls.poll_date', endDate.toISOString().split('T')[0])
      .order('polls.poll_date', { ascending: true });

    if (error || !polls || polls.length === 0) {
      console.log(`No polls found for party ${partyName}`);
      return null;
    }

    // Extract data
    const values = polls.map(p => p.first_preference || p.vote_share);
    const dates = polls.map(p => new Date((p.polls as any).poll_date));
    const reliabilities = polls.map(p => (p.polls as any).poll_sources?.reliability_score || 0.8);

    // Calculate statistics
    const stats = calculateStatistics(values, dates, reliabilities);

    // Determine trend momentum
    const momentum = calculateMomentum(values, dates);
    const trendDirection = stats.linear_trend > 0.05 ? 'rising' : 
                          stats.linear_trend < -0.05 ? 'falling' : 'stable';

    // Calculate confidence based on sample size and consistency
    const confidence = Math.min(1.0, polls.length / 12) * (1 - stats.volatility / 100);

    const result: TimeSeriesResult = {
      entity_type: 'party',
      entity_id: partyId,
      entity_name: partyName,
      period_start: startDate.toISOString().split('T')[0],
      period_end: endDate.toISOString().split('T')[0],
      granularity,
      mean_support: stats.mean,
      median_support: stats.median,
      std_dev: stats.stdDev,
      min_support: stats.min,
      max_support: stats.max,
      poll_count: polls.length,
      linear_trend: stats.linear_trend,
      momentum,
      volatility: stats.volatility,
      trend_direction: trendDirection,
      confidence_level: confidence,
      data_quality_score: calculateDataQuality(polls.length, stats.volatility)
    };

    // Insert or update in database
    await supabase
      .from('polling_time_series')
      .upsert(result, {
        onConflict: 'entity_type,entity_id,period_start,period_end,granularity'
      });

    return result;
  } catch (error) {
    console.error('Error calculating party time series:', error);
    return null;
  }
}

/**
 * Calculate statistical measures
 */
function calculateStatistics(
  values: number[],
  dates: Date[],
  reliabilities: number[]
): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  linear_trend: number;
  volatility: number;
} {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, linear_trend: 0, volatility: 0 };
  }

  // Weighted mean (by reliability)
  const weightedSum = values.reduce((sum, val, i) => sum + val * reliabilities[i], 0);
  const totalWeight = reliabilities.reduce((sum, r) => sum + r, 0);
  const mean = weightedSum / totalWeight;

  // Median
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  // Standard deviation
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Min/Max
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Linear trend (slope of regression line)
  const linear_trend = calculateLinearTrend(values, dates);

  // Volatility (coefficient of variation)
  const volatility = mean > 0 ? (stdDev / mean) * 100 : 0;

  return { mean, median, stdDev, min, max, linear_trend, volatility };
}

/**
 * Calculate linear trend (percentage points per day)
 */
function calculateLinearTrend(values: number[], dates: Date[]): number {
  if (values.length < 2) return 0;

  // Convert dates to days since first date
  const firstDate = dates[0].getTime();
  const x = dates.map(d => (d.getTime() - firstDate) / (1000 * 60 * 60 * 24));
  const y = values;

  // Calculate slope using least squares
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  return slope;
}

/**
 * Calculate momentum (accelerating/decelerating)
 */
function calculateMomentum(values: number[], dates: Date[]): string {
  if (values.length < 6) return 'insufficient_data';

  // Split into two halves and compare trends
  const midpoint = Math.floor(values.length / 2);
  const firstHalfValues = values.slice(0, midpoint);
  const firstHalfDates = dates.slice(0, midpoint);
  const secondHalfValues = values.slice(midpoint);
  const secondHalfDates = dates.slice(midpoint);

  const firstTrend = calculateLinearTrend(firstHalfValues, firstHalfDates);
  const secondTrend = calculateLinearTrend(secondHalfValues, secondHalfDates);

  const trendDiff = secondTrend - firstTrend;

  if (Math.abs(trendDiff) < 0.01) return 'stable';
  return trendDiff > 0 ? 'accelerating' : 'decelerating';
}

/**
 * Calculate data quality score (0-100)
 */
function calculateDataQuality(pollCount: number, volatility: number): number {
  // More polls = higher quality
  const sampleQuality = Math.min(100, (pollCount / 12) * 100);

  // Lower volatility = higher quality
  const stabilityQuality = Math.max(0, 100 - volatility * 2);

  // Combined score
  return Math.round((sampleQuality * 0.6 + stabilityQuality * 0.4));
}

/**
 * Calculate correlation between polling and performance scores
 */
export async function calculatePollPerformanceCorrelation(
  entityType: 'party' | 'td',
  entityId: number,
  entityName: string,
  periodMonths: number = 6
): Promise<void> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    // Get polling data
    const tableName = entityType === 'party' ? 'poll_party_results' : 'poll_td_results';
    const { data: polls } = await supabase
      .from(tableName)
      .select(`
        ${entityType === 'party' ? 'first_preference' : 'approval_rating'},
        polls!inner (poll_date)
      `)
      .eq(entityType === 'party' ? 'party_id' : 'td_id', entityId)
      .gte('polls.poll_date', startDate.toISOString().split('T')[0])
      .lte('polls.poll_date', endDate.toISOString().split('T')[0]);

    if (!polls || polls.length < 3) {
      console.log(`Insufficient polling data for ${entityName}`);
      return;
    }

    // Get performance scores (from td_scores or party_performance_scores)
    const performanceTable = entityType === 'party' ? 'party_performance_scores' : 'td_scores';
    const { data: performance } = await supabase
      .from(performanceTable)
      .select('overall_score, calculated_at')
      .eq(entityType === 'party' ? 'party_id' : 'id', entityId)
      .gte('calculated_at', startDate.toISOString())
      .lte('calculated_at', endDate.toISOString());

    if (!performance || performance.length === 0) {
      console.log(`No performance data for ${entityName}`);
      return;
    }

    // Calculate averages
    const pollValues = polls.map(p => entityType === 'party' ? p.first_preference : p.approval_rating);
    const pollAvg = pollValues.reduce((a, b) => a + b, 0) / pollValues.length;

    const perfValues = performance.map(p => parseFloat(p.overall_score || '50'));
    const perfAvg = perfValues.reduce((a, b) => a + b, 0) / perfValues.length;

    // Calculate correlation coefficient (simplified)
    const correlation = calculateCorrelation(pollValues, perfValues.slice(0, pollValues.length));

    // Determine correlation strength
    const absCorr = Math.abs(correlation);
    const strength = absCorr > 0.7 ? 'strong' :
                    absCorr > 0.4 ? 'moderate' : 'weak';
    const direction = correlation > 0 ? '_positive' : '_negative';

    // Calculate gap
    const gap = pollAvg - perfAvg;
    const gapDirection = gap > 5 ? 'polls_higher' :
                        gap < -5 ? 'performance_higher' : 'aligned';

    const gapInterpretation = gap > 10
      ? `${entityName} has significantly higher public support (${pollAvg.toFixed(1)}%) than their performance score (${perfAvg.toFixed(1)}).`
      : gap < -10
      ? `${entityName} performs better (${perfAvg.toFixed(1)}) than their public polling suggests (${pollAvg.toFixed(1)}%).`
      : `${entityName}'s polling (${pollAvg.toFixed(1)}%) aligns closely with their performance score (${perfAvg.toFixed(1)}).`;

    // Insert into database
    await supabase
      .from('poll_performance_correlation')
      .upsert({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate.toISOString().split('T')[0],
        period_months: periodMonths,
        poll_avg: pollAvg,
        performance_score_avg: perfAvg,
        correlation_coefficient: correlation,
        correlation_strength: strength + direction,
        p_value: 0.05, // Simplified
        gap: gap,
        gap_direction: gapDirection,
        gap_interpretation: gapInterpretation,
        poll_count: polls.length,
        data_quality: polls.length >= 6 ? 'high' : polls.length >= 3 ? 'medium' : 'low'
      }, {
        onConflict: 'entity_type,entity_id,period_start,period_end'
      });

    console.log(`✅ Calculated correlation for ${entityName}: ${correlation.toFixed(3)}`);
  } catch (error) {
    console.error(`Error calculating correlation for ${entityName}:`, error);
  }
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}

/**
 * Update polling aggregates cache for fast queries
 */
export async function updatePollingCache(
  entityType: 'party' | 'td',
  entityId: number,
  entityName: string
): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get latest poll
    const tableName = entityType === 'party' ? 'poll_party_results' : 'poll_td_results';
    const supportField = entityType === 'party' ? 'first_preference' : 'approval_rating';

    const { data: latestPoll } = await supabase
      .from(tableName)
      .select(`
        ${supportField},
        polls!inner (
          poll_date,
          poll_sources!inner (name)
        )
      `)
      .eq(entityType === 'party' ? 'party_id' : 'td_id', entityId)
      .order('polls.poll_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestPoll) return;

    // Get 30-day polls
    const { data: polls30d } = await supabase
      .from(tableName)
      .select(`${supportField}, polls!inner (poll_date)`)
      .eq(entityType === 'party' ? 'party_id' : 'td_id', entityId)
      .gte('polls.poll_date', thirtyDaysAgo.toISOString().split('T')[0]);

    // Get 90-day polls
    const { data: polls90d } = await supabase
      .from(tableName)
      .select(`${supportField}, polls!inner (poll_date)`)
      .eq(entityType === 'party' ? 'party_id' : 'td_id', entityId)
      .gte('polls.poll_date', ninetyDaysAgo.toISOString().split('T')[0]);

    // Get all-time stats
    const { data: allPolls } = await supabase
      .from(tableName)
      .select(`${supportField}, polls!inner (poll_date)`)
      .eq(entityType === 'party' ? 'party_id' : 'td_id', entityId);

    const values30d = polls30d?.map(p => p[supportField]) || [];
    const values90d = polls90d?.map(p => p[supportField]) || [];
    const allValues = allPolls?.map(p => p[supportField]) || [];

    const avg30d = values30d.length > 0 ? values30d.reduce((a, b) => a + b, 0) / values30d.length : 0;
    const avg90d = values90d.length > 0 ? values90d.reduce((a, b) => a + b, 0) / values90d.length : 0;

    const latestSupport = latestPoll[supportField];
    const change30d = avg30d > 0 ? latestSupport - avg30d : 0;
    const change90d = avg90d > 0 ? latestSupport - avg90d : 0;

    const allTimeHigh = allValues.length > 0 ? Math.max(...allValues) : 0;
    const allTimeLow = allValues.length > 0 ? Math.min(...allValues) : 0;

    const latestPollDate = new Date((latestPoll.polls as any).poll_date);
    const daysSinceLastPoll = Math.floor((now.getTime() - latestPollDate.getTime()) / (1000 * 60 * 60 * 24));

    const dataRecency = daysSinceLastPoll < 7 ? 'current' :
                        daysSinceLastPoll < 30 ? 'recent' :
                        daysSinceLastPoll < 90 ? 'stale' : 'no_data';

    // Update cache
    await supabase
      .from('polling_aggregates_cache')
      .upsert({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        latest_poll_date: latestPollDate.toISOString().split('T')[0],
        latest_support: latestSupport,
        latest_poll_source: (latestPoll.polls as any).poll_sources?.name,
        support_30d_avg: avg30d,
        support_30d_change: change30d,
        support_30d_trend: change30d > 1 ? 'rising' : change30d < -1 ? 'falling' : 'stable',
        support_90d_avg: avg90d,
        support_90d_change: change90d,
        support_90d_trend: change90d > 1 ? 'rising' : change90d < -1 ? 'falling' : 'stable',
        all_time_high: allTimeHigh,
        all_time_low: allTimeLow,
        total_polls: allPolls?.length || 0,
        last_poll_days_ago: daysSinceLastPoll,
        data_recency: dataRecency,
        last_updated: now.toISOString()
      }, {
        onConflict: 'entity_type,entity_id'
      });

    console.log(`✅ Updated polling cache for ${entityName}`);
  } catch (error) {
    console.error(`Error updating polling cache for ${entityName}:`, error);
  }
}

/**
 * Run full aggregation for all parties
 */
export async function aggregateAllParties(): Promise<void> {
  console.log('🔄 Starting full party polling aggregation...\n');

  try {
    // Get all parties
    const { data: parties } = await supabase
      .from('parties')
      .select('id, name');

    if (!parties) {
      console.log('No parties found');
      return;
    }

    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    for (const party of parties) {
      console.log(`\n📊 Processing ${party.name}...`);

      // Calculate 6-month time series
      await calculatePartyTimeSeries(party.id, party.name, sixMonthsAgo, now, 'month');

      // Calculate 1-year time series
      await calculatePartyTimeSeries(party.id, party.name, oneYearAgo, now, 'quarter');

      // Calculate correlation
      await calculatePollPerformanceCorrelation('party', party.id, party.name, 6);

      // Update cache
      await updatePollingCache('party', party.id, party.name);
    }

    console.log('\n✅ Party aggregation complete!');
  } catch (error) {
    console.error('Error in full aggregation:', error);
  }
}

























