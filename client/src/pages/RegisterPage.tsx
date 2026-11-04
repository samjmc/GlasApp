import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signUpWithEmail } from '@/lib/supabase';
import { SignInOptions } from '@/components/auth/SignInOptions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailSignup, setShowEmailSignup] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterFormValues) => {
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
    } catch (err: unknown) {
      setError((err as Error).message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-6 flex flex-col gap-2 text-center sm:text-left">
          <h1 className="font-display text-[28px] font-bold leading-[1.05] tracking-tight sm:text-[36px]">
            Create your account
          </h1>
          <p className="text-base text-muted-foreground">
            Vote on daily questions and see where you stand next to your TDs.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-elevated p-4">
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Your opinions are yours
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We save your quiz answers, votes and rankings only after you agree, and we ask the first time you save one.
            You can withdraw, or delete your account and all your data, at any time from the settings page.
          </p>
        </div>

        {!showEmailSignup ? (
          <SignInOptions mode="sign-up" onError={setError} onChoosePassword={() => setShowEmailSignup(true)} />
        ) : (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" placeholder="John" {...register('firstName')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" placeholder="Doe" {...register('lastName')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="text-sm font-semibold text-warn">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="At least 8 characters" {...register('password')} />
                {errors.password && <p className="text-sm font-semibold text-warn">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-sm font-semibold text-warn">{errors.confirmPassword.message}</p>}
              </div>

              <Button type="submit" className="h-12 w-full gap-2" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isLoading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <Button type="button" variant="ghost" className="w-full gap-2" onClick={() => setShowEmailSignup(false)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back to sign-up options
            </Button>
          </div>
        )}

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button variant="link" className="h-auto p-0 font-bold" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
