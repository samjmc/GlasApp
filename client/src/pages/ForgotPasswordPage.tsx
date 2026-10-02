import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { resetPassword } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** Step 1 of a password reset: ask for the email and send the link. */
export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message || 'We could not send the email. Please try again.');
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
            onClick={() => navigate('/login')}
            className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            Back to sign in
          </button>
        </div>

        <div className="mb-7 flex flex-col gap-2 text-center sm:text-left">
          <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-tight sm:text-[40px]">Reset your password</h1>
          <p className="text-base text-muted-foreground">We email you a link. You choose a new password on the page it opens.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sentTo ? (
          <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                If <strong className="break-all text-foreground">{sentTo}</strong> has a Glas account, a reset link is on its way.
              </p>
              <p className="text-[13px] text-muted-foreground">
                The link works once and expires after an hour.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button type="button" variant="outline" className="w-full" onClick={() => setSentTo(null)}>
                Use a different email
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/login')}>
                Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="h-12 w-full gap-2" disabled={isLoading || !valid}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isLoading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
