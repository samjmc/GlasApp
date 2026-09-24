import React, { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DIMENSION_POLES, type IdeologyDimension, type IdeologyVector } from "@shared/ideology";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { getPartyColor } from "@/assets/election-results";
import {
  fetchMatchesForVector,
  fetchMyMatches,
  type DimensionWeights,
  type Matches,
} from "@/lib/ideologyApi";

interface PartyMatchResultsProps {
  /** The quiz result being shown; used for anonymous matching and as the fallback when the user has no saved profile yet. */
  dimensions: IdeologyVector;
  weights: DimensionWeights;
}

const WEIGHT_DEBOUNCE_MS = 300;
const TOP_PARTIES = 3;
const BOTTOM_PARTIES = 2;
const TOP_TDS = 5;

const labels = (dims: IdeologyDimension[]) => dims.map((d) => DIMENSION_POLES[d].label).join(", ");

const abbreviate = (party: string) =>
  party
    .split(/[\s–-]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

/**
 * Party and TD matches for the results page. Signed in: the user's saved profile
 * (GET /api/ideology/me/matches). Anonymous, or signed in with no profile yet: the
 * quiz vector on this page (POST /api/ideology/matches).
 */
const PartyMatchResults: React.FC<PartyMatchResultsProps> = ({ dimensions, weights }) => {
  const { user, isAuthenticated } = useAuth();

  // Sliders fire on every step; wait for the user to settle before refetching.
  const [activeWeights, setActiveWeights] = useState(weights);
  useEffect(() => {
    const timer = window.setTimeout(() => setActiveWeights(weights), WEIGHT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [weights]);

  const { data, isLoading, isError, error } = useQuery<Matches>({
    queryKey: isAuthenticated
      ? queryKeys.ideology.myMatches(user?.id, activeWeights)
      : queryKeys.ideology.vectorMatches(dimensions, activeWeights),
    queryFn: async () => {
      if (isAuthenticated) {
        const mine = await fetchMyMatches(activeWeights);
        if (mine.hasProfile) return mine;
      }
      return fetchMatchesForVector(dimensions, activeWeights);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load party matches"}
        </p>
      </div>
    );
  }

  const topParties = data.parties.slice(0, TOP_PARTIES);
  const bottomParties =
    data.parties.length > TOP_PARTIES + BOTTOM_PARTIES ? data.parties.slice(-BOTTOM_PARTIES).reverse() : [];
  const topTds = data.tds.slice(0, TOP_TDS);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3 border-b pb-2">
          Closest Political Matches
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          For more accurate matches, adjust the dimension weightings in the 'Customize Weights' tab to prioritize issues that matter most to you.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md mb-3 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Important note:</strong> These parties are the best match on paper based on ideological alignment.
            Before making voting decisions, also consider each party's performance record and trustworthiness.
            Check the <a href="/?tab=tds" className="underline hover:text-blue-600 dark:hover:text-blue-200">Rankings tab</a> to
            view detailed performance metrics and party comparisons.
          </p>
        </div>
        <div className="space-y-4">
          {topParties.length > 0 ? (
            topParties.map((match) => (
              <PartyCard
                key={`top-${match.party}`}
                name={match.party}
                matchPercentage={match.alignment}
                reason={
                  match.closest.length > 0
                    ? `Closest to you on ${labels(match.closest)}.`
                    : "Broadly aligned with your profile."
                }
              />
            ))
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No party matches found.
            </p>
          )}
        </div>
      </div>

      {topTds.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">
            Closest TDs
          </h3>
          <div className="space-y-2">
            {topTds.map((td) => (
              <Link
                key={td.tdId}
                href={`/td/${encodeURIComponent(td.name)}`}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {td.imageUrl ? (
                    <img src={td.imageUrl} alt={td.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: getPartyColor(td.party) }}
                    >
                      {abbreviate(td.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{td.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {td.party} · {td.constituency}
                    </div>
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">{Math.round(td.alignment)}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {bottomParties.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">
            Least Compatible Political Matches
          </h3>
          <div className="space-y-4">
            {bottomParties.map((match) => (
              <PartyCard
                key={`bottom-${match.party}`}
                name={match.party}
                matchPercentage={match.alignment}
                reason={
                  match.furthest.length > 0
                    ? `Your views differ most from ${match.party} on ${labels(match.furthest)}.`
                    : `Your views differ significantly from ${match.party}.`
                }
                isLowMatch={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface PartyCardProps {
  name: string;
  matchPercentage: number;
  reason: string;
  isLowMatch?: boolean;
}

const PartyCard: React.FC<PartyCardProps> = ({
  name,
  matchPercentage,
  reason,
  isLowMatch = false
}) => {
  const percentage = Math.round(matchPercentage);
  return (
    <div className={`rounded-lg border p-4 ${isLowMatch ? 'border-gray-200 dark:border-gray-700' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: getPartyColor(name) }}
          >
            {abbreviate(name)}
          </div>
          <h4 className="font-medium text-lg">{name}</h4>
        </div>
        <div className={`text-lg font-bold ${isLowMatch ? 'text-gray-500' : 'text-primary'}`}>
          {percentage}%
        </div>
      </div>
      <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className={`h-2.5 rounded-full ${isLowMatch ? 'bg-gray-500' : 'bg-primary'}`}
          style={{ width: `${Math.max(5, percentage)}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">{reason}</p>

      <div className="flex gap-2 mt-3">
        <Link
          href={`/party/${encodeURIComponent(name)}`}
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-800"
        >
          View Party
        </Link>
      </div>
    </div>
  );
};

export default PartyMatchResults;
