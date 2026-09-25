/**
 * First-time tour: a one-time floating card for visitors who are not signed in,
 * pointing to the main parts of the app. Signed-in users get OnboardingModal instead.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Compass, Landmark, MapPin, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { FloatingPanel } from '@/components/home/FloatingPanel';

const STORAGE_KEY = 'hasSeenInterfaceTour';

const STOPS = [
  { href: '/rankings', icon: Trophy, title: 'Rankings', text: 'All 174 TDs, scored' },
  { href: '/debates', icon: Landmark, title: 'Dáil record', text: 'Every vote and debate' },
  { href: '/constituencies', icon: MapPin, title: 'Constituencies', text: 'Find your local TDs' },
  { href: '/quiz', icon: Compass, title: 'Ideology quiz', text: 'See who shares your views' },
];

function hasSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true; // Storage blocked: do not nag on every visit.
  }
}

/** One-time guide to the main areas, for first-time visitors. */
export function FirstTimeUserTour() {
  const { isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated || hasSeen()) return;
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const handleClose = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage blocked: the card closes for this visit only.
    }
    setIsVisible(false);
  };

  if (!isVisible || isAuthenticated) return null;

  return (
    <FloatingPanel label="New here?" onClose={handleClose}>
      <h2 className="pr-8 font-display text-lg font-bold">New here? Start with these</h2>
      <ul className="mt-3 flex flex-col gap-1">
        {STOPS.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={handleClose}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated"
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[13px] text-muted-foreground">{text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={handleClose} className="mt-3 w-full">
        Got it
      </Button>
    </FloatingPanel>
  );
}
