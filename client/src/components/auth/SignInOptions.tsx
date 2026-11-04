/**
 * The passwordless choices shared by the sign-in and sign-up pages: Google, an emailed link, and a
 * button that hands over to the page's own email-and-password form.
 */
import { useState } from 'react';
import { KeyRound, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const COPY = {
  'sign-in': {
    googleFailed: 'Failed to sign in with Google',
    googleBusy: 'Signing in…',
    linkOption: 'Email me a sign-in link',
    linkHelp: 'We will email you a link that signs you in. No password needed.',
    linkSend: 'Send sign-in link',
    linkToast: 'Check your email for a login link.',
    linkSent: 'We sent a login link to',
    password: 'Sign in with email and password',
    back: 'Back to sign-in options',
  },
  'sign-up': {
    googleFailed: 'Failed to sign up with Google',
    googleBusy: 'Signing up…',
    linkOption: 'Email me a sign-up link',
    linkHelp: 'We will email you a link to create your account. No password needed.',
    linkSend: 'Send sign-up link',
    linkToast: 'Check your email for a signup link.',
    linkSent: 'We sent a signup link to',
    password: 'Sign up with email',
    back: 'Back to sign-up options',
  },
} as const;

interface SignInOptionsProps {
  mode: keyof typeof COPY;
  /** Shows (or, with null, clears) the page's error message. */
  onError: (message: string | null) => void;
  /** Opens the page's email-and-password form. */
  onChoosePassword: () => void;
}

export function SignInOptions({ mode, onError, onChoosePassword }: SignInOptionsProps) {
  const copy = COPY[mode];
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleGoogle = async () => {
    setIsLoading(true);
    onError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      onError((err as Error).message || copy.googleFailed);
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!magicLinkEmail || !magicLinkEmail.includes('@')) {
      onError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    onError(null);
    try {
      const result = await signInWithMagicLink(magicLinkEmail);
      if (result.success) {
        setMagicLinkSent(true);
        toast({ title: 'Magic link sent!', description: copy.linkToast });
      } else {
        onError(result.message || 'Failed to send magic link');
      }
    } catch (err: unknown) {
      onError((err as Error).message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Mail className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Check your email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.linkSent} <strong className="break-all text-foreground">{magicLinkEmail}</strong>
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
          {copy.back}
        </Button>
      </div>
    );
  }

  if (showMagicLink) {
    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="magic-email">Email address</Label>
          <Input
            id="magic-email"
            type="email"
            placeholder="you@example.com"
            value={magicLinkEmail}
            onChange={(e) => setMagicLinkEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
          />
          <p className="text-xs text-muted-foreground">{copy.linkHelp}</p>
        </div>
        <Button
          type="button"
          className="h-12 w-full gap-2"
          onClick={handleMagicLink}
          disabled={isLoading || !magicLinkEmail.includes('@')}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isLoading ? 'Sending…' : copy.linkSend}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setShowMagicLink(false)}>
          {copy.back}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="h-12 w-full gap-3" onClick={handleGoogle} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        {isLoading ? copy.googleBusy : 'Continue with Google'}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-3"
        onClick={() => setShowMagicLink(true)}
        disabled={isLoading}
      >
        <Mail className="h-5 w-5" aria-hidden="true" />
        {copy.linkOption}
      </Button>

      <div className="flex h-8 items-center gap-3 text-xs font-semibold text-muted-foreground">
        <span className="h-px flex-grow bg-border" />
        or
        <span className="h-px flex-grow bg-border" />
      </div>

      <Button type="button" variant="outline" className="h-12 w-full gap-3" onClick={onChoosePassword}>
        <KeyRound className="h-5 w-5" aria-hidden="true" />
        {copy.password}
      </Button>
    </div>
  );
}
