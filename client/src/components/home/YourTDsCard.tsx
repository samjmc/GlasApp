import { useMemo, useState } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { ScoreRing } from "@/components/pulse/ScoreRing";
import { PartyLabel, TDAvatar } from "@/components/pulse/Party";
import { EmptyState } from "@/components/pulse/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllTDs } from "./useAllTDs";
import { HomeCard } from "./HomeCard";

const STORAGE_KEY = "glas.home.constituency";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
}

/**
 * One constituency's TDs as score rings. The user can change the constituency;
 * the choice is remembered on this device. The auth profile carries no constituency,
 * so the default is the first constituency alphabetically.
 */
export function YourTDsCard({ className }: { className?: string }) {
  const { data, isLoading, isError, refetch } = useAllTDs();
  const [chosen, setChosen] = useState<string | null>(readStored);
  const total = data?.count ?? 0;

  const constituencies = useMemo(
    () =>
      Array.from(new Set((data?.tds ?? []).map((t) => t.constituency).filter((c): c is string => !!c))).sort((a, b) =>
        a.localeCompare(b, "en-IE")
      ),
    [data]
  );

  const current = chosen && constituencies.includes(chosen) ? chosen : constituencies[0] ?? null;
  const tds = useMemo(
    () =>
      (data?.tds ?? [])
        .filter((t) => t.constituency === current)
        .sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1)),
    [data, current]
  );

  const change = (value: string) => {
    setChosen(value);
    writeStored(value);
  };

  return (
    <HomeCard className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-muted-foreground">Your TDs</span>
          {current ? (
            <h2 className="truncate font-display text-2xl font-bold tracking-tight md:text-[28px]">
              <Link href={`/constituency/${encodeURIComponent(current)}`} className="hover:text-primary">
                {current}
              </Link>
            </h2>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </div>
        {constituencies.length > 0 && (
          <Select value={current ?? undefined} onValueChange={change}>
            <SelectTrigger aria-label="Change constituency" className="h-10 w-auto shrink-0 gap-2 rounded-lg">
              <span className="text-sm font-semibold">Change</span>
              <span className="sr-only">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {constituencies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-5 md:px-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-36 shrink-0 rounded-xl md:w-auto" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={MapPin}
          title="TDs did not load"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : tds.length === 0 ? (
        <EmptyState icon={MapPin} title="No TDs for this constituency">
          Pick another constituency with Change.
        </EmptyState>
      ) : (
        <ul className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-5 md:px-0">
          {tds.map((td) => (
            <li key={td.id} className="w-36 shrink-0 snap-start md:w-auto">
              <Link
                href={`/td/${encodeURIComponent(td.name)}`}
                className="flex h-full flex-col items-center gap-2.5 rounded-xl bg-elevated px-3 py-4 text-center transition-colors hover:bg-accent active:scale-[0.98]"
              >
                <div className="relative">
                  <ScoreRing value={td.overallScore} size={80} label={`${td.name} overall score`} />
                  <TDAvatar
                    name={td.name}
                    party={td.party}
                    imageUrl={td.imageUrl}
                    size="sm"
                    className="absolute -bottom-1 -right-1 ring-2 ring-card"
                  />
                </div>
                <span className="text-[15px] font-bold leading-tight">{td.name}</span>
                <PartyLabel party={td.party ?? "Independent"} short className="max-w-full justify-center text-[13px]" />
                {td.nationalRank && total > 0 && (
                  <span className="text-xs text-muted-foreground">
                    #{td.nationalRank} of {total}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
}
