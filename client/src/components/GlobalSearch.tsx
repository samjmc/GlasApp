/**
 * Global search: TDs, parties and constituencies, grouped in a keyboard-navigable dropdown.
 * Rendered by the app shell (top bar on tablet/desktop, top sheet on phone).
 */

import { useState, useEffect, useRef, useMemo, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, MapPin, Search, X } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { queryKeys } from "@/lib/queryKeys";
import { formatScore, scoreTone, TONE_TEXT } from "@/lib/score";
import { PartyDot, TDAvatar } from "@/components/pulse/Party";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ResultType = "td" | "party" | "constituency";

interface TdSearchResult {
  id?: number | string;
  name: string;
  party?: string | null;
  constituency?: string | null;
  imageUrl?: string | null;
  overallScore?: number | null;
}

interface PartySearchResult {
  name: string;
  size?: number;
}

interface ConstituencySearchResult {
  name: string;
  tdCount?: number;
}

interface FlatResult {
  type: ResultType;
  name: string;
  href: string;
  entity: TdSearchResult | PartySearchResult | ConstituencySearchResult;
}

const GROUPS: { type: ResultType; label: string; base: string }[] = [
  { type: "td", label: "TDs", base: "/td/" },
  { type: "party", label: "Parties", base: "/party/" },
  { type: "constituency", label: "Constituencies", base: "/constituency/" },
];

