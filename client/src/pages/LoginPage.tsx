import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ChevronLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmail } from '@/lib/supabase';
import { SignInOptions } from '@/components/auth/SignInOptions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' })
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmail(data.email, data.password);
      toast({
        title: 'Login successful',
        description: 'Welcome to Glas Politics',
      });
      navigate('/');
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            Back to home
          </button>
        </div>

        <div className="mb-7 flex flex-col gap-2 text-center sm:text-left">
          <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-tight sm:text-[40px]">
            Welcome back
          </h1>
          <p className="text-base text-muted-foreground">Sign in to Glas Politics</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!showEmailLogin ? (
          <SignInOptions mode="sign-in" onError={setError} onChoosePassword={() => setShowEmailLogin(true)} />
        ) : (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="text-sm font-semibold text-warn">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="-my-2 flex h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary underline-offset-2 transition-colors hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
                {errors.password && <p className="text-sm font-semibold text-warn">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="h-12 w-full gap-2" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <Button type="button" variant="ghost" className="w-full gap-2" onClick={() => setShowEmailLogin(false)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back to sign-in options
            </Button>
          </div>
        )}

        <p className="mt-7 text-center text-sm text-muted-foreground">
          No account?{' '}
          <Button variant="link" className="h-auto p-0 font-bold" onClick={() => navigate('/register')}>
            Sign up
          </Button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
