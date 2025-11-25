import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCircle, Clock } from 'lucide-react';

// Verification code form schema
const verificationSchema = z.object({
  code: z.string().length(6, { message: 'Verification code must be 6 digits' })
});

// Phone number form schema
const phoneSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format (e.g., +15551234567)' })
});

type VerificationFormValues = z.infer<typeof verificationSchema>;
type PhoneFormValues = z.infer<typeof phoneSchema>;

interface PhoneVerificationProps {
  userId?: number;
  phoneNumber?: string;
  isVerified?: boolean;
  onVerified?: () => void;
  onPhoneUpdated?: (phoneNumber: string) => void;
  className?: string;
}

export function PhoneVerification({ 
  userId, 
  phoneNumber, 
  isVerified = false, 
  onVerified, 
  onPhoneUpdated,
  className 
}: PhoneVerificationProps) {
  const [verificationSent, setVerificationSent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const { toast } = useToast();

  // Form for entering verification code
  const verificationForm = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: '',
    },
  });

  // Form for updating phone number
  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: phoneNumber || '',
    },
  });

  // Handle verification code submission
  const onVerificationSubmit = async (values: VerificationFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Verification Successful",
          description: "Your phone number has been verified successfully.",
        });
        
        setVerificationSent(false);
        
        // Notify parent component that verification is complete
        if (onVerified) {
          onVerified();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.message || "Invalid verification code. Please try again.",
        });
      }
    } catch (error) {
      console.error('Error verifying phone:', error);
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: "An error occurred while verifying your phone number.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle updating phone number
  const onPhoneSubmit = async (values: PhoneFormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Phone Number Updated",
          description: "Verification code has been sent to your phone.",
        });
        
        setVerificationSent(true);
        
        // Notify parent component that phone was updated
        if (onPhoneUpdated) {
          onPhoneUpdated(values.phoneNumber);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: data.message || "Failed to update phone number.",
        });
      }
    } catch (error) {
      console.error('Error updating phone:', error);
      toast({
        variant: "destructive",
        title: "Update Error",
        description: "An error occurred while updating your phone number.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Code Sent",
          description: "A new verification code has been sent to your phone.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sending Failed",
          description: data.message || "Failed to send verification code.",
        });
      }
    } catch (error) {
      console.error('Error resending code:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while sending the verification code.",
      });
    } finally {
      setIsResending(false);
    }
  };

  // Render content based on verification state
  if (isVerified && phoneNumber) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            Phone Verification
            <Badge variant="success" className="ml-2 bg-green-500">
              <Check className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Verified Phone Number</p>
            <div className="flex items-center text-sm">
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              {phoneNumber}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setVerificationSent(false)}
          >
            Update Phone Number
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Verification code entry form
  if (verificationSent && phoneNumber) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Verify Your Phone</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {phoneNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...verificationForm}>
            <form onSubmit={verificationForm.handleSubmit(onVerificationSubmit)} className="space-y-4">
              <FormField
                control={verificationForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input placeholder="123456" {...field} />
                    </FormControl>
                    <FormDescription>
                      The code is valid for 10 minutes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-between">
                <Button 
                  type="button" 
                  variant="link" 
                  onClick={handleResendCode} 
                  disabled={isResending}
                  className="px-0"
                >
                  {isResending ? 'Sending...' : 'Resend Code'}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  // Phone number entry form
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Phone Verification</CardTitle>
        <CardDescription>
          Add your phone number to enable SMS notifications and enhance security
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...phoneForm}>
          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
            <FormField
              control={phoneForm.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+15551234567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter your phone number in E.164 format (e.g., +15551234567)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending Code...' : phoneNumber ? 'Update Phone Number' : 'Add Phone Number'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}