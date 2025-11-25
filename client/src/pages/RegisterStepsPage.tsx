import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

// Step 1: Basic Information
const basicInfoSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Step 2: Location and Phone
const locationPhoneSchema = z.object({
  county: z.string().optional(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, { 
    message: 'Phone number must be in international format (e.g., +353851234567)' 
  }).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

// Step 3: Email verification
const emailVerificationSchema = z.object({
  emailCode: z.string().length(6, { message: 'Verification code must be 6 digits' })
});

// Step 4: Phone verification
const phoneVerificationSchema = z.object({
  phoneCode: z.string().length(6, { message: 'Verification code must be 6 digits' })
});

type BasicInfoFormValues = z.infer<typeof basicInfoSchema>;
type LocationPhoneFormValues = z.infer<typeof locationPhoneSchema>;
type EmailVerificationFormValues = z.infer<typeof emailVerificationSchema>;
type PhoneVerificationFormValues = z.infer<typeof phoneVerificationSchema>;

const RegisterStepsPageContent = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<any>({});
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const totalSteps = 4;
  const progressPercentage = (currentStep / totalSteps) * 100;

  // Step 1: Basic Information Form
  const basicInfoForm = useForm<BasicInfoFormValues>({
    resolver: zodResolver(basicInfoSchema)
  });

  // Step 2: Location and Phone Form
  const locationPhoneForm = useForm<LocationPhoneFormValues>({
    resolver: zodResolver(locationPhoneSchema)
  });

  // Step 3: Email Verification Form
  const emailVerificationForm = useForm<EmailVerificationFormValues>({
    resolver: zodResolver(emailVerificationSchema)
  });

  // Step 4: Phone Verification Form
  const phoneVerificationForm = useForm<PhoneVerificationFormValues>({
    resolver: zodResolver(phoneVerificationSchema)
  });

  // Function to get user's geolocation
  const getGeolocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation features",
        variant: "destructive"
      });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        locationPhoneForm.setValue('latitude', latitude);
        locationPhoneForm.setValue('longitude', longitude);
        toast({
          title: "Location captured",
          description: "Your location has been successfully captured",
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          title: "Location error",
          description: "We couldn't access your location. You can still register without it.",
          variant: "destructive"
        });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Step 1: Submit basic information
  const onSubmitBasicInfo = async (data: BasicInfoFormValues) => {
    setIsLoading(true);
    setError(null);

    if (!executeRecaptcha) {
      setError('Security verification not ready. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const captchaToken = await executeRecaptcha('register_step1');
      
      const response = await fetch('/api/auth/register-step1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          captchaToken
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setRegistrationData({ ...registrationData, ...data });
        setTempUserId(result.tempUserId);
        setCurrentStep(2);
        toast({
          title: 'Step 1 completed',
          description: 'Please continue with location and phone details',
        });
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit location and phone
  const onSubmitLocationPhone = async (data: LocationPhoneFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register-step2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempUserId,
          ...data
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setRegistrationData({ ...registrationData, ...data });
        setCurrentStep(3);
        toast({
          title: 'Step 2 completed',
          description: 'Please check your email for verification code',
        });
      } else {
        setError(result.message || 'Failed to update information. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify email
  const onSubmitEmailVerification = async (data: EmailVerificationFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/verify-email-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempUserId,
          code: data.emailCode
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Now we have a real userId after email verification
        if (result.userId) {
          setTempUserId(result.userId.toString()); // Convert to string for consistency
        }
        
        if (registrationData.phoneNumber) {
          setCurrentStep(4);
          toast({
            title: 'Email verified',
            description: 'Please check your phone for SMS verification code',
          });
        } else {
          // Skip phone verification if no phone number
          toast({
            title: 'Registration completed',
            description: 'You can now log in to your account',
          });
          navigate('/login');
        }
      } else {
        setError(result.message || 'Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Verify phone
  const onSubmitPhoneVerification = async (data: PhoneVerificationFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/verify-phone-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: parseInt(tempUserId || '0'),
          code: data.phoneCode
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Registration completed',
          description: 'You can now log in to your account',
        });
        navigate('/login');
      } else {
        setError(result.message || 'Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // List of Irish counties
  const irishCounties = [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry',
    'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare',
    'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth',
    'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo',
    'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
  ];

  return (
    <div className="container max-w-lg py-12 mx-auto">
      <Card className="rounded-lg border bg-card shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Step {currentStep} of {totalSteps}: Complete your registration
          </CardDescription>
          <Progress value={progressPercentage} className="w-full" />
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {currentStep === 1 && (
            <form onSubmit={basicInfoForm.handleSubmit(onSubmitBasicInfo)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    {...basicInfoForm.register('firstName')}
                  />
                  {basicInfoForm.formState.errors.firstName && (
                    <p className="text-sm text-red-500">{basicInfoForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    {...basicInfoForm.register('lastName')}
                  />
                  {basicInfoForm.formState.errors.lastName && (
                    <p className="text-sm text-red-500">{basicInfoForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="johndoe"
                  {...basicInfoForm.register('username')}
                />
                {basicInfoForm.formState.errors.username && (
                  <p className="text-sm text-red-500">{basicInfoForm.formState.errors.username.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  {...basicInfoForm.register('email')}
                />
                {basicInfoForm.formState.errors.email && (
                  <p className="text-sm text-red-500">{basicInfoForm.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  {...basicInfoForm.register('password')}
                />
                {basicInfoForm.formState.errors.password && (
                  <p className="text-sm text-red-500">{basicInfoForm.formState.errors.password.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...basicInfoForm.register('confirmPassword')}
                />
                {basicInfoForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500">{basicInfoForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Next Step'}
              </Button>
            </form>
          )}

          {currentStep === 2 && (
            <form onSubmit={locationPhoneForm.handleSubmit(onSubmitLocationPhone)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="county">County</Label>
                <Select onValueChange={(value) => locationPhoneForm.setValue('county', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a county" />
                  </SelectTrigger>
                  <SelectContent>
                    {irishCounties.map((county) => (
                      <SelectItem key={county} value={county}>
                        {county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+353851234567"
                  {...locationPhoneForm.register('phoneNumber')}
                />
                {locationPhoneForm.formState.errors.phoneNumber && (
                  <p className="text-sm text-red-500">{locationPhoneForm.formState.errors.phoneNumber.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  International format required (e.g., +353 for Ireland)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Your Location (Optional)</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={getGeolocation}
                  className="w-full"
                >
                  Share your location
                </Button>
                <p className="text-xs text-muted-foreground">
                  We use your location only to show regional political trends in our heatmap visualization.
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="w-full">
                  Back
                </Button>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Next Step'}
                </Button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form onSubmit={emailVerificationForm.handleSubmit(onSubmitEmailVerification)} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Verify Your Email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a 6-digit code to {registrationData.email}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="emailCode">Verification Code</Label>
                <Input
                  id="emailCode"
                  placeholder="123456"
                  maxLength={6}
                  {...emailVerificationForm.register('emailCode')}
                />
                {emailVerificationForm.formState.errors.emailCode && (
                  <p className="text-sm text-red-500">{emailVerificationForm.formState.errors.emailCode.message}</p>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} className="w-full">
                  Back
                </Button>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify Email'}
                </Button>
              </div>
            </form>
          )}

          {currentStep === 4 && (
            <form onSubmit={phoneVerificationForm.handleSubmit(onSubmitPhoneVerification)} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Verify Your Phone</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a 6-digit code to {registrationData.phoneNumber}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneCode">Verification Code</Label>
                <Input
                  id="phoneCode"
                  placeholder="123456"
                  maxLength={6}
                  {...phoneVerificationForm.register('phoneCode')}
                />
                {phoneVerificationForm.formState.errors.phoneCode && (
                  <p className="text-sm text-red-500">{phoneVerificationForm.formState.errors.phoneCode.message}</p>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(3)} className="w-full">
                  Back
                </Button>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Complete Registration'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const RegisterStepsPage = () => {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""}>
      <RegisterStepsPageContent />
    </GoogleReCaptchaProvider>
  );
};

export default RegisterStepsPage;