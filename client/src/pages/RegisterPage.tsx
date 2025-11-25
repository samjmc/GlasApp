import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { signUpWithEmail } from '@/lib/supabase';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

const registerSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const RegisterPage = () => {
  const { signInWithGoogle, signInWithMicrosoft } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });

  const handleGoogleSignup = async () => {
    if (!hasConsented) {
      setError('You must consent to data collection before signing up.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle?.();
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
      setIsLoading(false);
    }
  };

  const handleMicrosoftSignup = async () => {
    if (!hasConsented) {
      setError('You must consent to data collection before signing up.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signInWithMicrosoft?.();
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Microsoft');
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    if (!hasConsented) {
      setError('You must consent to data collection before signing up.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      await signUpWithEmail(data.email, data.password, {
        first_name: data.firstName,
        last_name: data.lastName,
      });
      
      toast({
        title: 'Check your email!',
        description: 'We sent you a confirmation link to complete your registration.',
      });
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <div className="w-full max-w-md px-4">
        <Card className="mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create Your Account</CardTitle>
            <CardDescription className="text-center">
              Sign up for Glas Politics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed">
              <p className="font-semibold">Before you continue</p>
              <p>
                Glas Politics collects the political opinions you share so we can generate personalised insights.
                You can delete your account and all associated data at any time from the settings page.
              </p>
            </div>

            <div className="flex items-start space-x-3 rounded-md border border-transparent bg-background">
              <Checkbox
                id="consent-checkbox"
                checked={hasConsented}
                onCheckedChange={value => setHasConsented(!!value)}
              />
              <Label htmlFor="consent-checkbox" className="text-sm leading-relaxed font-normal">
                I consent to Glas Politics collecting and processing my political opinions for personalised insights.
                I understand I can withdraw my consent and request deletion of my data at any time.
              </Label>
            </div>

            {!showEmailSignup ? (
              <>
                {/* OAuth Buttons */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleGoogleSignup}
                    disabled={isLoading || !hasConsented}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleMicrosoftSignup}
                    disabled={isLoading || !hasConsented}
                  >
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#f25022" d="M0 0h11.377v11.377H0z" />
                      <path fill="#00a4ef" d="M12.623 0H24v11.377H12.623z" />
                      <path fill="#7fba00" d="M0 12.623h11.377V24H0z" />
                      <path fill="#ffb900" d="M12.623 12.623H24V24H12.623z" />
                    </svg>
                    Continue with Microsoft
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    if (!hasConsented) {
                      setError('You must consent to data collection before signing up.');
                      return;
                    }
                    setShowEmailSignup(true);
                  }}
                >
                  Sign up with email
                </Button>
              </>
            ) : (
              <>
                {/* Email/Password Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        {...register('firstName')}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        {...register('lastName')}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="text-sm text-red-500">{errors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !hasConsented}
                  >
                    {isLoading ? 'Creating account...' : 'Create account'}
                  </Button>
                </form>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowEmailSignup(false)}
                >
                  Back to OAuth options
                </Button>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;