/**
 * The signed-in user's consent to store political answers (server/consent).
 *
 * `ensureConsent()` resolves true at once when consent is given; otherwise it shows the consent
 * dialog and resolves with the user's choice. Call it before any action that stores an opinion.
 * The server refuses those actions without consent anyway; this is what makes that a question
 * rather than an error.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { POLITICAL_CONSENT_VERSION, type ConsentStatus } from "@shared/consent";
import { PoliticalConsentDialog } from "@/components/consent/PoliticalConsentDialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchConsent, grantConsent, withdrawConsent } from "@/lib/consentApi";

export type ConsentState = "signed-out" | "loading" | "granted" | "missing";

interface ConsentValue {
  state: ConsentState;
  grantedAt: string | null;
  ensureConsent: () => Promise<boolean>;
  /** Withdraws consent and deletes the political answers it covered. */
  withdraw: () => Promise<void>;
}

const ConsentContext = createContext<ConsentValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const key = ["/api/consent", user?.id];
  const status = useQuery({ queryKey: key, queryFn: fetchConsent, enabled: isAuthenticated });
  const [open, setOpen] = useState(false);
  const pending = useRef<((agreed: boolean) => void) | null>(null);

  const settle = (agreed: boolean) => {
    setOpen(false);
    pending.current?.(agreed);
    pending.current = null;
  };

  const grant = useMutation({
    mutationFn: () => grantConsent(POLITICAL_CONSENT_VERSION),
    onSuccess: (next: ConsentStatus) => {
      queryClient.setQueryData(key, next);
      settle(true);
    },
    onError: () => toast({ title: "Not saved", description: "We could not save your choice. Try again.", variant: "destructive" }),
  });

  const state: ConsentState = !isAuthenticated
    ? "signed-out"
    : status.data
      ? status.data.granted
        ? "granted"
        : "missing"
      : "loading";

  const ensureConsent = useCallback(() => {
    if (state === "granted") return Promise.resolve(true);
    if (state === "signed-out") return Promise.resolve(false);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      pending.current?.(false); // a second ask replaces the first
      pending.current = resolve;
    });
  }, [state]);

  const withdraw = useCallback(async () => {
    await withdrawConsent();
    // Every cached answer, vote and profile of this user is gone on the server.
    await queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <ConsentContext.Provider value={{ state, grantedAt: status.data?.grantedAt ?? null, ensureConsent, withdraw }}>
      {children}
      <PoliticalConsentDialog open={open} saving={grant.isPending} onAgree={() => grant.mutate()} onDecline={() => settle(false)} />
    </ConsentContext.Provider>
  );
}

export function usePoliticalConsent(): ConsentValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("usePoliticalConsent must be used inside ConsentProvider");
  return value;
}
