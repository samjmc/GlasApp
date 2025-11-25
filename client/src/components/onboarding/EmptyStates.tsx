/**
 * Empty State Components
 * Shown when users haven't completed certain actions yet
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, 
  Heart, 
  TrendingUp, 
  MessageSquare, 
  BookOpen,
  Map,
  Users
} from 'lucide-react';

export function EmptyQuizState() {
  return (
    <Card className="p-12 text-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 border-2 border-dashed border-purple-300 dark:border-purple-700">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-800 dark:to-blue-800 rounded-full">
            <Heart className="w-16 h-16 text-purple-600 dark:text-purple-300" />
          </div>
        </div>
        
        <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Discover Your Political Match!
        </h3>
        
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          Take our comprehensive political quiz to see which TDs and parties align with your values. 
          We'll compare your views on 8 key policy areas with every TD's voting record and positions.
        </p>
        
        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 mb-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
            <div>
              <span className="font-semibold">8 Policy Categories</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">Immigration, Healthcare, Housing, Economy, Environment, Social Issues, Justice, Education</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <span className="font-semibold">Personalized Rankings</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">See all 174 TDs ranked by how well they match YOUR political values</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
            <div>
              <span className="font-semibold">Policy-by-Policy Breakdown</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">See where you agree and disagree with each politician on real issues</p>
            </div>
          </div>
        </div>
        
        <Button
          onClick={() => window.location.href = '/enhanced-quiz'}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Heart className="w-5 h-5 mr-2" />
          Take the Quiz (2 minutes)
        </Button>
        
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Your results are private and can be updated anytime
        </p>
      </div>
    </Card>
  );
}

export function EmptyNewsFeedState() {
  return (
    <Card className="p-12 text-center bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-900/20 dark:via-teal-900/20 dark:to-blue-900/20">
      <Sparkles className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold mb-3">News Feed Coming Soon!</h3>
      <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-xl mx-auto">
        Our automated news scraper is being configured. Political news articles will appear here
        once the system runs for the first time.
      </p>
      <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 text-left space-y-2 text-sm max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span>11 Irish news sources (Gript & The Ditch included!)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>AI analysis with bias protection (75-85% reduction)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Automated daily scraping at 6 AM</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <span>TD impact scoring with promise tracking</span>
        </div>
      </div>
    </Card>
  );
}

export function EmptyIdeasState() {
  return (
    <Card className="p-12 text-center bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-dashed border-orange-300 dark:border-orange-700">
      <MessageSquare className="w-16 h-16 text-orange-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold mb-3">Be the First to Submit an Idea!</h3>
      <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-xl mx-auto">
        Have a policy idea that could improve Ireland? Submit it here and let the community vote. 
        Top ideas get visibility and could influence real policy discussions.
      </p>
      <Button
        onClick={() => {
          // Trigger idea submission form
          const submitButton = document.querySelector('[data-submit-idea]') as HTMLButtonElement;
          submitButton?.click();
        }}
        size="lg"
        className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        Submit Your First Idea
      </Button>
    </Card>
  );
}

export function EmptyLocalRepresentativesState() {
  return (
    <Card className="p-12 text-center bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20">
      <Map className="w-16 h-16 text-teal-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold mb-3">Find Your Local TDs</h3>
      <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-xl mx-auto">
        Enable location access to see your constituency and local representatives. 
        We'll show you performance metrics, contact info, and recent activity for your TDs.
      </p>
      <Button
        onClick={() => {
          // Trigger location permission request
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              () => window.location.reload(),
              (error) => alert('Please enable location access to see your local TDs')
            );
          }
        }}
        size="lg"
        className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
      >
        <Map className="w-5 h-5 mr-2" />
        Enable Location
      </Button>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Or manually select your constituency from the map
      </p>
    </Card>
  );
}

export function EmptyRankingsState({ type }: { type: 'td' | 'party' | 'personal' }) {
  const config = {
    td: {
      icon: <Users className="w-16 h-16 text-blue-500" />,
      title: 'TD Rankings Loading...',
      description: 'Rankings will appear once our news analysis system completes its first run.',
      gradient: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    },
    party: {
      icon: <TrendingUp className="w-16 h-16 text-purple-500" />,
      title: 'Party Rankings Loading...',
      description: 'Party performance metrics will be calculated from TD scores and promises.',
      gradient: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
    },
    personal: {
      icon: <Heart className="w-16 h-16 text-pink-500" />,
      title: 'Take the Quiz for Personal Rankings',
      description: 'Complete our political quiz to see which TDs match YOUR values best.',
      gradient: 'from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20',
      cta: {
        text: 'Take Quiz Now',
        action: () => window.location.href = '/enhanced-quiz',
      }
    },
  };

  const { icon, title, description, gradient, cta } = config[type];

  return (
    <Card className={`p-12 text-center bg-gradient-to-r ${gradient}`}>
      <div className="max-w-xl mx-auto">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h3 className="text-2xl font-bold mb-3">{title}</h3>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{description}</p>
        {cta && (
          <Button
            onClick={cta.action}
            size="lg"
            className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
          >
            <Heart className="w-5 h-5 mr-2" />
            {cta.text}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map(i => (
        <Card key={i} className="p-6 animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6"></div>
        </Card>
      ))}
      <p className="text-center text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}






