/** Fetch one scores endpoint and return its unwrapped `data`, or `[]` if it fails. */
async function fetchScoresList<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? (json.data as T[]) : [];
  } catch {
    return [];
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the key press came from somewhere the user is typing. */
function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Global search input with dropdown results for TDs, parties, and constituencies. */
export function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [, setLocation] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { regionCode } = useRegion();
  const listId = useId();
  const isIreland = regionCode === "IE";

  const { data: searchData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.globalSearch.data(regionCode ?? ""), // disabled unless IE, so "" is never fetched
    queryFn: async () => {
      // Each list degrades to [] on its own, so one failing fetch does not
      // take the whole search down.
      const [tds, parties, constituencyNames] = await Promise.all([
        fetchScoresList<TdSearchResult>("/api/scores/tds"),
        fetchScoresList<{ party: string; memberCount: number }>("/api/scores/parties"),
        fetchScoresList<{ name: string }>("/api/scores/constituencies"),
      ]);

      if (tds.length === 0 && parties.length === 0 && constituencyNames.length === 0) {
        throw new Error("Failed to load global search data");
      }

      const tdCountByConstituency = new Map<string, number>();
      for (const td of tds) {
        if (td.constituency) {
          tdCountByConstituency.set(td.constituency, (tdCountByConstituency.get(td.constituency) ?? 0) + 1);
        }
      }

      return {
        tds,
        parties: parties.map((p): PartySearchResult => ({ name: p.party, size: p.memberCount })),
        constituencies: constituencyNames.map((c): ConstituencySearchResult => ({
          name: c.name,
          tdCount: tdCountByConstituency.get(c.name),
        })),
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: isIreland,
  });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const results: FlatResult[] = useMemo(() => {
    if (!searchData || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();

    const scoreText = (text?: string | null) => {
      if (!text) return 0;
      const lower = text.toLowerCase();
      if (lower === q) return 4;
      if (lower.startsWith(q)) return 3;
      if (lower.includes(q)) return 2;
      const tokens = q.split(" ").filter(Boolean);
      return tokens.length > 1 && tokens.every((token) => lower.includes(token)) ? 1 : 0;
    };

    const rank = <T extends { name: string }>(items: T[], scoreFn: (item: T) => number, max: number) =>
      items
        .map((item) => ({ item, score: scoreFn(item) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, max)
        .map(({ item }) => item);

    const byType: Record<ResultType, { name: string }[]> = {
      td: rank(searchData.tds, (td) => scoreText(td.name) * 4 + scoreText(td.party) * 2 + scoreText(td.constituency), 8),
      party: rank(searchData.parties, (p) => scoreText(p.name) * 3, 5),
      constituency: rank(searchData.constituencies, (c) => scoreText(c.name) * 3, 5),
    };

    return GROUPS.flatMap(({ type, base }) =>
      byType[type].map((entity) => ({
        type,
        name: entity.name,
        href: `${base}${encodeURIComponent(entity.name)}`,
        entity: entity as FlatResult["entity"],
      }))
    );
  }, [debouncedQuery, searchData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // "/" or Ctrl/Cmd+K focuses search from anywhere.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const slash = event.key === "/" && !isTypingTarget(event.target);
      const cmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!slash && !cmdK) return;
      // Two instances can be mounted (top bar + phone sheet); only the visible one takes focus.
      if (!inputRef.current || inputRef.current.offsetParent === null) return;
      event.preventDefault();
      inputRef.current.focus();
      if (debouncedQuery.length >= 2) setIsOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debouncedQuery.length]);

  useEffect(() => setActiveIndex(0), [debouncedQuery, results.length]);

  const close = () => {
    setIsOpen(false);
    setSearchQuery("");
    setActiveIndex(0);
  };

  const go = (path: string) => {
    setLocation(path);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => (prev + step + results.length) % results.length);
    }
    if (e.key === "Enter" && isOpen) {
      e.preventDefault();
      const active = results[activeIndex];
      if (active) go(active.href);
    }
  };

  const highlight = (text?: string | null) => {
    if (!text || !debouncedQuery) return text ?? "";
    const parts = text.split(new RegExp(`(${escapeRegExp(debouncedQuery)})`, "ig"));
    return parts.map((part, idx) =>
      part.toLowerCase() === debouncedQuery.toLowerCase() ? (
        <mark key={idx} className="bg-transparent font-bold text-primary">
          {part}
        </mark>
      ) : (
        <span key={idx}>{part}</span>
      )
    );
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const showPanel = isOpen && (!isIreland || searchQuery.trim().length > 0);

  const renderRow = (r: FlatResult) => {
    if (r.type === "td") {
      const td = r.entity as TdSearchResult;
      const tone = scoreTone(td.overallScore);
      return (
        <>
          <TDAvatar name={td.name} party={td.party} imageUrl={td.imageUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{highlight(td.name)}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-muted-foreground">
              <PartyDot party={td.party} />
              <span className="truncate">
                {td.party ?? "Independent"}
                {td.constituency ? ` · ${td.constituency}` : ""}
              </span>
            </span>
          </span>
          <span className={cn("font-display text-lg font-bold", tone ? TONE_TEXT[tone] : "text-muted-foreground")}>
            {formatScore(td.overallScore)}
          </span>
        </>
      );
    }
    const isParty = r.type === "party";
    const Icon = isParty ? Building2 : MapPin;
    const count = isParty ? (r.entity as PartySearchResult).size : (r.entity as ConstituencySearchResult).tdCount;
    return (
      <>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-muted-foreground">
          {isParty ? <PartyDot party={r.name} className="h-3 w-3" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{highlight(r.name)}</span>
        <span className="text-[13px] text-muted-foreground">{count ?? "—"} TDs</span>
      </>
    );
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <label className="flex h-12 w-full items-center gap-3 rounded-lg border border-input bg-card px-4 text-muted-foreground transition-colors focus-within:border-primary">
        <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className="sr-only">Search</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results.length ? optionId(activeIndex) : undefined}
          placeholder={isIreland ? "Search a TD, party or constituency" : "Search is coming for this region"}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={!isIreland}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              close();
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-input px-2 py-0.5 text-xs font-semibold md:inline-block" aria-hidden="true">
            /
          </kbd>
        )}
      </label>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border bg-card p-2 shadow-xl"
        >
          {!isIreland ? (
            <p className="p-4 text-sm text-muted-foreground">
              Search covers Irish TDs, parties and constituencies. Switch region to Ireland to use it.
            </p>
          ) : isLoading ? (
            <div className="flex flex-col gap-2 p-2" aria-label="Loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-start gap-2 p-4 text-sm">
              <p className="font-semibold">Search data did not load.</p>
              <button type="button" onClick={() => refetch()} className="font-semibold text-primary hover:underline">
                Try again
              </button>
            </div>
          ) : debouncedQuery.length < 2 ? (
            <p className="p-4 text-sm text-muted-foreground">Type 2 or more letters.</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No match for “{debouncedQuery}”. Try a surname, a party or a county.
            </p>
          ) : (
            GROUPS.map(({ type, label }) => {
              const group = results.map((r, i) => ({ r, i })).filter(({ r }) => r.type === type);
              if (!group.length) return null;
              return (
                <div key={type} role="group" aria-label={label} className="py-1">
                  <div className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{label}</div>
                  {group.map(({ r, i }) => (
                    <div
                      key={r.href}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(r.href)}
                      className={cn(
                        "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        i === activeIndex ? "bg-elevated" : "hover:bg-accent"
                      )}
                    >
                      {renderRow(r)}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
