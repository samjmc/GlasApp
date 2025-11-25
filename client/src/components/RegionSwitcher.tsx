import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRegion } from "@/hooks/useRegion";
import { REGION_CONFIGS } from "@shared/region-config";

const REGION_FLAG_IMAGE: Record<string, string> = {
  IE: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbvCCyqwPh-0E3z_RaxUxN244bPPf04ZGHUQ&s",
  US: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTqQDwmmpdUSgD0Vk0okXKwS6f1C9Tx696UA&s",
};

function getRegionFlagUrl(code?: string | null) {
  if (!code) return null;
  return REGION_FLAG_IMAGE[code] ?? null;
}

export function RegionSwitcher() {
  const { regionCode, availableRegions, selectRegion, status } =
    useRegion();
  const isLoading = status === "loading";

  const selectedFlagUrl = getRegionFlagUrl(regionCode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center justify-center gap-2"
          disabled={isLoading}
          aria-label="Choose region"
        >
          {selectedFlagUrl ? (
            <img
              src={selectedFlagUrl}
              alt={regionCode ? REGION_CONFIGS[regionCode as keyof typeof REGION_CONFIGS]?.name ?? "Region" : "Region"}
              className="h-5 w-5 rounded-full object-cover shadow-sm"
            />
          ) : (
            <span className="text-lg" aria-hidden>
              🌍
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-[4rem] p-1">
        {availableRegions.map((candidate) => {
          const selected = regionCode === candidate.code;
          const url = getRegionFlagUrl(candidate.code);
          return (
            <DropdownMenuItem
              key={candidate.code}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                selected
                  ? "ring-2 ring-emerald-400 ring-offset-2 dark:ring-emerald-500"
                  : ""
              }`}
              onSelect={() => selectRegion(candidate.code)}
              aria-label={candidate.name}
            >
              {url ? (
                <img
                  src={url}
                  alt={candidate.name}
                  className="h-6 w-6 rounded-full object-cover shadow-sm"
                />
              ) : (
                <span className="text-lg" aria-hidden>
                  {REGION_CONFIGS[candidate.code as keyof typeof REGION_CONFIGS]?.assets.flagEmoji ?? "🌍"}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
