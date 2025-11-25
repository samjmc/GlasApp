import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';

export function DomainAuthHelper() {
  const [copied, setCopied] = useState(false);
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const copyDomain = async () => {
    await navigator.clipboard.writeText(currentDomain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openFirebaseConsole = () => {
    window.open('https://console.firebase.google.com/project/glas-politics/authentication/settings', '_blank');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          Domain Authorization Required
        </CardTitle>
        <CardDescription>
          Firebase authentication requires this domain to be authorized
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The current domain needs to be added to Firebase's authorized domains list for Google sign-in to work.
          </AlertDescription>
        </Alert>

        <div>
          <h4 className="font-medium mb-2">Current Domain</h4>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <code className="flex-1 text-sm font-mono">{currentDomain}</code>
            <Button variant="outline" size="sm" onClick={copyDomain}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Full Origin</h4>
          <code className="block p-3 bg-gray-50 rounded-lg text-sm font-mono break-all">
            {currentOrigin}
          </code>
        </div>

        <div>
          <h4 className="font-medium mb-2">Steps to Fix</h4>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            <li>Copy the domain above</li>
            <li>Click the button below to open Firebase Console</li>
            <li>Navigate to Authentication → Settings → Authorized domains</li>
            <li>Click "Add domain" and paste: <code className="bg-gray-100 px-1 rounded">{currentDomain}</code></li>
            <li>Save and wait 5-10 minutes for propagation</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button onClick={openFirebaseConsole} className="flex-1">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Firebase Console
          </Button>
          <Button variant="outline" onClick={copyDomain}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Domain
          </Button>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Alternative:</strong> Use the "Try as Guest" button to access the app immediately while this gets resolved.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}