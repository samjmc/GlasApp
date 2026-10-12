import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookie_consent";

function acknowledge() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ essential: true }));
    localStorage.setItem("cookie_consent_date", new Date().toISOString());
  } catch {
    // Storage blocked: the notice will show again next visit.
  }
}

/**
 * Cookie notice, shown once. It does not block the page. The app stores only what it needs to work
 * (sign-in, region, quiz progress, theme, tour and install-prompt flags) and has no analytics, so
 * there is nothing to opt in to.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Treat as not yet acknowledged.
    }
    if (stored) return;
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <section
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-[calc(92px_+_env(safe-area-inset-bottom,0px))] z-50 animate-fade-up rounded-2xl border bg-popover p-5 shadow-2xl shadow-black/40 md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-primary">
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">Cookies</h2>
          <p className="text-sm text-muted-foreground">
            We only store what the app needs to work: your sign-in, your region, and your quiz progress and settings on
            this device. There are no analytics or advertising cookies.{" "}
            <Link href="/privacy-policy#cookies" className="font-semibold text-primary hover:underline">
              Privacy policy
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => {
            acknowledge();
            setVisible(false);
          }}
        >
          OK
        </Button>
      </div>
    </section>
  );
}
