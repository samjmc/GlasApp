/**
 * Professional Polling Dashboard
 * Displays latest Irish opinion polls
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
import { TrendingUp, TrendingDown, Minus, BarChart3, Calendar, AlertCircle } from 'lucide-react';

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

interface PollData {
  party_name: string;
  first_preference: number;
  poll_date: string;
  source_name: string;
  support_30d_change: number;
}

// Official Irish party colors
const PARTY_COLORS: { [key: string]: string } = {
  'Sinn Féin': '#326937',
  'Fine Gael': '#0051A1',
  'Fianna Fáil': '#66BB6A',
  'Labour Party': '#D32F2F',
  'Green Party': '#66BB6A',
  'Social Democrats': '#7B1FA2',
  'People Before Profit-Solidarity': '#E64A19',
  'Aontú': '#8D6E63',
};

export default function PollingDashboard() {
  const [pollData, setPollData] = useState<PollData[]>([]);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Loading polling data from cache...');

      // Query only the cache table - it has all the data we need
      const { data: cacheData, error: cacheError } = await supabase
        .from('polling_aggregates_cache')
        .select('*')
        .eq('entity_type', 'party')
        .order('latest_support', { ascending: false });

      console.log('Cache query result:', { cacheData, cacheError });

      if (cacheError) {
        console.error('Cache error:', cacheError);
        throw new Error(`Database error: ${cacheError.message}`);
      }

      if (!cacheData || cacheData.length === 0) {
        throw new Error('No polling data found in cache');
      }

      // Format the data
      const formattedData: PollData[] = cacheData.map((item: any) => ({
        party_name: item.entity_name,
        first_preference: parseFloat(item.latest_support || '0'),
        poll_date: item.latest_poll_date,
        source_name: item.latest_poll_source || 'Unknown',
        support_30d_change: parseFloat(item.support_30d_change || '0')
      }));

      console.log('✅ Formatted data:', formattedData);
      setPollData(formattedData);

      // Load historical chart
      await loadHistoricalChart();

    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error occurred';
      console.error('❌ Dashboard error:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoricalChart() {
    try {
      const { data: timeSeries, error: timeError } = await supabase
        .from('polling_time_series')
        .select('entity_name, period_end, mean_support')
        .eq('entity_type', 'party')
        .eq('granularity', 'month')
        .order('period_end', { ascending: true });

      console.log('Time series:', { timeSeries, timeError });

      if (timeError || !timeSeries || timeSeries.length === 0) {
        console.warn('No historical data available');
        return;
      }

      // Group by party
      const parties: { [key: string]: any[] } = {};
      timeSeries.forEach(record => {
        if (!parties[record.entity_name]) {
          parties[record.entity_name] = [];
        }
        parties[record.entity_name].push(record);
      });

      // Get unique dates
      const dates = [...new Set(timeSeries.map(r => r.period_end))].sort();

      // Create chart datasets
      const datasets = Object.entries(parties).map(([partyName, data]) => {
        const color = PARTY_COLORS[partyName] || '#9E9E9E';

        return {
          label: partyName,
          data: dates.map(date => {
            const record = data.find(r => r.period_end === date);
            return record ? parseFloat(record.mean_support) : null;
          }),
          borderColor: color,
          backgroundColor: color + '40',
          borderWidth: 3,
          tension: 0.4,
          fill: false,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        };
      });

      setHistoricalData({
        labels: dates.map(d => new Date(d).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })),
        datasets
      });

      console.log('✅ Historical chart loaded');

    } catch (error) {
      console.error('Historical chart error:', error);
    }
  }

  const getTrendIcon = (change: number) => {
    if (Math.abs(change) < 0.3) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    return change > 0 ? 
      <TrendingUp className="w-4 h-4 text-green-500" /> : 
      <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getPartyColor = (partyName: string) => {
    return PARTY_COLORS[partyName] || '#9E9E9E';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading polling data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 max-w-2xl w-full">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-900 mb-2 text-center">Error Loading Data</h2>
          <p className="text-red-700 text-center mb-4">{error}</p>
          <div className="bg-red-100 rounded-lg p-4 text-sm text-red-900 mb-4">
            <p className="font-bold mb-2">Troubleshooting Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Stop your development server (Ctrl+C)</li>
              <li>Restart it: <code className="bg-red-200 px-2 py-1 rounded">npm run dev</code></li>
              <li>Hard refresh browser: <code className="bg-red-200 px-2 py-1 rounded">Ctrl+Shift+R</code></li>
              <li>Clear browser cache if needed</li>
            </ol>
          </div>
          <button
            onClick={loadDashboardData}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors mt-4 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!pollData || pollData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-yellow-900 mb-2 text-center">No Polling Data</h2>
          <p className="text-yellow-700 text-center">No polling data is currently available.</p>
        </div>
      </div>
    );
  }

  const latestPollDate = pollData[0]?.poll_date;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <BarChart3 className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold">Irish Opinion Polls</h1>
          </div>
          <p className="text-xl text-blue-100 mb-6">
            Real-time tracking of political party support across Ireland
          </p>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>Last updated: {latestPollDate ? new Date(latestPollDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <span>{pollData.length} parties tracked</span>
            </div>
          </div>
        </div>

        {/* Party Cards Grid */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Current Party Support</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pollData.map((party, index) => {
              const color = getPartyColor(party.party_name);
              const isTop3 = index < 3;
              
              return (
                <div
                  key={party.party_name}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${
                    isTop3 ? 'ring-2 ring-yellow-400' : ''
                  }`}
                >
                  {/* Color bar */}
                  <div className="h-2" style={{ backgroundColor: color }} />
                  
                  <div className="p-6 relative">
                    {/* Top 3 badge */}
                    {isTop3 && (
                      <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                        #{index + 1}
                      </div>
                    )}
                    
                    {/* Party name */}
                    <h3 className="font-bold text-lg mb-4 text-gray-800 pr-8">
                      {party.party_name}
                    </h3>

                    {/* Support percentage */}
                    <div className="mb-4">
                      <div className="text-5xl font-black mb-2" style={{ color }}>
                        {party.first_preference.toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-500">
                        {party.source_name}
                      </p>
                    </div>

                    {/* 30-day trend */}
                    {party.support_30d_change !== undefined && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(party.support_30d_change)}
                          <span className="text-sm font-medium text-gray-700">30-day</span>
                        </div>
                        <span className={`text-sm font-bold ${
                          party.support_30d_change > 0 ? 'text-green-600' : 
                          party.support_30d_change < 0 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {party.support_30d_change > 0 ? '+' : ''}{party.support_30d_change.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historical Chart */}
        {historicalData && (
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Historical Trends</h2>
            
            <div className="h-80 md:h-96">
              <Line
                data={historicalData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                      labels: {
                        padding: 15,
                        font: {
                          size: 12,
                          weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8
                      }
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      padding: 12,
                      titleFont: {
                        size: 14,
                        weight: 'bold'
                      },
                      bodyFont: {
                        size: 13
                      },
                      callbacks: {
                        label: function(context: any) {
                          return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 35,
                      ticks: {
                        callback: function(value) {
                          return value + '%';
                        },
                        font: {
                          size: 11
                        }
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                      },
                      title: {
                        display: true,
                        text: 'Support (%)',
                        font: {
                          size: 13,
                          weight: 'bold'
                        }
                      }
                    },
                    x: {
                      ticks: {
                        font: {
                          size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                      },
                      grid: {
                        display: false
                      }
                    }
                  },
                  interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-10">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-2xl font-bold text-gray-800">Latest Poll Results</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">
                    Party
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">
                    Support
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">
                    30d Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pollData.map((poll) => {
                  const color = getPartyColor(poll.party_name);
                  return (
                    <tr key={poll.party_name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-1 h-10 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-semibold text-gray-900">
                            {poll.party_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className="text-2xl font-bold"
                          style={{ color }}
                        >
                          {poll.first_preference.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(poll.support_30d_change)}
                          <span className={`font-semibold ${
                            poll.support_30d_change > 0 ? 'text-green-600' : 
                            poll.support_30d_change < 0 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {poll.support_30d_change > 0 ? '+' : ''}{poll.support_30d_change.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {poll.source_name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-3">About This Data</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Polling data from reputable Irish polling sources</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Latest poll: {latestPollDate ? new Date(latestPollDate).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Trends calculated using weighted moving averages</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Typical margin of error: ±3% at 95% confidence level</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
