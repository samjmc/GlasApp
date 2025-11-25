/**
 * TD Rating Card Component
 * Allows users to rate TDs on various dimensions
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Star, Check, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/queryClient';

interface TDRatingCardProps {
  tdName: string;
  constituency?: string;
  party?: string;
  compact?: boolean;
}

interface RatingData {
  transparency?: number;
  effectiveness?: number;
  integrity?: number;
  consistency?: number;
  constituencyService?: number;
  comment?: string;
}

interface UserRating {
  has_rating: boolean;
  rating: RatingData | null;
}

export function TDRatingCard({ tdName, constituency, party, compact = false }: TDRatingCardProps) {
  const queryClient = useQueryClient();
  
  // State
  const [transparency, setTransparency] = useState<number>(50);
  const [effectiveness, setEffectiveness] = useState<number>(50);
  const [integrity, setIntegrity] = useState<number>(50);
  const [consistency, setConsistency] = useState<number>(50);
  const [constituencyService, setConstituencyService] = useState<number>(50);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  
  // Fetch user's existing rating
  const { data: userRating } = useQuery<UserRating>({
    queryKey: [`/api/ratings/user/${tdName}`],
    queryFn: async () => {
      const res = await apiClient.get(`/api/ratings/user/${encodeURIComponent(tdName)}`);
      return res.data;
    }
  });
  
  // Load existing rating into state
  useEffect(() => {
    if (userRating?.has_rating && userRating.rating) {
      const r = userRating.rating;
      if (r.transparency !== undefined) setTransparency(r.transparency);
      if (r.effectiveness !== undefined) setEffectiveness(r.effectiveness);
      if (r.integrity !== undefined) setIntegrity(r.integrity);
      if (r.consistency !== undefined) setConsistency(r.consistency);
      if (r.constituencyService !== undefined) setConstituencyService(r.constituencyService);
      if (r.comment) setComment(r.comment);
    }
  }, [userRating]);
  
  // Submit rating mutation
  const submitRating = useMutation({
    mutationFn: async (data: RatingData) => {
      const res = await apiClient.post('/api/ratings/submit', {
        tdName,
        transparency,
        effectiveness,
        integrity,
        consistency,
        constituencyService,
        comment: comment.trim() || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [`/api/ratings/user/${tdName}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ratings/td/${tdName}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/parliamentary/scores/td/', tdName] });
    }
  });
  
  const handleSubmit = () => {
    submitRating.mutate({
      transparency,
      effectiveness,
      integrity,
      consistency,
      constituencyService,
      comment: comment.trim() || undefined
    });
  };
  
  if (compact) {
    return (
      <Card className="mx-auto w-full max-w-[360px] border border-emerald-200/80 bg-white/90 backdrop-blur-sm sm:max-w-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-900">Rate {tdName}</h3>
          </div>
          
          <div className="space-y-3">
            {/* Quick rating slider */}
            <div>
              <label className="text-sm text-gray-700 mb-1 block">Overall Rating</label>
              <Slider
                value={[transparency]}
                onValueChange={(v) => {
                  setTransparency(v[0]);
                  setEffectiveness(v[0]);
                  setIntegrity(v[0]);
                  setConsistency(v[0]);
                  setConstituencyService(v[0]);
                }}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Poor</span>
                <span className="font-semibold text-emerald-700">{transparency}/100</span>
                <span>Excellent</span>
              </div>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={submitRating.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {submitRating.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : submitted ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Submitted!
                </>
              ) : (
                'Submit Rating'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mx-auto w-full max-w-[400px] border border-emerald-200/80 bg-white/90 backdrop-blur-sm sm:max-w-none">
      <CardHeader className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-blue-50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="text-lg font-semibold text-emerald-900">Rate {tdName}</h3>
            {constituency && party && (
              <p className="text-xs text-gray-600 sm:text-sm">{party} • {constituency}</p>
            )}
          </div>
        </div>
        {userRating?.has_rating && (
          <p className="mt-2 text-xs text-emerald-700 sm:text-sm">✓ You've already rated this TD. Update your rating below.</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4 px-4 py-5 sm:space-y-6 sm:px-6">
        {/* Transparency */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Transparency
            <span className="ml-2 text-xs font-normal text-gray-600 sm:text-sm">
              (How open and honest are they?)
            </span>
          </label>
          <Slider
            value={[transparency]}
            onValueChange={(v) => setTransparency(v[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>Very Opaque</span>
            <span className="text-sm font-semibold text-emerald-700">{transparency}/100</span>
            <span>Very Transparent</span>
          </div>
        </div>
        
        {/* Effectiveness */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Effectiveness
            <span className="ml-2 text-xs font-normal text-gray-600 sm:text-sm">
              (Do they get things done?)
            </span>
          </label>
          <Slider
            value={[effectiveness]}
            onValueChange={(v) => setEffectiveness(v[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>Ineffective</span>
            <span className="text-sm font-semibold text-emerald-700">{effectiveness}/100</span>
            <span>Very Effective</span>
          </div>
        </div>
        
        {/* Integrity */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Integrity
            <span className="ml-2 text-xs font-normal text-gray-600 sm:text-sm">
              (Can they be trusted?)
            </span>
          </label>
          <Slider
            value={[integrity]}
            onValueChange={(v) => setIntegrity(v[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>Low Integrity</span>
            <span className="text-sm font-semibold text-emerald-700">{integrity}/100</span>
            <span>High Integrity</span>
          </div>
        </div>
        
        {/* Consistency */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Consistency
            <span className="ml-2 text-xs font-normal text-gray-600 sm:text-sm">
              (Do they follow through on promises?)
            </span>
          </label>
          <Slider
            value={[consistency]}
            onValueChange={(v) => setConsistency(v[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>Inconsistent</span>
            <span className="text-sm font-semibold text-emerald-700">{consistency}/100</span>
            <span>Very Consistent</span>
          </div>
        </div>
        
        {/* Constituency Service */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Constituency Service
            <span className="ml-2 text-xs font-normal text-gray-600 sm:text-sm">
              (How well do they serve their constituents?)
            </span>
          </label>
          <Slider
            value={[constituencyService]}
            onValueChange={(v) => setConstituencyService(v[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>Poor Service</span>
            <span className="text-sm font-semibold text-emerald-700">{constituencyService}/100</span>
            <span>Excellent Service</span>
          </div>
        </div>
        
        {/* Comment */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Additional Comments
            <span className="ml-2 text-xs font-normal text-gray-600 sm:text-sm">
              (Optional)
            </span>
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about this TD's performance..."
            maxLength={500}
            rows={3}
            className="w-full"
          />
          <div className="mt-1 text-right text-[11px] text-gray-500">
            {comment.length}/500
          </div>
        </div>
        
        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitRating.isPending}
          className="w-full bg-emerald-600 py-4 text-sm font-semibold text-white hover:bg-emerald-700 sm:py-5 sm:text-base"
        >
          {submitRating.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting Your Rating...
            </>
          ) : submitted ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Rating Submitted Successfully!
            </>
          ) : (
            userRating?.has_rating ? 'Update Rating' : 'Submit Rating'
          )}
        </Button>
        
        {submitRating.isError && (
          <p className="text-red-600 text-sm text-center">
            Failed to submit rating. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

