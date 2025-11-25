/**
 * usePWA Hook
 * React hook for PWA functionality
 */

import { useState, useEffect } from 'react';

interface PWAHook {
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  install: () => Promise<void>;
  displayMode: string;
  isOnline: boolean;
}

export function usePWA(): PWAHook {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Check if running as standalone PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;

  // Get display mode
  const getDisplayMode = (): string => {
    if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
    return 'browser';
  };

  const [displayMode] = useState(getDisplayMode());

  useEffect(() => {
    // Check installation status
    setIsInstalled(isStandalone);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    // Listen for online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isStandalone]);

  // Install function
  const install = async () => {
    if (!deferredPrompt) {
      console.warn('Install prompt not available');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User ${outcome} the install prompt`);
    
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    
    setDeferredPrompt(null);
  };

  return {
    isInstalled,
    isStandalone,
    canInstall,
    install,
    displayMode,
    isOnline
  };
}

// Hook for online status
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return isOnline;
}



