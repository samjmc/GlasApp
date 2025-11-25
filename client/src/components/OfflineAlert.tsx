import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WifiOff } from 'lucide-react';

/**
 * OfflineAlert - Shows a warning when user goes offline
 * Automatically appears/disappears based on network status
 */
export function OfflineAlert() {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full px-4">
      <Alert variant="destructive" className="border-2 shadow-lg">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>You're offline</AlertTitle>
        <AlertDescription>
          Some features may not work properly. Please check your internet connection.
        </AlertDescription>
      </Alert>
    </div>
  );
}






















