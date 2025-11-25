/**
 * First-Time User Tour - Contextual tooltips
 * Shows helpful hints as users navigate the app for the first time
 */

import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    id: 'feed-tab',
    target: '[data-tour="feed-tab"]',
    title: 'News Feed',
    description: 'AI-analyzed political news updated daily. See what TDs are doing and how it impacts their scores.',
    position: 'bottom',
  },
  {
    id: 'rankings-tab',
    target: '[data-tour="rankings-tab"]',
    title: 'TD Rankings',
    description: 'All 174 TDs ranked by performance. Based on news impact, parliamentary activity, and consistency.',
    position: 'bottom',
  },
  {
    id: 'my-rankings-tab',
    target: '[data-tour="my-rankings-tab"]',
    title: 'Your Personal Rankings',
    description: 'Take our quiz to see which TDs match YOUR political values. This tab shows your personalized matches.',
    position: 'bottom',
  },
  {
    id: 'map-tab',
    target: '[data-tour="map-tab"]',
    title: 'Constituency Map',
    description: 'Explore all 43 Irish constituencies. Click any area to see local TDs and performance data.',
    position: 'bottom',
  },
];

export function FirstTimeUserTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    // Check if user has seen the tour
    const hasSeenTour = localStorage.getItem('hasSeenInterfaceTour');
    if (!hasSeenTour) {
      // Wait for page to load, then start tour
      setTimeout(() => {
        setIsVisible(true);
        updatePosition();
      }, 1000);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [currentStep, isVisible]);

  const updatePosition = () => {
    const step = tourSteps[currentStep];
    const target = document.querySelector(step.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 150;

      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'bottom':
          top = rect.bottom + 10;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'top':
          top = rect.top - tooltipHeight - 10;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - 10;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + 10;
          break;
      }

      // Keep within viewport
      top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));
      left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

      setPosition({ top, left });

      // Highlight the target element
      target.classList.add('tour-highlight');
      setTimeout(() => target.classList.remove('tour-highlight'), 2000);
    }
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem('hasSeenInterfaceTour', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none" />

      {/* Tooltip */}
      <div
        className="fixed z-50 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-4 border-2 border-emerald-500 transition-all duration-300"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close tour"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {/* Content */}
        <div className="mb-4">
          <h4 className="font-bold text-lg mb-2 text-emerald-600 dark:text-emerald-400">
            {step.title}
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {step.description}
          </p>
        </div>

        {/* Progress and navigation */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {currentStep + 1} of {tourSteps.length}
          </div>
          <Button
            onClick={handleNext}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {currentStep === tourSteps.length - 1 ? 'Got it!' : 'Next'}
            {currentStep < tourSteps.length - 1 && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* CSS for tour highlight effect */}
      <style>{`
        .tour-highlight {
          animation: tour-pulse 2s ease-in-out;
          position: relative;
          z-index: 45;
        }
        @keyframes tour-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
          }
        }
      `}</style>
    </>
  );
}






















