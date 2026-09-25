/**
 * Empty states shown before the app has data for a section.
 */

import { Newspaper, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/pulse/EmptyState';
import { Button } from '@/components/ui/button';

/** Shown when the news feed has no articles yet. */
export function EmptyNewsFeedState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={Newspaper}
      title="No news yet"
      action={
        onRefresh && (
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        )
      }
    >
      We read Irish news sources through the day. Political stories show here as soon as they are summarised.
    </EmptyState>
  );
}
