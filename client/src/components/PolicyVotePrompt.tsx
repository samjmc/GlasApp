import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SliderVoteControl } from "@/components/votes/SliderVoteControl";
import { MultipleChoiceVoteControl } from "@/components/votes/MultipleChoiceVoteControl";

export interface PolicyVoteData {
  id: number;
  question: string;
  options: Record<string, string>;
  domain?: string;
  topic?: string;
  confidence?: number | null;
  rationale?: string | null;
  sourceHint?: string | null;
}

interface PolicyVotePromptProps {
  articleId: number;
  policyVote: PolicyVoteData;
}

interface RawVoteStats {
  politician_name?: string;
  total_votes: number;
  five_stars: number;
  four_stars: number;
  three_stars: number;
  two_stars: number;
  one_star: number;
}

interface VoteStats {
  total_votes: number;
  five_stars: number;
  four_stars: number;
  three_stars: number;
  two_stars: number;
  one_star: number;
}

export function PolicyVotePrompt({ articleId, policyVote }: PolicyVotePromptProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [pendingRating, setPendingRating] = useState<number>(3);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [userSelectedOption, setUserSelectedOption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionEntries = useMemo(
    () => Object.entries(policyVote.options ?? {}),
    [policyVote.options]
  );

  const policyVoteKey = useMemo(
    () => `policy_vote_${policyVote.id}`,
    [policyVote.id]
  );

  // Determine if we should use multiple choice (3+ options) or slider (2 options)
  const useMultipleChoice = optionEntries.length >= 3;
  const leftLabel = optionEntries[0]?.[1] ?? "Strongly oppose";
  const rightLabel = optionEntries[optionEntries.length - 1]?.[1] ?? "Strongly support";

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const statsRes = await fetch(`/api/policy-votes/article/${articleId}`);
        if (!statsRes.ok) {
          throw new Error("Failed to load vote stats");
        }
        const statsData = await statsRes.json();
        if (isMounted) {
          const policyVoteKey = `policy_vote_${policyVote.id}`;
          const entry = (statsData?.stats as RawVoteStats[] | undefined)?.find(
            (s) => s.politician_name === policyVoteKey
          ) ?? (statsData?.stats?.[0] as RawVoteStats | undefined);
          if (entry) {
            const mapped: VoteStats = {
              total_votes: entry.total_votes ?? 0,
              five_stars: entry.five_stars ?? 0,
              four_stars: entry.four_stars ?? 0,
              three_stars: entry.three_stars ?? 0,
              two_stars: entry.two_stars ?? 0,
              one_star: entry.one_star ?? 0,
            };
            setVoteStats(mapped);
          } else {
            setVoteStats(null);
          }
        }

        let ratingFromVotes: number | null = null;

        const policyVoteKey = `policy_vote_${policyVote.id}`;

        if (isAuthenticated && token) {
          const userRes = await fetch(`/api/policy-votes/user/me/article/${articleId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            const votes: Array<{ politician_name?: string; support_rating?: number }> =
              userData?.votes ?? [];
            const matchingVote =
              votes.find((vote) => vote.politician_name === policyVoteKey) ?? votes[0];
            const firstVote = matchingVote;
            ratingFromVotes = firstVote?.support_rating ?? null;
          }

          if (ratingFromVotes === null && optionEntries.length > 0) {
            const legacyRes = await fetch(
              `/api/policy-votes/opportunity/${policyVote.id}/user`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            ).catch(() => null);
            if (legacyRes && legacyRes.ok) {
              const legacyData = await legacyRes.json().catch(() => null);
              const selectedOption: string | undefined =
                legacyData?.response?.selected_option;
              if (selectedOption) {
                if (isMounted) {
                  setUserSelectedOption(selectedOption);
                  setPendingOption(selectedOption);
                }
                const optionKeys = optionEntries.map(([key]) => key);
                const index = optionKeys.indexOf(selectedOption);
                if (index !== -1) {
                  ratingFromVotes =
                    optionKeys.length <= 1
                      ? 3
                      : index === 0
                      ? 5
                      : index === optionKeys.length - 1
                      ? 1
                      : 3;
                }
              }
            }
          }
        }

        if (isMounted) {
          setUserRating(ratingFromVotes);
          setPendingRating(ratingFromVotes ?? 3);
          // If we didn't get a selected option from legacy API, check if we have one from rating
          if (!userSelectedOption && ratingFromVotes !== null && useMultipleChoice) {
            // Map rating back to option (approximate)
            const optionKeys = optionEntries.map(([key]) => key);
            if (ratingFromVotes >= 4) {
              setPendingOption(optionKeys[0] ?? null);
            } else if (ratingFromVotes <= 2) {
              setPendingOption(optionKeys[optionKeys.length - 1] ?? null);
            } else {
              setPendingOption(optionKeys[Math.floor(optionKeys.length / 2)] ?? null);
            }
          }
        }
        if (!isAuthenticated || !token) {
          setUserRating(null);
          setPendingRating(3);
        }
      } catch (err: any) {
        console.error("PolicyVotePrompt load error:", err);
        if (isMounted) {
          setError(err.message || "Unable to load policy vote");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [policyVote.id, isAuthenticated]);

  const totalVotes = useMemo(() => voteStats?.total_votes ?? 0, [voteStats]);

  const handleVote = async (rating?: number, optionKey?: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Log in to vote",
        description: "Policy votes personalise your TD and party matches. Please sign in first.",
        variant: "default",
      });
      return;
    }

    // For multiple choice: require optionKey, for slider: require rating
    if (useMultipleChoice && !optionKey) {
      return; // Need optionKey for multiple choice
    }
    if (!useMultipleChoice && rating === undefined) {
      return; // Need rating for slider
    }

    if (useMultipleChoice && optionKey) {
      if (userSelectedOption === optionKey) {
        return; // Already selected
      }
      setPendingOption(optionKey);
    } else if (rating !== undefined) {
      const roundedRating = Math.round(rating);
      setPendingRating(roundedRating);
      if (userRating !== null && userRating === roundedRating) {
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast({
          title: "Session expired",
          description: "Please sign in again to vote on policies.",
          variant: "destructive",
        });
        return;
      }

      // For multiple choice: use the opportunity response endpoint
      // For slider: use the main policy-votes endpoint
      let res: Response;
      
      if (useMultipleChoice && optionKey) {
        // Use the opportunity response endpoint which properly handles optionKey and maps to ideology
        res = await fetch(`/api/policy-votes/opportunity/${policyVote.id}/respond`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedOption: optionKey,
          }),
        });
      } else {
        // Use slider rating
        const roundedRating = Math.round(rating!);
        res = await fetch(`/api/policy-votes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            articleId,
            politicianName: policyVoteKey,
            supportRating: roundedRating,
          }),
        });
      }

      const responseData = await res.json().catch(() => null);

      if (!res.ok || !responseData?.success) {
        const errorMessage = responseData?.error || "Failed to save vote";
        throw new Error(errorMessage);
      }

      if (useMultipleChoice && optionKey) {
        setUserSelectedOption(optionKey);
        // Map option to approximate rating for display
        const optionKeys = optionEntries.map(([key]) => key);
        const index = optionKeys.indexOf(optionKey);
        const mappedRating = index === 0 ? 5 : index === optionKeys.length - 1 ? 1 : 3;
        setUserRating(mappedRating);
      } else {
        setUserRating(Math.round(rating!));
      }
      toast({
        title: "Vote recorded",
        description: "Thanks! Your stance will shape future recommendations.",
      });

      const event = new CustomEvent('personal-rankings:update', {
        detail: {
          updatedProfile: responseData.updatedProfile ?? null,
          topMatches: responseData.topMatches ?? [],
        },
      });
      window.dispatchEvent(event);

      // Refresh stats
      const statsRes = await fetch(`/api/policy-votes/article/${articleId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const policyVoteKey = `policy_vote_${policyVote.id}`;
        const entry = (statsData?.stats as RawVoteStats[] | undefined)?.find(
          (s) => s.politician_name === policyVoteKey
        ) ?? (statsData?.stats?.[0] as RawVoteStats | undefined);
        if (entry) {
          const mapped: VoteStats = {
            total_votes: entry.total_votes ?? 0,
            five_stars: entry.five_stars ?? 0,
            four_stars: entry.four_stars ?? 0,
            three_stars: entry.three_stars ?? 0,
            two_stars: entry.two_stars ?? 0,
            one_star: entry.one_star ?? 0,
          };
          setVoteStats(mapped);
        } else {
          setVoteStats(null);
        }
      }
    } catch (err: any) {
      console.error('PolicyVotePrompt submit error:', err);
      setError(err.message || 'Failed to save vote');
      toast({
        title: 'Could not save vote',
        description: err.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const starStats =
    voteStats &&
    [
      { rating: 5, label: "Strongly support", count: voteStats.five_stars },
      { rating: 4, label: "Support", count: voteStats.four_stars },
      { rating: 3, label: "Neutral", count: voteStats.three_stars },
      { rating: 2, label: "Oppose", count: voteStats.two_stars },
      { rating: 1, label: "Strongly oppose", count: voteStats.one_star },
    ];

  return (
    <Card className="mx-auto w-full max-w-[400px] space-y-4 border-emerald-500/40 bg-gradient-to-br from-emerald-900/20 via-gray-900/30 to-gray-900/10 p-4 sm:max-w-none sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80 sm:text-sm">Policy Vote</h4>
          <p className="mt-1 text-sm font-medium text-white sm:text-base">{policyVote.question}</p>
          {policyVote.topic && (
            <Badge variant="outline" className="mt-2 border-emerald-500/40 text-[11px] text-emerald-200">
              {policyVote.topic.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
        {policyVote.confidence !== undefined && policyVote.confidence !== null && (
          <div className="text-right">
            <div className="text-[10px] uppercase text-emerald-300/70 tracking-wide">Confidence</div>
            <div className="font-bold text-emerald-200 text-sm">
              {(policyVote.confidence * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {policyVote.rationale && (
        <div className="text-sm text-emerald-100/80 flex gap-2">
          <Info className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
          <p>{policyVote.rationale}</p>
        </div>
      )}

      <div className="space-y-3">
        {useMultipleChoice ? (
          <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-4 backdrop-blur-sm sm:p-5">
            <MultipleChoiceVoteControl
              options={policyVote.options}
              selectedOption={pendingOption ?? userSelectedOption ?? null}
              onSelect={(optionKey) => {
                setPendingOption(optionKey);
                void handleVote(undefined, optionKey);
              }}
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-4 backdrop-blur-sm sm:p-5">
              <SliderVoteControl
                value={pendingRating}
                onValueChange={(value) => setPendingRating(Math.round(value))}
                onValueCommit={(value) => void handleVote(Math.round(value))}
                disabled={isSubmitting}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
              />
            </div>
            <div className="text-center text-xs text-gray-300 sm:text-sm">
              Current stance:{" "}
              <span className="font-semibold text-emerald-300">
                {userRating ? `${userRating}/5` : `${pendingRating}/5`}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 sm:text-xs">
        <span>Total votes: {totalVotes}</span>
        {policyVote.sourceHint && (
          <span className="italic">Source: {policyVote.sourceHint}</span>
        )}
      </div>

      {starStats && (
        <div className="space-y-2">
          {starStats.map(({ rating, label, count }) => {
            const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
            return (
              <div key={rating} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>
                    {rating}★ · {label}
                  </span>
                  <span>
                    {percentage}% · {count} vote{count === 1 ? "" : "s"}
                  </span>
                </div>
                <Progress value={percentage} className="h-2 bg-gray-800" />
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-300 bg-red-900/40 border border-red-800/60 rounded-md p-2">
          {error}
        </div>
      )}
    </Card>
  );
}

