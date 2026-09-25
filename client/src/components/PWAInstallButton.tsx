/**
 * PWA Install Button Component
 * Shows a button to install the app when available
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Button that prompts the user to install the PWA. */
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const installed = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as { standalone?: boolean }).standalone === true;
      setIsInstalled(installed);
    };

    checkInstalled();

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user dismissed recently
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const shouldShow = !dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000;

      if (shouldShow) {
        setTimeout(() => setShowPrompt(true), 3000); // Show after 3 seconds
      }
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    await deferredPrompt.userChoice;

    // Clear the prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !deferredPrompt || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed right-4 z-50 bottom-[calc(92px_+_env(safe-area-inset-bottom,0px))] left-4 md:bottom-6 md:left-auto md:right-6">
      <div className="relative flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-card p-4 pr-8 shadow-lg animate-in slide-in-from-bottom-5">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-bold">Install Glas Politics</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Add to your home screen for quick access and offline features!
          </p>
          <Button onClick={handleInstallClick} size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Install app
          </Button>
        </div>
      </div>
    </div>
  );
}

// Compact install button for header/menu
/** Compact install button for headers/menus. */
export function PWAInstallButtonCompact() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const installed = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as { standalone?: boolean }).standalone === true;
      setIsInstalled(installed);
    };

    checkInstalled();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
  };

  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <Button
      onClick={handleInstallClick}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install app</span>
    </Button>
  );
}
