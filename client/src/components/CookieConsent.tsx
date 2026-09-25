import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
}

const STORAGE_KEY = "cookie_consent";

const OPTIONAL: { key: Exclude<keyof CookiePreferences, "essential">; title: string; body: string }[] = [
  { key: "analytics", title: "Analytics", body: "Anonymous page views and errors, so we can improve the app." },
  { key: "functional", title: "Preferences", body: "Remember things like your quiz progress and settings." },
];

function save(prefs: CookiePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem("cookie_consent_date", new Date().toISOString());
  } catch {
    // Storage blocked: the banner will ask again next visit.
  }
  document.cookie = `cookie_analytics=${prefs.analytics ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
  document.cookie = `cookie_functional=${prefs.functional ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Cookie choice, shown once. It does not block the page. */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({ essential: true, analytics: false, functional: false });

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Treat as no choice made.
    }
    if (stored) return;
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const finish = (choice: CookiePreferences) => {
    save(choice);
    setVisible(false);
  };

  return (
    <section
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-[calc(92px_+_env(safe-area-inset-bottom,0px))] z-50 animate-fade-up rounded-2xl border bg-popover p-5 shadow-2xl shadow-black/40 md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-primary">
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">Cookies</h2>
          <p className="text-sm text-muted-foreground">
            We use essential cookies to sign you in and keep the site secure. Others only if you say yes.{" "}
            <Link href="/privacy-policy" className="font-semibold text-primary hover:underline">
              Privacy policy
            </Link>
          </p>
        </div>
      </div>

      {customising && (
        <ul className="mt-4 flex flex-col gap-3">
          <li className="flex items-center justify-between gap-4 rounded-xl bg-elevated p-3">
            <div>
              <p className="text-sm font-semibold">Essential</p>
              <p className="text-[13px] text-muted-foreground">Sign-in and security. Always on.</p>
            </div>
            <Switch checked disabled aria-label="Essential cookies, always on" />
          </li>
          {OPTIONAL.map((option) => (
            <li key={option.key} className="flex items-center justify-between gap-4 rounded-xl bg-elevated p-3">
              <div>
                <p className="text-sm font-semibold">{option.title}</p>
                <p className="text-[13px] text-muted-foreground">{option.body}</p>
              </div>
              <Switch
                checked={prefs[option.key]}
                onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [option.key]: checked }))}
                aria-label={`${option.title} cookies`}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {customising ? (
          <>
            <Button variant="secondary" onClick={() => setCustomising(false)}>
              Back
            </Button>
            <Button onClick={() => finish(prefs)}>Save choices</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => finish({ essential: true, analytics: false, functional: false })}>
              Essential only
            </Button>
            <Button onClick={() => finish({ essential: true, analytics: true, functional: true })}>Accept all</Button>
            <Button variant="link" className="col-span-2 justify-self-center" onClick={() => setCustomising(true)}>
              Choose which cookies
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
