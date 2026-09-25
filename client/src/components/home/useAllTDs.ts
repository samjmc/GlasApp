import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export interface ScoredTD {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  overallScore: number | null;
  nationalRank: number | null;
}

/**
 * Every TD with a score, from GET /api/scores/tds. Same key and result shape as the
 * rankings page, so the two share one cache entry.
 */
export function useAllTDs() {
  return useQuery({
    queryKey: queryKeys.td.rankings(),
    queryFn: async () => {
      const res = await fetch("/api/scores/tds");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const tds = (json.data ?? []) as ScoredTD[];
      return { tds, count: (json.meta?.count as number | undefined) ?? tds.length };
    },
  });
}
