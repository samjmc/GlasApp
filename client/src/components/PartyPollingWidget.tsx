/**
 * Party Polling Widget
 *
 * Display polling data on party profile pages
 */

import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
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
  Filler,
  type ChartData,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/pulse/Stat';
import { cn } from '@/lib/utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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
  partyName: string;
  performanceScore?: number;
}

/** Read a theme token (an "H S% L%" triple) as a colour Chart.js can draw. */
function token(name: string, alpha = 1) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value} / ${alpha})` : 'currentColor';
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);

const TREND_ICON = { rising: TrendingUp, falling: TrendingDown } as const;

/** Widget showing a party's polling data and historical trends. */
export function PartyPollingWidget({ partyName }: PollingWidgetProps) {
  const [pollingData, setPollingData] = useState<PartyPollingData | null>(null);
  const [historicalData, setHistoricalData] = useState<ChartData<'line'> | null>(null);
  const [loading, setLoading] = useState(true);

  const decodedPartyName = decodeURIComponent(partyName);

  useEffect(() => {
    if (decodedPartyName) {
      loadPollingData();
    }
  }, [decodedPartyName]);

  async function loadPollingData() {
    setLoading(true);
    try {
      const { data: cache } = await supabase
        .from('polling_aggregates_cache')
        .select('*')
        .eq('entity_type', 'party')
        .eq('entity_name', decodedPartyName)
        .maybeSingle();

      if (cache) {
        setPollingData(cache);
      }

      const { data: timeSeries } = await supabase
        .from('polling_time_series')
        .select('*')
        .eq('entity_type', 'party')
        .eq('entity_name', decodedPartyName)
        .eq('granularity', 'month')
        .order('period_end', { ascending: true })
        .limit(12);

      if (timeSeries && timeSeries.length > 0) {
        setHistoricalData({
          labels: timeSeries.map((r) => new Date(r.period_end).toLocaleDateString('en-IE', { month: 'short' })),
          datasets: [
            {
              label: 'Support',
              data: timeSeries.map((r) => parseFloat(r.mean_support)),
              borderColor: token('--primary'),
              backgroundColor: token('--primary', 0.15),
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 5,
            },
          ],
        });
      }
    } catch (error) {
      console.error('Error loading polling data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-48 rounded-2xl" aria-busy="true" />;
  }

  if (!pollingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold tracking-tight">Polling</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <span className="font-display text-3xl font-bold leading-none tracking-tight text-muted-foreground">—</span>
          <p className="text-sm text-muted-foreground">
            No polls loaded yet. National support and the 30-day trend will show here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const change = pollingData.support_30d_change;
  const TrendIcon = TREND_ICON[pollingData.support_30d_trend as keyof typeof TREND_ICON] ?? Minus;
  const muted = token('--muted-foreground');
  const grid = token('--border');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold tracking-tight">Polling</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-muted-foreground">Latest poll support</span>
            <span className="font-display text-5xl font-extrabold leading-none tracking-tight">
              {pct(pollingData.latest_support)}
            </span>
            <span className="text-sm text-muted-foreground">
              {pollingData.latest_poll_source} ·{' '}
              {new Date(pollingData.latest_poll_date).toLocaleDateString('en-IE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              ({pollingData.last_poll_days_ago} days ago)
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-muted-foreground">30-day trend</span>
            <span
              className={cn(
                'inline-flex items-center gap-2 font-display text-3xl font-bold leading-none tracking-tight',
                change > 0 ? 'text-score-high' : change < 0 ? 'text-warn' : 'text-foreground'
              )}
            >
              <TrendIcon className="h-6 w-6" aria-hidden="true" />
              {change > 0 ? '+' : ''}
              {pct(change)}
            </span>
            <span className="text-sm capitalize text-muted-foreground">{pollingData.support_30d_trend}</span>
            <span className="text-sm text-muted-foreground">
              30-day avg <span className="font-semibold text-foreground">{pct(pollingData.support_30d_avg)}</span> ·
              90-day avg <span className="font-semibold text-foreground">{pct(pollingData.support_90d_avg)}</span>
            </span>
          </div>
        </div>

        {historicalData && (
          <div className="flex flex-col gap-3 rounded-xl bg-elevated p-4">
            <span className="text-sm font-semibold">Last 12 months</span>
            <div className="h-48">
              <Line
                data={historicalData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      padding: 12,
                      callbacks: { label: (context) => `Support: ${(context.parsed.y ?? 0).toFixed(1)}%` },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { callback: (value) => `${value}%`, color: muted, font: { size: 11 } },
                      grid: { color: grid },
                    },
                    x: { ticks: { color: muted, font: { size: 11 } }, grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="All-time high"
            value={pct(pollingData.all_time_high)}
            sub={pollingData.all_time_high_date ? new Date(pollingData.all_time_high_date).toLocaleDateString('en-IE') : '—'}
          />
          <StatTile label="All-time low" value={pct(pollingData.all_time_low)} />
          <StatTile label="Total polls" value={pollingData.total_polls ?? '—'} sub="Since 2020" />
          <StatTile label="Data status" value={<span className="capitalize">{pollingData.data_recency}</span>} />
        </div>

        <Link
          href="/rankings"
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline"
        >
          See all rankings <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default PartyPollingWidget;
