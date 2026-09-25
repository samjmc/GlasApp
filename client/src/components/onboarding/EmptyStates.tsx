/**
 * Empty states shown before the app has data for a section.
 */

import { Loader2, Newspaper, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/pulse/EmptyState';
import { Button } from '@/components/ui/button';

/** Shown when the news feed has no articles yet. */
export function EmptyNewsFeedState({ onRefresh, refreshing = false }: { onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <EmptyState
      icon={Newspaper}
      title="No news yet"
      action={
        onRefresh && (
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        )
      }
    >
      We read Irish news sources through the day. Political stories show here as soon as they are summarised.
    </EmptyState>
  );
}
