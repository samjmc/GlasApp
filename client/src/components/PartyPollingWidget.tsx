/**
 * Party Polling Widget
 * 
 * Display polling data on party profile pages
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PartyPollingData {
  latest_support: number;
  latest_poll_date: string;
  latest_poll_source: string;
  support_30d_avg: number;
  support_30d_change: number;
  support_30d_trend: string;
  support_90d_avg: number;
  support_90d_change: number;
  all_time_high: number;
  all_time_high_date: string;
  all_time_low: number;
  total_polls: number;
  last_poll_days_ago: number;
  data_recency: string;
}

interface PollingWidgetProps {
  partyId: number;
  partyName: string;
  performanceScore?: number;
}

export function PartyPollingWidget({ partyId, partyName, performanceScore }: PollingWidgetProps) {
  const [pollingData, setPollingData] = useState<PartyPollingData | null>(null);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Decode URL-encoded party name
  const decodedPartyName = decodeURIComponent(partyName);

  useEffect(() => {
    if (decodedPartyName) {
      loadPollingData();
    }
  }, [decodedPartyName]);

  async function loadPollingData() {
    setLoading(true);

    try {
      console.log('Loading polling for party:', decodedPartyName);
      
      // Load from cache using decoded party name
      const { data: cache, error: cacheError } = await supabase
        .from('polling_aggregates_cache')
        .select('*')
        .eq('entity_type', 'party')
        .eq('entity_name', decodedPartyName)
        .maybeSingle();

      console.log('Cache result:', cache, cacheError);

      if (cache) {
        setPollingData(cache);
      }

      // Load historical data for mini chart using decoded party name
      const { data: timeSeries, error: timeError } = await supabase
        .from('polling_time_series')
        .select('*')
        .eq('entity_type', 'party')
        .eq('entity_name', decodedPartyName)
        .eq('granularity', 'month')
        .order('period_end', { ascending: true })
        .limit(12);

      console.log('Time series result:', timeSeries, timeError);

      if (timeSeries && timeSeries.length > 0) {
        setHistoricalData({
          labels: timeSeries.map(r => new Date(r.period_end).toLocaleDateString('en-IE', { month: 'short' })),
          datasets: [{
            label: 'Support',
            data: timeSeries.map(r => parseFloat(r.mean_support)),
            borderColor: '#3B82F6',
            backgroundColor: '#3B82F620',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5
          }]
        });
      }

    } catch (error) {
      console.error('Error loading polling data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!pollingData) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        No polling data available for {decodedPartyName}
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising': return '📈';
      case 'falling': return '📉';
      case 'stable': return '➡️';
      default: return '❔';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
        📊 Public Opinion Polling
      </h3>

      {/* Latest Poll - Prominent Display */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 mb-6 border-2 border-blue-200 dark:border-blue-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Latest Poll Support</div>
            <div className="text-5xl font-black text-blue-600 dark:text-blue-400 mb-3">
              {pollingData.latest_support?.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {pollingData.latest_poll_source}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {new Date(pollingData.latest_poll_date).toLocaleDateString('en-IE', { 
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })} ({pollingData.last_poll_days_ago} days ago)
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">30-Day Trend</div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getTrendIcon(pollingData.support_30d_trend)}</span>
              <div>
                <div className={`text-3xl font-black ${pollingData.support_30d_change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {pollingData.support_30d_change > 0 ? '+' : ''}{pollingData.support_30d_change?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">
                  {pollingData.support_30d_trend}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                30-day avg: <span className="font-semibold text-gray-900 dark:text-white">{pollingData.support_30d_avg?.toFixed(1)}%</span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                90-day avg: <span className="font-semibold text-gray-900 dark:text-white">{pollingData.support_90d_avg?.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Chart */}
      {historicalData && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-bold text-gray-900 dark:text-white mb-3">12-Month Polling Trend</div>
          <div className="h-48">
            <Line
              data={historicalData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                      label: (context) => `Support: ${context.parsed.y.toFixed(1)}%`
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `${value}%`,
                      font: {
                        size: 11
                      }
                    },
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    }
                  },
                  x: {
                    ticks: {
                      font: {
                        size: 11
                      }
                    },
                    grid: {
                      display: false
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">All-Time High</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{pollingData.all_time_high?.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {pollingData.all_time_high_date ? new Date(pollingData.all_time_high_date).toLocaleDateString('en-IE') : 'N/A'}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">All-Time Low</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{pollingData.all_time_low?.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {pollingData.all_time_low ? 'Tracked' : 'N/A'}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total Polls</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{pollingData.total_polls}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Since 2020
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data Status</div>
          <div className={`text-lg font-bold capitalize ${
            pollingData.data_recency === 'current' ? 'text-green-600 dark:text-green-400' :
            pollingData.data_recency === 'recent' ? 'text-blue-600 dark:text-blue-400' :
            pollingData.data_recency === 'stale' ? 'text-yellow-600 dark:text-yellow-400' :
            'text-gray-600 dark:text-gray-400'
          }`}>
            {pollingData.data_recency}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Quality
          </div>
        </div>
      </div>

      {/* View Full Rankings */}
      <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
        <a 
          href="/?tab=tds"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-sm transition-colors"
        >
          View Full Rankings
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export default PartyPollingWidget;



