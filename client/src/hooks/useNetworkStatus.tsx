import { useState, useEffect } from 'react';

/**
 * useNetworkStatus - Hook to detect online/offline status
 * 
 * Usage:
 * const { isOnline, isOffline } = useNetworkStatus();
 * 
 * if (isOffline) {
 *   return <OfflineMessage />;
 * }
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}






















