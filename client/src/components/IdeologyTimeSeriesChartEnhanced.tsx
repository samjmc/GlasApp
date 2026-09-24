import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Download, Filter, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { fetchMyTimeline } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT } from '@shared/ideology';
import type { IdeologyDimension } from '@shared/ideology';

type ChartRow = { date: string; dateLabel: string } & Record<string, number | string>;

interface IdeologyTimeSeriesChartEnhancedProps {
  /** Only used to scope the query cache to the signed-in user. */
  userId: string;
}

const DIMENSION_COLORS: Record<IdeologyDimension, string> = {
  economic: '#3B82F6',
  social: '#8B5CF6',
  cultural: '#EC4899',
  authority: '#EF4444',
  environmental: '#10B981',
  welfare: '#F59E0B',
  globalism: '#06B6D4',
  technocratic: '#6366F1',
};

const COMPARISON_SUFFIX = '_comparison';

const PARTIES = [
  'Fianna Fáil', 'Fine Gael', 'Sinn Féin', 'Green Party',
  'Labour Party', 'Social Democrats', 'People Before Profit-Solidarity',
  'Aontú', 'Independent'
];

const formatDateLabel = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const csvField = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function IdeologyTimeSeriesChartEnhanced({
  userId,
}: IdeologyTimeSeriesChartEnhancedProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // UI state
  const [selectedDimensions, setSelectedDimensions] = useState<Set<IdeologyDimension>>(
    new Set<IdeologyDimension>(['economic', 'social', 'authority'])
  );
  const [compareParty, setCompareParty] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const timelineQuery = useQuery({
    queryKey: queryKeys.ideology.timeline(userId, compareParty || null),
    queryFn: () => fetchMyTimeline(compareParty || undefined),
  });

  const partyProfile = timelineQuery.data?.party ?? null;

  // The endpoint returns the full history; the date range is applied here.
  const points = (timelineQuery.data?.points ?? []).filter(
    (point) => (!fromDate || point.date >= fromDate) && (!toDate || point.date <= toDate)
  );

  const chartData: ChartRow[] = points.map((point) => {
    const row: ChartRow = { date: point.date, dateLabel: formatDateLabel(point.date) };
    for (const dim of IDEOLOGY_DIMENSIONS) {
      row[dim] = point.vector[dim];
      if (partyProfile) row[`${dim}${COMPARISON_SUFFIX}`] = partyProfile.vector[dim];
    }
    return row;
  });

  const toggleDimension = (dimension: IdeologyDimension) => {
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
    const header = ['date', ...IDEOLOGY_DIMENSIONS];
    if (partyProfile) {
      header.push(...IDEOLOGY_DIMENSIONS.map((dim) => `${partyProfile.party} ${dim}`));
    }
    const lines = chartData.map((row) => {
      const values: (string | number)[] = [row.date, ...IDEOLOGY_DIMENSIONS.map((dim) => row[dim])];
      if (partyProfile) {
        values.push(...IDEOLOGY_DIMENSIONS.map((dim) => row[`${dim}${COMPARISON_SUFFIX}`]));
      }
      return values.map(csvField).join(',');
    });
    const csv = [header.map(csvField).join(','), ...lines].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `ideology-timeline-${userId}.csv`);
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify({ timeline: points, party: partyProfile }, null, 2);
    downloadBlob(new Blob([dataStr], { type: 'application/json' }), `ideology-timeline-${userId}.json`);
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
  };

  const setQuickFilter = (filter: 'month' | 'quarter' | 'all') => {
    const now = new Date();
    setToDate('');

    switch (filter) {
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setFromDate(monthAgo.toISOString().split('T')[0]);
        break;
      }
      case 'quarter': {
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        setFromDate(quarterAgo.toISOString().split('T')[0]);
        break;
      }
      case 'all':
        setFromDate('');
        break;
    }
  };

  if (timelineQuery.isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </Card>
    );
  }

  if (timelineQuery.error) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>{timelineQuery.error.message || 'Failed to load chart data'}</p>
        </div>
      </Card>
    );
  }

  if ((timelineQuery.data?.points.length ?? 0) === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Complete the quiz and some daily sessions to see your ideology evolution over time.</p>
        </div>
      </Card>
    );
  }

  const selectedList = IDEOLOGY_DIMENSIONS.filter((dim) => selectedDimensions.has(dim));

  return (
    <Card className="p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ideology Evolution Over Time
          </h3>
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

          {/* Comparison */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
              Compare With
            </label>
            <select
              value={compareParty}
              onChange={(e) => setCompareParty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">None</option>
              {PARTIES.map(party => (
                <option key={party} value={party}>{party}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Dimension toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {IDEOLOGY_DIMENSIONS.map((dimension) => (
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
            {DIMENSION_POLES[dimension].label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">
          No data in the selected date range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12 }}
              stroke="#888"
            />
            <YAxis
              domain={[-IDEOLOGY_LIMIT, IDEOLOGY_LIMIT]}
              ticks={[-10, -5, 0, 5, 10]}
              tick={{ fontSize: 12 }}
              stroke="#888"
              label={{ value: 'Position', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const row = payload[0].payload as ChartRow;
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                      <p className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">
                        {row.dateLabel}
                      </p>
                      {payload.map((entry) => {
                        const key = String(entry.dataKey);
                        if (key.endsWith(COMPARISON_SUFFIX)) return null;
                        return (
                          <p key={key} className="text-xs" style={{ color: entry.color }}>
                            {DIMENSION_POLES[key as IdeologyDimension]?.label ?? key}:{' '}
                            <span className="font-semibold">{Number(entry.value).toFixed(1)}</span>
                          </p>
                        );
                      })}
                      {partyProfile && (
                        <p className="text-xs text-gray-500 mt-1 border-t pt-1">
                          {partyProfile.party} comparison
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
                if (value.endsWith(COMPARISON_SUFFIX)) {
                  const dim = value.slice(0, -COMPARISON_SUFFIX.length) as IdeologyDimension;
                  return `${partyProfile?.party} - ${DIMENSION_POLES[dim]?.label ?? dim}`;
                }
                return DIMENSION_POLES[value as IdeologyDimension]?.label ?? value;
              }}
            />

            {/* Zero line */}
            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />

            {/* Render selected dimensions, each with its party comparison line */}
            {selectedList.flatMap((dim) => {
              const lines = [
                <Line
                  key={dim}
                  type="monotone"
                  dataKey={dim}
                  stroke={DIMENSION_COLORS[dim]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />,
              ];
              if (partyProfile) {
                lines.push(
                  <Line
                    key={`${dim}${COMPARISON_SUFFIX}`}
                    type="monotone"
                    dataKey={`${dim}${COMPARISON_SUFFIX}`}
                    stroke={DIMENSION_COLORS[dim]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                );
              }
              return lines;
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Help text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          <strong>How to read:</strong> Values range from -{IDEOLOGY_LIMIT} to +{IDEOLOGY_LIMIT} on every dimension.
          {partyProfile && (
            <span> Dashed lines show {partyProfile.party} (based on {partyProfile.tdCount} TD{partyProfile.tdCount === 1 ? '' : 's'}) for comparison.</span>
          )}
        </p>
        {selectedList.map((dim) => (
          <p key={dim}>
            {DIMENSION_POLES[dim].label}: -{IDEOLOGY_LIMIT} {DIMENSION_POLES[dim].negative}, +{IDEOLOGY_LIMIT} {DIMENSION_POLES[dim].positive}
          </p>
        ))}
      </div>
    </Card>
  );
}
