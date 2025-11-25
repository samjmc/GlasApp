/**
 * Offline Indicator Component
 * Shows a banner when user loses connection
 */

import { useOnlineStatus } from '@/hooks/usePWA';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

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
      <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 z-50 shadow-lg">
        <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
          <WifiOff className="w-4 h-4" />
          <span>You're offline - Some features may be limited</span>
        </div>
      </div>
    );
  }

  // Reconnected banner (temporary)
  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-emerald-500 text-white px-4 py-2 z-50 shadow-lg animate-in slide-in-from-top-2">
        <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
          <Wifi className="w-4 h-4" />
          <span>Back online!</span>
        </div>
      </div>
    );
  }

  return null;
}



