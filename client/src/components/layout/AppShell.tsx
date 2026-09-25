import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Check, Compass, Flame, Globe, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDailySession } from "@/hooks/useDailySession";
import { GlobalSearch } from "@/components/GlobalSearch";
import { GlasLogo } from "@/components/pulse/GlasMark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";
import { BOTTOM_NAV, FOOTER_LINKS, MAIN_NAV, isActive, labelFor, type NavItem } from "./nav";
import { useRegion } from "@/hooks/useRegion";

/** The day's streak, or null when unknown. */
function useStreak(): number | null {
  const { isAuthenticated } = useAuth();
  const { data } = useDailySession(isAuthenticated);
  if (!isAuthenticated || !data) return null;
  return typeof data.streakCount === "number" ? data.streakCount : data.completion?.streakCount ?? null;
}

function StreakChip({ streak }: { streak: number }) {
  return (
    <Link
      href="/daily-session"
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-warn/15 px-3 text-sm font-bold text-warn transition-colors hover:bg-warn/25"
      aria-label={`${streak}-day voting streak`}
    >
      <Flame className="h-4 w-4" aria-hidden="true" />
      {streak}
    </Link>
  );
}

/** Signed in: the daily vote. Signed out: the quiz. Preview regions: pick a region. */
function usePrimaryAction() {
  const { isAuthenticated } = useAuth();
  const { region } = useRegion();
  if (region?.status === "preview") {
    return { href: "/select-region", label: "Change region", icon: Globe, title: `The ${region.shortName} edition is in preview`, body: "Scores are live for Ireland today. Switch region any time.", cta: "Change region" };
  }
  return isAuthenticated
    ? { href: "/daily-session", label: "Daily vote", icon: Check, title: "Have your say today", body: "Vote on today's questions and see where you stand next to your TDs.", cta: "Start daily vote" }
    : { href: "/quiz", label: "Quiz", icon: Compass, title: "Where do you stand?", body: "Take the ideology quiz and see which parties and TDs match you.", cta: "Take the quiz" };
}

function SidebarLink({ item, location }: { item: NavItem; location: string }) {
  const { region } = useRegion();
  const label = labelFor(item, region);
  const active = isActive(item, location);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors",
        "justify-center lg:justify-start",
        active ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} aria-hidden="true" />
      <span className="sr-only lg:not-sr-only">{label}</span>
    </Link>
  );
}

function Sidebar({ location }: { location: string }) {
  const action = usePrimaryAction();
  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col gap-7 border-r px-3 py-6 md:flex lg:w-64 lg:px-4">
      <Link href="/" className="flex items-center justify-center px-1 lg:justify-start lg:px-3" aria-label="Glas Politics home">
        <GlasLogo />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {MAIN_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} location={location} />
        ))}
      </nav>
      <div className="mt-auto hidden flex-col gap-2.5 rounded-xl bg-primary p-4 text-primary-foreground lg:flex">
        <p className="font-display text-xl font-bold leading-tight">{action.title}</p>
        <p className="text-sm leading-snug opacity-90">{action.body}</p>
        <Link
          href={action.href}
          className="mt-1 flex h-11 items-center justify-center rounded-lg bg-primary-foreground text-[15px] font-bold text-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          {action.cta}
        </Link>
      </div>
      <nav aria-label="Legal" className="hidden flex-wrap gap-x-3 gap-y-1 px-3 text-xs text-muted-foreground lg:flex">
        {FOOTER_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

/** Which edition you are in; opens the region picker. */
function RegionChip() {
  const { region } = useRegion();
  const [location] = useLocation();
  if (!region) return null;
  return (
    <Link
      href={`/select-region?next=${encodeURIComponent(location)}`}
      aria-label={`Region: ${region.name}. Change region`}
      className="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-bold transition-colors hover:bg-elevated"
    >
      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      {region.code}
      {region.status === "preview" && <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">Preview</span>}
    </Link>
  );
}

function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [location] = useLocation();
  const streak = useStreak();

  // Picking a search result navigates; the phone search sheet must not stay over the new page.
  useEffect(() => setSearchOpen(false), [location]);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-lg md:border-b-0">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="md:hidden" aria-label="Glas Politics home">
          <GlasLogo />
        </Link>
        <div className="hidden min-w-0 max-w-xl flex-1 md:block">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search className="!size-5" />
          </Button>
          <RegionChip />
          {streak !== null && streak > 0 && <StreakChip streak={streak} />}
          <AccountMenu />
        </div>
      </div>
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="px-4 pb-6 pt-12">
          <SheetTitle className="sr-only">Search</SheetTitle>
          <GlobalSearch />
        </SheetContent>
      </Sheet>
    </header>
  );
}

function BottomTab({ item, location }: { item: NavItem; location: string }) {
  const { region } = useRegion();
  const active = isActive(item, location);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition-colors active:scale-95",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
      {labelFor(item, region, true)}
    </Link>
  );
}

function BottomNav({ location }: { location: string }) {
  const action = usePrimaryAction();
  const ActionIcon = action.icon;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 z-40 grid h-[68px] grid-cols-5 items-center rounded-2xl border bg-elevated/95 px-2 shadow-2xl shadow-black/40 backdrop-blur-lg md:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      {BOTTOM_NAV.left.map((item) => (
        <BottomTab key={item.href} item={item} location={location} />
      ))}
      <Link
        href={action.href}
        aria-label={action.label}
        aria-current={location.split("?")[0] === action.href ? "page" : undefined}
        className={cn(
          "flex h-14 w-14 items-center justify-center justify-self-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:bg-primary-hover active:scale-95",
          location.split("?")[0] === action.href && "ring-2 ring-primary ring-offset-2 ring-offset-elevated"
        )}
      >
        <ActionIcon className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" />
      </Link>
      {BOTTOM_NAV.right.map((item) => (
        <BottomTab key={item.href} item={item} location={location} />
      ))}
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-4 pb-32 pt-10 text-sm text-muted-foreground sm:px-6 md:pb-10 lg:hidden">
      <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
        {FOOTER_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs">© {new Date().getFullYear()} Glas Politics</p>
    </footer>
  );
}

/**
 * The app frame. Phone: top bar + floating bottom bar. Tablet: icon rail. Desktop: full sidebar.
 * `bare` pages (the daily session) get the whole screen.
 */
export function AppShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const [location] = useLocation();

  if (bare) {
    return <div className="min-h-[100dvh] bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar location={location} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-10 lg:pt-6">
          {children}
        </main>
        <SiteFooter />
      </div>
      <BottomNav location={location} />
    </div>
  );
}
