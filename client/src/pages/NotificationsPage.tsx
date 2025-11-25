import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SMSNotificationForm } from '@/components/SMSNotificationForm';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export default function NotificationsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Don't render the content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Notifications | Glas Politics</title>
        <meta name="description" content="Send and manage political notifications and alerts via SMS" />
      </Helmet>
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Notifications Center</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Send political updates, alerts, and poll reminders via SMS
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <SMSNotificationForm />
          </div>
          
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>About SMS Notifications</CardTitle>
                <CardDescription>How to effectively use our SMS notification system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium text-lg mb-1">When to Send SMS Messages</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    SMS is a powerful tool for time-sensitive communications. Consider sending messages for:
                  </p>
                  <ul className="list-disc ml-5 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>Election day reminders</li>
                    <li>Important policy vote alerts</li>
                    <li>Local political events</li>
                    <li>Breaking political news</li>
                    <li>Political survey invitations</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-lg mb-1">Best Practices</h3>
                  <ul className="list-disc ml-5 text-sm text-gray-600 dark:text-gray-400">
                    <li>Keep messages concise (under 160 characters when possible)</li>
                    <li>Include a clear call-to-action</li>
                    <li>Send messages at appropriate times (10am-8pm local time)</li>
                    <li>Always provide value in every message</li>
                    <li>Respect frequency (limit to 2-4 messages per month)</li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                  <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-1">SMS Compliance</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Always ensure you have explicit permission from recipients before sending SMS messages. 
                    Comply with local regulations including TCPA in the US, GDPR in Europe, and other 
                    applicable laws governing SMS communications.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}