/**
 * Onboarding: a short step-through for signed-in users who have not seen it.
 * Shown as a small floating card, so it never covers the page. Closing it (X, Escape,
 * Skip or finishing) marks it seen on the user's account.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Landmark, Lightbulb, MapPin, Newspaper, Trophy, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FloatingPanel } from '@/components/home/FloatingPanel';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  title: string;
  description: string;
  icon: LucideIcon;
  cta?: { text: string; href: string };
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to Glas',
    description: 'Every TD, scored from the official Oireachtas record: votes, questions and debate.',
    icon: Landmark,
  },
  {
    title: 'News, summarised',
    description: 'We read Irish news through the day and show how each story affects the TDs in it.',
    icon: Newspaper,
  },
  {
    title: 'Rankings',
    description: 'See how all 174 TDs and the parties compare.',
    icon: Trophy,
    cta: { text: 'Open rankings', href: '/rankings' },
  },
  {
    title: 'Your matches',
    description: 'Take the quiz to see which TDs and parties share your views.',
    icon: Compass,
    cta: { text: 'Take the quiz', href: '/quiz' },
  },
  {
    title: 'Your constituency',
    description: 'Find your local TDs and how they vote.',
    icon: MapPin,
    cta: { text: 'Constituencies', href: '/constituencies' },
  },
  {
    title: 'Have your say',
    description: 'Post policy ideas and vote on the ones that matter to you.',
    icon: Lightbulb,
    cta: { text: 'See ideas', href: '/ideas' },
  },
];

/** Multi-step onboarding shown once to new signed-in users. */
export function OnboardingModal() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    supabase.auth.getUser().then(({ data: { user: supabaseUser } }) => {
      if (cancelled || supabaseUser?.user_metadata?.has_seen_onboarding) return;
      timer = setTimeout(() => setIsOpen(true), 500);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, user]);

  const handleClose = async (completed = false) => {
    setIsOpen(false);
    if (isAuthenticated) {
      await supabase.auth.updateUser({
        data: {
          has_seen_onboarding: true,
          onboarding_completed_at: completed ? new Date().toISOString() : null,
        },
      });
    }
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <FloatingPanel label="Getting started" onClose={() => handleClose(false)}>
      <div className="flex flex-col gap-4 pr-6">
        <span className="text-[13px] font-semibold text-muted-foreground">
          Step {currentStep + 1} of {STEPS.length}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="flex items-start gap-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-lg font-bold leading-tight">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              {step.cta && (
                <Link href={step.cta.href} onClick={() => handleClose(false)} className="mt-1 text-sm font-bold text-primary hover:underline">
                  {step.cta.text}
                </Link>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {STEPS.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentStep(index)}
              aria-label={`Go to step ${index + 1}`}
              aria-current={index === currentStep ? 'step' : undefined}
              className="flex h-6 items-center"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-200',
                  index === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-input'
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {currentStep === 0 ? (
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Skip
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={() => (isLast ? handleClose(true) : setCurrentStep((s) => s + 1))}>
            {isLast ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}
