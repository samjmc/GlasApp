import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfileMe, profileMeKey, useProfileMe } from "@/hooks/useProfileMe";
import { apiRequest } from "@/lib/queryClient";
import { POLITICAL_CONSENT_POINTS, POLITICAL_CONSENT_STATEMENT, POLITICAL_CONSENT_VERSION, hasPoliticalConsent } from "@shared/consent";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CONSENT_PATH = "/api/account/consent/political";

interface EnsureOptions {
  /** Stay silent if the user already said no on this visit. For a save they did not just ask for. */
  respectDecline?: boolean;
}

interface ConsentValue {
  /** The signed-in user has agreed to the current wording. False while unknown and when signed out. */
  granted: boolean;
  /**
   * Call before saving anything that shows a political opinion. Resolves true when saving is allowed
   * (the user agreed now or before, or is signed out and nothing is saved) and false when they said no.
   */
  ensure: (options?: EnsureOptions) => Promise<boolean>;
  grant: () => Promise<void>;
  /** Withdraw consent. The server erases the user's quiz results, votes and rankings. */
  withdraw: () => Promise<void>;
}

const ConsentContext = createContext<ConsentValue | null>(null);

export function usePoliticalConsent(): ConsentValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("usePoliticalConsent must be used inside ConsentProvider");
  return value;
}

/** Holds the user's consent to us keeping their political opinions, and asks for it when it is needed. */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const profile = useProfileMe();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = useRef<((agreed: boolean) => void) | null>(null);
  const declined = useRef(false);

  const granted = isAuthenticated && hasPoliticalConsent(profile.data?.data?.user);
  const grantedRef = useRef(granted);
  grantedRef.current = granted;
  const userId = user?.id;

  // A different person signing in on this device starts with a clean slate.
  useEffect(() => {
    declined.current = false;
  }, [userId]);

  const grant = useCallback(async () => {
    await apiRequest({ method: "PUT", path: CONSENT_PATH, body: { version: POLITICAL_CONSENT_VERSION } });
    declined.current = false;
    await queryClient.invalidateQueries({ queryKey: profileMeKey(userId) });
  }, [queryClient, userId]);

  const withdraw = useCallback(async () => {
    await apiRequest({ method: "DELETE", path: CONSENT_PATH });
    declined.current = false;
    // Their quiz history, votes and rankings are gone on the server: drop every cached copy.
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const ensure = useCallback(
    async (options?: EnsureOptions) => {
      if (!isAuthenticated) return true;
      if (grantedRef.current) return true;
      if (options?.respectDecline && declined.current) return false;
      // The cached profile can be missing or old: ask the server before bothering the user.
      const fresh = await queryClient.fetchQuery({ queryKey: profileMeKey(userId), queryFn: fetchProfileMe, staleTime: 0 }).catch(() => null);
      if (hasPoliticalConsent(fresh?.data?.user)) return true;
      return new Promise<boolean>((resolve) => {
        answer.current?.(false);
        answer.current = resolve;
        setError(null);
        setOpen(true);
      });
    },
    [isAuthenticated, queryClient, userId],
  );

  const settle = (agreed: boolean) => {
    if (!agreed) declined.current = true;
    setOpen(false);
    answer.current?.(agreed);
    answer.current = null;
  };

  const agree = async () => {
    setSaving(true);
    setError(null);
    try {
      await grant();
      settle(true);
    } catch {
      setError("We could not save your choice. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const value = useMemo(() => ({ granted, ensure, grant, withdraw }), [granted, ensure, grant, withdraw]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can we keep your political opinions?</DialogTitle>
            <DialogDescription>{POLITICAL_CONSENT_STATEMENT}</DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
            {POLITICAL_CONSENT_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Read the <Link href="/privacy-policy" className="font-semibold text-primary underline underline-offset-2">privacy policy</Link> for the details.
          </p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-warn">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => settle(false)} disabled={saving}>
              Not now
            </Button>
            <Button type="button" onClick={() => void agree()} disabled={saving} aria-busy={saving}>
              {saving ? "Saving…" : "I agree"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsentContext.Provider>
  );
}
