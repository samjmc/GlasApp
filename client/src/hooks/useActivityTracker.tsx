import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ActivityMetadata {
  category?: string;
  pollId?: number;
  postId?: number;
  quizScore?: number;
  constituency?: string;
  partyInteraction?: string;
  duration?: number;
  location?: {
    latitude: number;
    longitude: number;
    county?: string;
  };
  [key: string]: any;
}

export function useActivityTracker() {
  const logActivityMutation = useMutation({
    mutationFn: async ({ action, metadata }: { action: string; metadata?: ActivityMetadata }) => {
      try {
        const response = await apiRequest('POST', '/api/activity/log', {
          action,
          metadata
        });
        return response;
      } catch (error) {
        // If the API endpoint doesn't exist or returns an error, just return null
        // Activity tracking is non-critical and shouldn't disrupt user experience
        return null;
      }
    },
    onError: (error) => {
      // Silently fail - activity tracking shouldn't disrupt user experience
      console.warn('Activity tracking failed:', error);
    }
  });

  const trackActivity = (action: string, metadata?: ActivityMetadata) => {
    logActivityMutation.mutate({ action, metadata });
  };

  // Helper methods for common activities
  const trackQuizStart = () => {
    trackActivity('started_quiz', { category: 'political_engagement' });
  };

  const trackConstituencyView = (constituency: string) => {
    trackActivity('viewed_constituency', {
      category: 'geographic_exploration',
      constituency
    });
  };

  const trackPartyView = (partyName: string) => {
    trackActivity('viewed_party', {
      category: 'political_research',
      partyInteraction: partyName
    });
  };

  const trackPartyCompare = (parties: string[]) => {
    trackActivity('compared_parties', {
      category: 'political_research',
      partyInteraction: parties.join(' vs ')
    });
  };

  const trackPollVote = (pollId: number, choice: string) => {
    trackActivity('voted_poll', {
      category: 'civic_participation',
      pollId,
      choice
    });
  };

  const trackMapInteraction = (interactionType: 'zoom' | 'pan' | 'click', location?: any) => {
    trackActivity('map_interaction', {
      category: 'geographic_exploration',
      interactionType,
      location
    });
  };

  const trackEducationPageView = (page: string) => {
    trackActivity('viewed_education', {
      category: 'learning',
      page
    });
  };

  const trackTimeSpent = (page: string, duration: number) => {
    trackActivity('time_on_page', {
      category: 'engagement',
      page,
      duration
    });
  };

  return {
    trackActivity,
    trackQuizStart,
    trackConstituencyView,
    trackPartyView,
    trackPartyCompare,
    trackPollVote,
    trackMapInteraction,
    trackEducationPageView,
    trackTimeSpent,
    isLogging: logActivityMutation.isPending
  };
}