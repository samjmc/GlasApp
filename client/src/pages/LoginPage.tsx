import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, KeyRound, ArrowLeft, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmail } from '@/lib/supabase';

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
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle?.();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  const handleMagicLinkLogin = async () => {
    if (!magicLinkEmail || !magicLinkEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithMagicLink?.(magicLinkEmail);
      if (result?.success) {
        setMagicLinkSent(true);
        toast({
          title: 'Magic link sent!',
          description: 'Check your email for a login link.',
        });
      } else {
        setError(result?.message || 'Failed to send magic link');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

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

        {magicLinkSent ? (
          <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Check your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a login link to <strong className="break-all text-foreground">{magicLinkEmail}</strong>
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowMagicLink(false);
                setMagicLinkSent(false);
                setMagicLinkEmail('');
              }}
            >
              Back to sign-in options
            </Button>
          </div>
        ) : showMagicLink ? (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="magic-email">Email address</Label>
              <Input
                id="magic-email"
                type="email"
                placeholder="you@example.com"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMagicLinkLogin()}
              />
              <p className="text-xs text-muted-foreground">We will email you a link that signs you in. No password needed.</p>
            </div>
            <Button
              type="button"
              className="h-12 w-full"
              onClick={handleMagicLinkLogin}
              disabled={isLoading || !magicLinkEmail.includes('@')}
            >
              {isLoading ? 'Sending...' : 'Send sign-in link'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowMagicLink(false)}>
              Back to sign-in options
            </Button>
          </div>
        ) : !showEmailLogin ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full gap-3"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full gap-3"
              onClick={() => setShowMagicLink(true)}
              disabled={isLoading}
            >
              <Mail className="h-5 w-5" aria-hidden="true" />
              Email me a sign-in link
            </Button>

            <div className="flex h-8 items-center gap-3 text-xs font-semibold text-muted-foreground">
              <span className="h-px flex-grow bg-border" />
              or
              <span className="h-px flex-grow bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full gap-3"
              onClick={() => setShowEmailLogin(true)}
            >
              <KeyRound className="h-5 w-5" aria-hidden="true" />
              Sign in with email and password
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="text-sm font-semibold text-warn">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && <p className="text-sm font-semibold text-warn">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="h-12 w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
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
