import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Loader2, TrendingUp } from 'lucide-react';

interface TimelineDataPoint {
  weekStart: string;
  weekLabel: string;
  economic: number;
  social: number;
  cultural: number;
  authority: number;
  environmental: number;
  welfare: number;
  globalism: number;
  technocratic: number;
}

interface IdeologyTimeSeriesChartProps {
  userId: string;
  weeks?: number;
}

const DIMENSION_COLORS = {
  economic: '#3B82F6', // blue
  social: '#8B5CF6', // purple
  cultural: '#EC4899', // pink
  authority: '#EF4444', // red
  environmental: '#10B981', // green
  welfare: '#F59E0B', // amber
  globalism: '#06B6D4', // cyan
  technocratic: '#6366F1', // indigo
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

export default function IdeologyTimeSeriesChart({ userId, weeks = 12 }: IdeologyTimeSeriesChartProps) {
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<Set<string>>(
    new Set(['economic', 'social', 'authority'])
  );

  useEffect(() => {
    async function fetchTimeline() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/ideology-timeline/${userId}?weeks=${weeks}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load ideology timeline');
        }

        setTimeline(data.timeline || []);
      } catch (err: any) {
        console.error('Error loading ideology timeline:', err);
        setError(err.message || 'Failed to load chart data');
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchTimeline();
    }
  }, [userId, weeks]);

  const toggleDimension = (dimension: string) => {
    setSelectedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimension)) {
        next.delete(dimension);
      } else {
        next.add(dimension);
      }
      return next;
    });
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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Ideology Evolution Over Time
        </h3>
      </div>

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

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={timeline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            dataKey="weekLabel"
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
                      {data.weekLabel}
                    </p>
                    {payload.map((entry: any) => (
                      <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
                        {DIMENSION_LABELS[entry.dataKey as keyof typeof DIMENSION_LABELS]}:{' '}
                        <span className="font-semibold">{entry.value.toFixed(1)}</span>
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value: string) => DIMENSION_LABELS[value as keyof typeof DIMENSION_LABELS]}
          />
          
          {/* Render selected dimensions */}
          {selectedDimensions.has('economic') && (
            <Line
              type="monotone"
              dataKey="economic"
              stroke={DIMENSION_COLORS.economic}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('social') && (
            <Line
              type="monotone"
              dataKey="social"
              stroke={DIMENSION_COLORS.social}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('cultural') && (
            <Line
              type="monotone"
              dataKey="cultural"
              stroke={DIMENSION_COLORS.cultural}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('authority') && (
            <Line
              type="monotone"
              dataKey="authority"
              stroke={DIMENSION_COLORS.authority}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('environmental') && (
            <Line
              type="monotone"
              dataKey="environmental"
              stroke={DIMENSION_COLORS.environmental}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('welfare') && (
            <Line
              type="monotone"
              dataKey="welfare"
              stroke={DIMENSION_COLORS.welfare}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('globalism') && (
            <Line
              type="monotone"
              dataKey="globalism"
              stroke={DIMENSION_COLORS.globalism}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {selectedDimensions.has('technocratic') && (
            <Line
              type="monotone"
              dataKey="technocratic"
              stroke={DIMENSION_COLORS.technocratic}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Help text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          <strong>How to read this chart:</strong> Values range from -10 (progressive/left) to +10 (conservative/right).
          Your starting point is from the enhanced quiz, and changes reflect your votes in daily sessions.
        </p>
      </div>
    </Card>
  );
}


