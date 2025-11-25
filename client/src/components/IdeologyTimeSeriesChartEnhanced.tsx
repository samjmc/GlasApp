import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Download, Calendar, Users, BarChart3, Filter, X } from 'lucide-react';
import html2canvas from 'html2canvas';

interface TimelineDataPoint {
  date: string;
  dateLabel: string;
  economic: number;
  social: number;
  cultural: number;
  authority: number;
  environmental: number;
  welfare: number;
  globalism: number;
  technocratic: number;
  sessionCount?: number;
}

interface Event {
  date: string;
  type: string;
  label: string;
  icon: string;
  dimension?: string;
  magnitude?: number;
}

interface Comparison {
  type: 'party' | 'average';
  name: string;
  data: Record<string, number>;
}

interface IdeologyTimeSeriesChartEnhancedProps {
  userId: string;
  initialWeeks?: number;
}

const DIMENSION_COLORS = {
  economic: '#3B82F6',
  social: '#8B5CF6',
  cultural: '#EC4899',
  authority: '#EF4444',
  environmental: '#10B981',
  welfare: '#F59E0B',
  globalism: '#06B6D4',
  technocratic: '#6366F1',
};

const DIMENSION_LABELS = {
  economic: 'Economic',
  social: 'Social',
  cultural: 'Cultural',
  authority: 'Authority',
  environmental: 'Environmental',
  welfare: 'Welfare',
  globalism: 'Globalism',
  technocratic: 'Governance',
};

const PARTIES = [
  'Fianna Fáil', 'Fine Gael', 'Sinn Féin', 'Green Party',
  'Labour Party', 'Social Democrats', 'People Before Profit-Solidarity',
  'Aontú', 'Independent'
];

