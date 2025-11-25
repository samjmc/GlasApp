/**
 * Global Search Component
 * Searches across TDs, parties, and constituencies
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  MapPin,
  Building2,
  Loader2,
  Sparkles,
  Compass,
  X,
} from "lucide-react";
import { useRegion } from "@/hooks/useRegion";

type ResultType = "td" | "party" | "constituency";

interface FlattenedResult {
  type: ResultType;
  entity: any;
}

export function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { regionCode } = useRegion();
  const [activeIndex, setActiveIndex] = useState(0);

  const upperQuery = debouncedQuery.toLowerCase();

  const {
    data: searchData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["global-search-data", regionCode],
    queryFn: async () => {
      const [tdsRes, partiesRes, constituenciesRes] = await Promise.all([
        fetch("/api/parliamentary/scores/widget"),
        fetch("/api/parliamentary/parties/analytics"),
        fetch("/api/parliamentary/constituencies"),
      ]);

      if (!tdsRes.ok || !partiesRes.ok || !constituenciesRes.ok) {
        throw new Error("Failed to load global search data");
      }

      const [tdsData, partiesData, constituenciesData] = await Promise.all([
        tdsRes.json(),
        partiesRes.json(),
        constituenciesRes.json(),
      ]);

      return {
        tds: [
          ...(tdsData.top_performers || []),
          ...(tdsData.biggest_movers || []),
          ...(tdsData.bottom_performers || []),
        ],
        parties: partiesData.parties || [],
        constituencies: constituenciesData.constituencies || [],
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: regionCode === "IE",
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredResults = useMemo(() => {
    if (!searchData || debouncedQuery.length < 2) {
      return { tds: [], parties: [], constituencies: [] };
    }

    const scoreText = (text?: string | null) => {
      if (!text) return 0;
      const lower = text.toLowerCase();
      if (lower === upperQuery) return 4;
      if (lower.startsWith(upperQuery)) return 3;
      if (lower.includes(upperQuery)) return 2;
      const tokens = upperQuery.split(" ").filter(Boolean);
      if (tokens.length > 1 && tokens.every((token) => lower.includes(token))) {
        return 1;
      }
      return 0;
    };

    const sortByScore = <T,>(items: T[], scoreFn: (item: T) => number) =>
      items
        .map((item) => ({ item, score: scoreFn(item) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);

    const tds = sortByScore(searchData.tds, (td: any) => {
      return (
        scoreText(td.name) * 4 +
        scoreText(td.party) * 2 +
        scoreText(td.constituency)
      );
    }).slice(0, 8);

    const parties = sortByScore(
      searchData.parties,
      (party: any) => scoreText(party.name) * 3
    ).slice(0, 5);

    const constituencies = sortByScore(
      searchData.constituencies,
      (constituency: any) =>
        scoreText(constituency.name) * 3 + scoreText(constituency.county)
    ).slice(0, 5);

    return { tds, parties, constituencies };
  }, [debouncedQuery, searchData, upperQuery]);

  const flattenedResults: FlattenedResult[] = useMemo(() => {
    const list: FlattenedResult[] = [];
    filteredResults.tds.forEach((td) => list.push({ type: "td", entity: td }));
    filteredResults.parties.forEach((party) =>
      list.push({ type: "party", entity: party })
    );
    filteredResults.constituencies.forEach((constituency) =>
      list.push({ type: "constituency", entity: constituency })
    );
    return list;
  }, [filteredResults]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        if (debouncedQuery.length >= 2) {
          setIsOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debouncedQuery.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, flattenedResults.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      setActiveIndex(0);
      return;
    }

    if (!flattenedResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev + 1) % flattenedResults.length);
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) =>
        prev <= 0 ? flattenedResults.length - 1 : prev - 1
      );
    }

    if (e.key === "Enter" && isOpen) {
      const active = flattenedResults[activeIndex];
      if (!active) return;
      selectResult(active);
    }
  };

  const selectResult = (result: FlattenedResult) => {
    switch (result.type) {
      case "td":
        handleSelectResult(`/td/${encodeURIComponent(result.entity.name)}`);
        break;
      case "party":
        handleSelectResult(`/party/${encodeURIComponent(result.entity.name)}`);
        break;
      case "constituency":
        handleSelectResult(
          `/constituency/${encodeURIComponent(result.entity.name)}`
        );
        break;
    }
  };

  const handleSelectResult = (path: string) => {
    setLocation(path);
    setIsOpen(false);
    setSearchQuery("");
    setActiveIndex(0);
  };

  const highlightText = (text?: string | null) => {
    if (!text || !debouncedQuery) return text ?? "";
    const regex = new RegExp(`(${debouncedQuery})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, idx) =>
      part.toLowerCase() === debouncedQuery.toLowerCase() ? (
        <span
          key={`${part}-${idx}`}
          className="text-blue-600 dark:text-blue-300 font-semibold"
        >
          {part}
        </span>
      ) : (
        <span key={`${part}-${idx}`}>{part}</span>
      )
    );
  };

  const hasResults =
    filteredResults.tds.length > 0 ||
    filteredResults.parties.length > 0 ||
    filteredResults.constituencies.length > 0;

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={
            regionCode === "US"
              ? "Search coming soon for US preview…"
              : "Search TDs, parties, constituencies…"
          }
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
          disabled={regionCode === "US"}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {regionCode === "US" && isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 border-2 shadow-xl bg-white/95 dark:bg-gray-900/95">
          <div className="p-6 text-center space-y-3 text-gray-600 dark:text-gray-300">
            <Sparkles className="mx-auto h-8 w-8 text-amber-500" />
            <p className="text-sm font-semibold">
              US search preview on the way
            </p>
            <p className="text-xs">
              We’re mapping congressional representatives and districts. Switch
              to the Ireland region to browse the live search experience.
            </p>
          </div>
        </Card>
      )}

      {isOpen && regionCode === "IE" && (
        <Card className="absolute top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto z-50 shadow-xl border-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Grabbing the latest datasets…</p>
            </div>
          ) : isError ? (
            <div className="p-6 text-center text-red-500">
              <p className="text-sm font-semibold">
                We couldn’t load search data.
              </p>
              <p className="text-xs mt-1">
                Please refresh or try again in a little while.
              </p>
            </div>
          ) : debouncedQuery.length < 2 ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Compass className="h-3.5 w-3.5" />
                <span>Quick shortcuts</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => handleSelectResult("/td-scores")}
                  className="rounded-lg border border-gray-200 bg-white/70 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20"
                >
                  View TD leaderboard
                </button>
                <button
                  onClick={() => handleSelectResult("/party/Fine%20Gael")}
                  className="rounded-lg border border-gray-200 bg-white/70 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-purple-500/40 dark:hover:bg-purple-900/20"
                >
                  Find Fine Gael details
                </button>
              </div>
              <p className="px-3 pb-2 text-xs text-gray-400 dark:text-gray-500">
                Tip: Press
                <kbd className="mx-1 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} + K
                </kbd>
                to toggle global search anywhere.
              </p>
            </div>
          ) : hasResults ? (
            <div className="p-2">
              {filteredResults.tds.length > 0 && (
                <div className="mb-3">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    TDs ({filteredResults.tds.length})
                  </div>
                  {filteredResults.tds.map((td: any, index) => (
                    <button
                      key={td.id ?? `${td.name}-${index}`}
                      onClick={() =>
                        handleSelectResult(`/td/${encodeURIComponent(td.name)}`)
                      }
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors group ${
                        flattenedResults[activeIndex]?.entity === td
                          ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 truncate">
                            {highlightText(td.name)}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {highlightText(td.party)} • {highlightText(td.constituency)}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {td.overall_elo ?? td.score ?? "—"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {filteredResults.parties.length > 0 && (
                <div className="mb-3">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Parties ({filteredResults.parties.length})
                  </div>
                  {filteredResults.parties.map((party: any, index) => (
                    <button
                      key={party.name ?? index}
                      onClick={() =>
                        handleSelectResult(
                          `/party/${encodeURIComponent(party.name)}`
                        )
                      }
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors group ${
                        flattenedResults[activeIndex]?.entity === party
                          ? "bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <div className="text-left">
                          <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600">
                            {highlightText(party.name)}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {party.size ?? "—"} TDs
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredResults.constituencies.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Constituencies ({filteredResults.constituencies.length})
                  </div>
                  {filteredResults.constituencies.map(
                    (constituency: any, index) => (
                      <button
                        key={constituency.name ?? index}
                        onClick={() =>
                          handleSelectResult(
                            `/constituency/${encodeURIComponent(
                              constituency.name
                            )}`
                          )
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors group ${
                          flattenedResults[activeIndex]?.entity === constituency
                            ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600">
                              {highlightText(constituency.name)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {(constituency.tdCount ?? constituency.seats ?? "—")} TDs
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No matches for “{debouncedQuery}”</p>
              <p className="text-xs mt-1">
                Try a name, party, or constituency. Results refresh every few minutes.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

