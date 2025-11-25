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

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const installed = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;
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
      console.log('PWA installed successfully!');
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
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User ${outcome} the install prompt`);

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
    <>
      {/* Mobile Bottom Banner */}
      <div className="fixed bottom-20 left-4 right-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-2xl z-50 md:hidden animate-in slide-in-from-bottom-5">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/75 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3 pr-6">
          <div className="bg-white/20 p-2 rounded-lg">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm mb-1">Install Glas Politics</h3>
            <p className="text-xs opacity-90 mb-3">
              Add to your home screen for quick access and offline features!
            </p>
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="bg-white text-emerald-600 hover:bg-emerald-50 font-semibold"
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Floating Button */}
      <div className="hidden md:block fixed bottom-8 right-8 z-50">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-2xl max-w-sm animate-in slide-in-from-right-5">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/75 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-3 pr-6">
            <div className="bg-white/20 p-2 rounded-lg">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold mb-1">Install Glas Politics</h3>
              <p className="text-sm opacity-90 mb-3">
                Get quick access and work offline
              </p>
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="bg-white text-emerald-600 hover:bg-emerald-50 font-semibold w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Install
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Compact install button for header/menu
export function PWAInstallButtonCompact() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const installed = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;
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
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Install ${outcome}`);

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
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline">Install App</span>
    </Button>
  );
}



