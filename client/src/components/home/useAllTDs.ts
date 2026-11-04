import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { apiEnvelope } from "@/lib/api";
import type { TdListItem } from "@shared/scoresApi";

/** Every TD with a score, from GET /api/scores/tds. The home cards, rankings and search share it. */
export function useAllTDs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.td.rankings(),
    queryFn: async () => {
      const { data, meta } = await apiEnvelope<TdListItem[], { count: number }>("GET", "/api/scores/tds");
      return { tds: data, count: meta?.count ?? data.length };
    },
    enabled,
  });
}