export default function IdeologyTimeSeriesChartEnhanced({
  userId,
  initialWeeks = 12
}: IdeologyTimeSeriesChartEnhancedProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingSnapshots, setUsingSnapshots] = useState(false);
  
  // UI state
  const [selectedDimensions, setSelectedDimensions] = useState<Set<string>>(
    new Set(['economic', 'social', 'authority'])
  );
  const [weeks, setWeeks] = useState(initialWeeks);
  const [compareParty, setCompareParty] = useState<string>('');
  const [compareAverage, setCompareAverage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchTimeline();
  }, [userId, weeks, compareParty, compareAverage, fromDate, toDate]);

  async function fetchTimeline() {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        weeks: weeks.toString(),
      });

      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (compareParty) params.append('compareParty', compareParty);
      if (compareAverage) params.append('compareAverage', 'true');

      const response = await fetch(`/api/ideology-timeline/${userId}?${params}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load ideology timeline');
      }

      setTimeline(data.timeline || []);
      setEvents(data.events || []);
      setComparison(data.comparison || null);
      setUsingSnapshots(data.usingSnapshots || false);
    } catch (err: any) {
      console.error('Error loading ideology timeline:', err);
      setError(err.message || 'Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }

  const toggleDimension = (dimension: string) => {
    setSelectedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimension)) {
        if (next.size > 1) next.delete(dimension); // Keep at least 1 dimension
      } else {
        next.add(dimension);
      }
      return next;
    });
  };

  const exportCSV = () => {
    window.location.href = `/api/ideology-timeline/${userId}?format=csv&weeks=${weeks}`;
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify({ timeline, events, comparison }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ideology-timeline-${userId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `ideology-timeline-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (err) {
      console.error('Error exporting PNG:', err);
    }
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setCompareParty('');
    setCompareAverage(false);
    setWeeks(initialWeeks);
  };

  const setQuickFilter = (filter: 'month' | 'quarter' | 'all') => {
    const now = new Date();
    setToDate('');
    
    switch (filter) {
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setFromDate(monthAgo.toISOString().split('T')[0]);
        break;
      case 'quarter':
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        setFromDate(quarterAgo.toISOString().split('T')[0]);
        break;
      case 'all':
        setFromDate('');
        break;
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Complete the enhanced quiz and some daily sessions to see your ideology evolution over time.</p>
        </div>
      </Card>
    );
  }

  // Add comparison data to timeline for rendering
  const chartData = timeline.map(point => {
    const data: any = { ...point };
    if (comparison) {
      Object.keys(comparison.data).forEach(dim => {
        data[`${dim}_comparison`] = comparison.data[dim];
      });
    }
    return data;
  });

  // Find events that fall within visible timeline
  const eventMarkers = events.filter(event => {
    const eventDate = event.date;
    return timeline.some(point => point.date === eventDate);
  });

  return (
    <Card className="p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ideology Evolution Over Time
          </h3>
          {usingSnapshots && (
            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              📸 Daily Snapshots
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportJSON}>
            JSON
          </Button>
          <Button size="sm" variant="outline" onClick={exportPNG}>
            PNG
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Advanced Filters</h4>
            <Button size="sm" variant="ghost" onClick={() => setShowFilters(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setQuickFilter('month')}>
              Last Month
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickFilter('quarter')}>
              Last Quarter
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickFilter('all')}>
              All Time
            </Button>
            <Button size="sm" variant="outline" onClick={resetFilters}>
              Reset All
            </Button>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Weeks Slider */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Weeks to Show: {weeks}
            </label>
            <input
              type="range"
              min="4"
              max="52"
              step="4"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Comparison */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
              Compare With
            </label>
            <select
              value={compareParty}
              onChange={(e) => {
                setCompareParty(e.target.value);
                if (e.target.value) setCompareAverage(false);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">None</option>
              {PARTIES.map(party => (
                <option key={party} value={party}>{party}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="compareAverage"
                checked={compareAverage}
                onChange={(e) => {
                  setCompareAverage(e.target.checked);
                  if (e.target.checked) setCompareParty('');
                }}
                className="rounded"
              />
              <label htmlFor="compareAverage" className="text-sm text-gray-700 dark:text-gray-300">
                Compare with Average User
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Dimension toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>).map((dimension) => (
          <button
            key={dimension}
            onClick={() => toggleDimension(dimension)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedDimensions.has(dimension)
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            style={{
              backgroundColor: selectedDimensions.has(dimension)
                ? DIMENSION_COLORS[dimension]
                : undefined,
            }}
          >
            {DIMENSION_LABELS[dimension]}
          </button>
        ))}
      </div>

      {/* Event Badges */}
      {eventMarkers.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {eventMarkers.map((event, idx) => (
            <span
              key={idx}
              className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full"
              title={event.label}
            >
              {event.icon} {event.label}
            </span>
          ))}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={450}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12 }}
            stroke="#888"
          />
          <YAxis
            domain={[-10, 10]}
            ticks={[-10, -5, 0, 5, 10]}
            tick={{ fontSize: 12 }}
            stroke="#888"
            label={{ value: 'Position', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                    <p className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">
                      {data.dateLabel}
                    </p>
                    {payload.map((entry: any) => {
                      if (entry.dataKey.includes('_comparison')) return null;
                      return (
                        <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
                          {DIMENSION_LABELS[entry.dataKey as keyof typeof DIMENSION_LABELS]}:{' '}
                          <span className="font-semibold">{entry.value.toFixed(1)}</span>
                        </p>
                      );
                    })}
                    {comparison && (
                      <p className="text-xs text-gray-500 mt-1 border-t pt-1">
                        {comparison.name} comparison
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value: string) => {
              if (value.includes('_comparison')) {
                return `${comparison?.name} - ${DIMENSION_LABELS[value.replace('_comparison', '') as keyof typeof DIMENSION_LABELS]}`;
              }
              return DIMENSION_LABELS[value as keyof typeof DIMENSION_LABELS];
            }}
          />
          
          {/* Zero line */}
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          
          {/* Render selected dimensions */}
          {selectedDimensions.has('economic') && (
            <>
              <Line
                type="monotone"
                dataKey="economic"
                stroke={DIMENSION_COLORS.economic}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="economic_comparison"
                  stroke={DIMENSION_COLORS.economic}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('social') && (
            <>
              <Line
                type="monotone"
                dataKey="social"
                stroke={DIMENSION_COLORS.social}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="social_comparison"
                  stroke={DIMENSION_COLORS.social}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('cultural') && (
            <>
              <Line
                type="monotone"
                dataKey="cultural"
                stroke={DIMENSION_COLORS.cultural}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="cultural_comparison"
                  stroke={DIMENSION_COLORS.cultural}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('authority') && (
            <>
              <Line
                type="monotone"
                dataKey="authority"
                stroke={DIMENSION_COLORS.authority}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="authority_comparison"
                  stroke={DIMENSION_COLORS.authority}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('environmental') && (
            <>
              <Line
                type="monotone"
                dataKey="environmental"
                stroke={DIMENSION_COLORS.environmental}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="environmental_comparison"
                  stroke={DIMENSION_COLORS.environmental}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('welfare') && (
            <>
              <Line
                type="monotone"
                dataKey="welfare"
                stroke={DIMENSION_COLORS.welfare}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="welfare_comparison"
                  stroke={DIMENSION_COLORS.welfare}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('globalism') && (
            <>
              <Line
                type="monotone"
                dataKey="globalism"
                stroke={DIMENSION_COLORS.globalism}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="globalism_comparison"
                  stroke={DIMENSION_COLORS.globalism}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
          {selectedDimensions.has('technocratic') && (
            <>
              <Line
                type="monotone"
                dataKey="technocratic"
                stroke={DIMENSION_COLORS.technocratic}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              {comparison && (
                <Line
                  type="monotone"
                  dataKey="technocratic_comparison"
                  stroke={DIMENSION_COLORS.technocratic}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Help text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          <strong>How to read:</strong> Values range from -10 (progressive/left) to +10 (conservative/right).
          {comparison && <span> Dashed lines show {comparison.name} for comparison.</span>}
        </p>
        {usingSnapshots && (
          <p className="text-green-600 dark:text-green-400">
            ✨ Using daily snapshots for accurate historical data
          </p>
        )}
      </div>
    </Card>
  );
}


