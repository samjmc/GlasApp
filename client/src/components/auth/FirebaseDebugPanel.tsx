import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

export function FirebaseDebugPanel() {
  const [showSecrets, setShowSecrets] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: import.meta.env.VITE_FIREBASE_PROJECT_ID + ".firebaseapp.com",
  };

  const copyDomain = async () => {
    await navigator.clipboard.writeText(currentDomain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfigStatus = (value: string | undefined) => {
    if (!value) return { status: 'error', text: 'Missing' };
    if (value.length < 10) return { status: 'warning', text: 'Short' };
    return { status: 'success', text: 'OK' };
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Firebase Configuration Debug
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSecrets(!showSecrets)}
          >
            {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </CardTitle>
        <CardDescription>
          Debug Firebase authentication configuration and domain authorization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Current Domain</h4>
          <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
              {currentDomain}
            </code>
            <Button variant="outline" size="sm" onClick={copyDomain}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Add this domain to Firebase Console → Authentication → Settings → Authorized domains
          </p>
        </div>

        <div>
          <h4 className="font-medium mb-2">Firebase Configuration</h4>
          <div className="space-y-2">
            {Object.entries(config).map(([key, value]) => {
              const status = getConfigStatus(value);
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-mono">{key}</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={status.status === 'success' ? 'default' : 
                              status.status === 'warning' ? 'secondary' : 'destructive'}
                    >
                      {status.text}
                    </Badge>
                    {showSecrets && value && (
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {value.length > 20 ? value.substring(0, 20) + '...' : value}
                      </code>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Quick Fix Steps</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside text-gray-700">
            <li>Copy the current domain above</li>
            <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a></li>
            <li>Select project: glas-politics</li>
            <li>Go to Authentication → Settings → Authorized domains</li>
            <li>Click "Add domain" and paste the copied domain</li>
            <li>Wait 5-10 minutes for changes to propagate</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}