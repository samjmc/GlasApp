import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, MessageSquare, Send } from 'lucide-react';

// Form validation schema for SMS notifications
const smsFormSchema = z.object({
  phoneNumber: z.string()
    .min(1, 'Phone number is required')
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +15551234567)'),
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(1600, 'Message cannot exceed 1600 characters'),
  mediaUrl: z.string().url().optional().or(z.literal(''))
});

type SMSFormValues = z.infer<typeof smsFormSchema>;

// Default template messages for users to choose from
const messageTemplates = [
  {
    name: 'Quiz Results',
    text: 'Your Glas Politics quiz results are ready! View your political profile and see where you stand on the political compass. Check out our personalized insights for you.'
  },
  {
    name: 'Election Reminder',
    text: 'Reminder: An important election is coming up. Make your voice heard by voting this upcoming Tuesday. Check your polling location and schedule at glasspolitics.com.'
  },
  {
    name: 'Policy Alert',
    text: 'New policy alert! A major vote is happening on climate legislation this week. Get informed about how it might affect you at glasspolitics.com/policies.'
  }
];

export function SMSNotificationForm() {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const { toast } = useToast();
  
  // Form definition
  const form = useForm<SMSFormValues>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: {
      phoneNumber: '',
      message: '',
      mediaUrl: '',
    },
  });
  
  // Check SMS service availability on component mount
  React.useEffect(() => {
    async function checkSmsService() {
      try {
        const response = await fetch('/api/sms/status');
        const data = await response.json();
        setServiceAvailable(data.available);
      } catch (error) {
        console.error('Error checking SMS service status:', error);
        setServiceAvailable(false);
      }
    }
    
    checkSmsService();
  }, []);
  
  // Handle form submission
  async function onSubmit(values: SMSFormValues) {
    setIsSending(true);
    setStatus('idle');
    setStatusMessage('');
    
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStatus('success');
        setStatusMessage('SMS sent successfully!');
        toast({
          title: "Message Sent",
          description: "Your SMS has been sent successfully.",
        });
        // Reset form on success
        form.reset();
      } else {
        setStatus('error');
        setStatusMessage(result.message || 'Failed to send SMS');
        toast({
          variant: "destructive",
          title: "Sending Failed",
          description: result.message || 'Failed to send SMS',
        });
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Network error: Failed to connect to server');
      console.error('Error sending SMS:', error);
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Failed to connect to the server.",
      });
    } finally {
      setIsSending(false);
    }
  }
  
  // Apply a template message
  const applyTemplate = (templateText: string) => {
    form.setValue('message', templateText, { shouldValidate: true });
  };
  
  if (serviceAvailable === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SMS Notifications</CardTitle>
          <CardDescription>Send SMS notifications about political updates</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Service Unavailable</AlertTitle>
            <AlertDescription>
              The SMS service is currently unavailable. Please contact the administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Notifications</CardTitle>
        <CardDescription>Send SMS notifications about political updates</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+15551234567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the phone number in E.164 format (e.g., +15551234567)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter your message here..." 
                      className="min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the message you want to send (1600 characters max)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="mediaUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Media URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormDescription>
                    Add an optional image URL to include in your message
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Message Templates</h4>
              <div className="flex flex-wrap gap-2">
                {messageTemplates.map((template, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template.text)}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
            
            {status === 'success' && (
              <Alert className="bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-700">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                <AlertTitle className="text-green-600 dark:text-green-500">Success</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-500">
                  {statusMessage}
                </AlertDescription>
              </Alert>
            )}
            
            {status === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}
            
            <Button type="submit" disabled={isSending} className="w-full">
              {isSending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send SMS
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default SMSNotificationForm;