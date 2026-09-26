import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from 'lucide-react';
import { supabase, updatePassword } from '@/lib/supabase';
import { newPasswordSchema, readAuthLinkError, type NewPasswordValues } from '@/lib/passwordReset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Stage = 'checking' | 'bad-link' | 'form' | 'done';

/**
 * Step 2 of a password reset. The email link lands here with a one-time code, which the
 * Supabase client swaps for a session on load (PKCE, so only in the browser that asked).
 * With a session, the user picks a new password; without one, the link is bad or was
 * opened in another browser, and we say so.
 */
export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>('checking');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
  });

  useEffect(() => {
    let cancelled = false;
    const fromUrl = readAuthLinkError(window.location.search, window.location.hash);
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (session && !fromUrl) {
        setStage('form');
        return;
      }
      setLinkError(fromUrl ?? error?.message ?? null);
      setStage('bad-link');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async ({ password }: NewPasswordValues) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updatePassword(password);
      setStage('done');
    } catch (err) {
      setSaveError((err as Error).message || 'We could not save your new password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-7 flex flex-col gap-2 text-center sm:text-left">
          <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-tight sm:text-[40px]">Choose a new password</h1>
        </div>

        {stage === 'checking' && (
          <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Checking your link…
          </div>
        )}

        {stage === 'bad-link' && (
          <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warn/15 text-warn">
              <TriangleAlert className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight">This link does not work</h2>
              <p className="text-sm text-muted-foreground">
                It may have expired or been used already. It also works only in the browser where you asked for it.
              </p>
              {linkError && <p className="text-[13px] text-muted-foreground">Reason: {linkError}</p>}
            </div>
            <Button type="button" className="h-12 w-full" onClick={() => navigate('/forgot-password')}>
              Send a new link
            </Button>
          </div>
        )}

        {stage === 'form' && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...register('password')} />
              {errors.password && <p className="text-sm font-semibold text-warn">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Type it again</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-sm font-semibold text-warn">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="h-12 w-full gap-2" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
              {isSaving ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
        )}

        {stage === 'done' && (
          <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl font-bold tracking-tight">Password changed</h2>
              <p className="text-sm text-muted-foreground">You are signed in. Use the new password next time.</p>
            </div>
            <Button type="button" className="h-12 w-full" onClick={() => navigate('/')}>
              Go to Glas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
