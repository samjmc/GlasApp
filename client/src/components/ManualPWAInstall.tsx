/**
 * Manual PWA Install Component
 * Always-visible button to install the app
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Check } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export function ManualPWAInstall() {
  const { canInstall, isInstalled, install } = usePWA();
  const [clicked, setClicked] = useState(false);

  const handleInstall = async () => {
    await install();
    setClicked(true);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <Check className="w-4 h-4" />
        <span>App Installed</span>
      </div>
    );
  }

  if (!canInstall) {
    return null; // Don't show install instructions
  }

  return (
    <Button 
      onClick={handleInstall}
      className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600"
    >
      <Download className="w-4 h-4" />
      Install App
    </Button>
  );
}



