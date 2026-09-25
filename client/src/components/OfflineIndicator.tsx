/**
 * Offline Indicator Component
 * Shows a banner when user loses connection
 */

import { useOnlineStatus } from '@/hooks/usePWA';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Banner indicating when the user loses or regains connection. */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Just came back online
      setShowReconnected(true);
      setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline, wasOffline]);

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed left-0 right-0 top-0 z-50 bg-warn px-4 py-2 text-background shadow-lg">
        <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-2 text-sm font-medium">
          <WifiOff className="h-4 w-4" />
          <span>You're offline - some features may be limited</span>
        </div>
      </div>
    );
  }

  // Reconnected banner (temporary)
  if (showReconnected) {
    return (
      <div className="fixed left-0 right-0 top-0 z-50 bg-success px-4 py-2 text-success-foreground shadow-lg animate-in slide-in-from-top-2">
        <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-2 text-sm font-medium">
          <Wifi className="h-4 w-4" />
          <span>Back online!</span>
        </div>
      </div>
    );
  }

  return null;
}
