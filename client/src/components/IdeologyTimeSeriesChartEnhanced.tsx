import { useId, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { Download, Loader2, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/pulse/EmptyState';
import { cn } from '@/lib/utils';
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

// One token colour per dimension, so lines read in both themes.
const DIMENSION_COLORS: Record<IdeologyDimension, string> = {
  economic: 'hsl(var(--chart-1))',
  social: 'hsl(var(--chart-2))',
  cultural: 'hsl(var(--chart-3))',
  authority: 'hsl(var(--chart-4))',
  environmental: 'hsl(var(--chart-5))',
  welfare: 'hsl(var(--foreground))',
  globalism: 'hsl(var(--destructive))',
  technocratic: 'hsl(var(--muted-foreground))',
};

const NO_PARTY = 'none';

type QuickFilter = 'month' | 'quarter' | 'all';
const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'month', label: 'Last month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'all', label: 'All time' },
];

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
  const [quickFilter, setQuickFilterState] = useState<QuickFilter | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const filtersId = useId();
  const { toast } = useToast();

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
    if (!chartRef.current || isExportingPng) return;
    setIsExportingPng(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `ideology-timeline-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (err) {
      console.error('Error exporting PNG:', err);
      toast({ title: 'Could not save the image', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsExportingPng(false);
    }
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setCompareParty('');
    setQuickFilterState(null);
  };

  const setQuickFilter = (filter: QuickFilter) => {
    setQuickFilterState(filter);
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

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-[22px] font-bold">How your views moved</h2>
      </div>
      {!!chartData.length && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls={filtersId}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} aria-label="Download as CSV">
            <Download aria-hidden="true" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportJSON} aria-label="Download as JSON">
            JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportPNG}
            disabled={isExportingPng}
            aria-label={isExportingPng ? 'Saving image' : 'Download as image'}
          >
            {isExportingPng && <Loader2 className="animate-spin" aria-hidden="true" />}
            PNG
          </Button>
        </div>
      )}
    </div>
  );

  if (timelineQuery.isLoading) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5" aria-busy="true">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </section>
    );
  }

  if (timelineQuery.error) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        {header}
        <p role="alert" className="text-sm text-destructive">
          {timelineQuery.error.message || 'Could not load your timeline.'}
        </p>
        <Button variant="outline" className="w-fit" onClick={() => void timelineQuery.refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  if ((timelineQuery.data?.points.length ?? 0) === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        {header}
        <EmptyState icon={TrendingUp} title="No history yet">
          Take the quiz and answer a few daily votes. Each one adds a point here.
        </EmptyState>
      </section>
    );
  }

  const selectedList = IDEOLOGY_DIMENSIONS.filter((dim) => selectedDimensions.has(dim));
  const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5" ref={chartRef}>
      {header}

      {showFilters && (
        <div id={filtersId} className="flex flex-col gap-4 rounded-xl bg-elevated p-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label="Date range">
            {QUICK_FILTERS.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={quickFilter === value ? 'inverse' : 'outline'}
                aria-pressed={quickFilter === value}
                onClick={() => setQuickFilter(value)}
              >
                {label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={resetFilters}>Reset filters</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeline-from">From</Label>
              <Input id="timeline-from" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setQuickFilterState(null); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeline-to">To</Label>
              <Input id="timeline-to" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setQuickFilterState(null); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeline-party">Compare with</Label>
              <Select value={compareParty || NO_PARTY} onValueChange={(v) => setCompareParty(v === NO_PARTY ? '' : v)}>
                <SelectTrigger id="timeline-party">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARTY}>No party</SelectItem>
                  {PARTIES.map((party) => (
                    <SelectItem key={party} value={party}>{party}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Dimensions shown">
        {IDEOLOGY_DIMENSIONS.map((dimension) => {
          const on = selectedDimensions.has(dimension);
          // At least one line stays on, so the last one cannot be turned off.
          const locked = on && selectedDimensions.size === 1;
          return (
            <button
              key={dimension}
              type="button"
              aria-pressed={on}
              disabled={locked}
              onClick={() => toggleDimension(dimension)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed sm:h-9',
                on ? 'border-foreground bg-elevated text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: on ? DIMENSION_COLORS[dimension] : 'hsl(var(--input))' }}
                aria-hidden="true"
              />
              {DIMENSION_POLES[dimension].label}
            </button>
          );
        })}
      </div>

      {chartData.length === 0 ? (
        <p className="flex h-64 items-center justify-center rounded-xl border border-dashed border-input text-sm text-muted-foreground">
          No points in this date range.
        </p>
      ) : (
        <div className="h-72 sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="dateLabel" tick={axisTick} stroke="hsl(var(--border))" tickLine={false} />
              <YAxis
                domain={[-IDEOLOGY_LIMIT, IDEOLOGY_LIMIT]}
                ticks={[-10, -5, 0, 5, 10]}
                tick={axisTick}
                stroke="hsl(var(--border))"
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const row = payload[0].payload as ChartRow;
                  return (
                    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                      <p className="mb-1.5 text-sm font-bold">{row.dateLabel}</p>
                      {payload.map((entry) => {
                        const key = String(entry.dataKey);
                        if (key.endsWith(COMPARISON_SUFFIX)) return null;
                        return (
                          <p key={key} className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                            {DIMENSION_POLES[key as IdeologyDimension]?.label ?? key}:
                            <span className="font-bold tabular-nums">{Number(entry.value).toFixed(1)}</span>
                          </p>
                        );
                      })}
                      {partyProfile && (
                        <p className="mt-1.5 border-t pt-1.5 text-xs text-muted-foreground">Dashed: {partyProfile.party}</p>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
                formatter={(value: string) => {
                  if (value.endsWith(COMPARISON_SUFFIX)) {
                    const dim = value.slice(0, -COMPARISON_SUFFIX.length) as IdeologyDimension;
                    return `${partyProfile?.party} · ${DIMENSION_POLES[dim]?.label ?? dim}`;
                  }
                  return DIMENSION_POLES[value as IdeologyDimension]?.label ?? value;
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--input))" strokeDasharray="3 3" />
              {selectedList.flatMap((dim) => {
                const lines = [
                  <Line
                    key={dim}
                    type="monotone"
                    dataKey={dim}
                    stroke={DIMENSION_COLORS[dim]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: DIMENSION_COLORS[dim] }}
                    activeDot={{ r: 5 }}
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
        </div>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>
          Every dimension runs from −{IDEOLOGY_LIMIT} to +{IDEOLOGY_LIMIT}.
          {partyProfile && (
            <> Dashed lines show {partyProfile.party} (from {partyProfile.tdCount} TD{partyProfile.tdCount === 1 ? '' : 's'}).</>
          )}
        </p>
        {selectedList.map((dim) => (
          <p key={dim}>
            {DIMENSION_POLES[dim].label}: −{IDEOLOGY_LIMIT} {DIMENSION_POLES[dim].negative}, +{IDEOLOGY_LIMIT} {DIMENSION_POLES[dim].positive}
          </p>
        ))}
      </div>
    </section>
  );
}