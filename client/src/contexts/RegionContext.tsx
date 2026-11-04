import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { REGION_CONFIGS, REGION_LIST, type RegionCode, type RegionConfig } from "@shared/region-config";
import { getStoredRegion, setStoredRegion } from "@/lib/regionStorage";
import { apiCall } from "@/lib/api";

type RegionStatus = "loading" | "ready" | "needs-selection";

interface RegionContextValue {
  regionCode: RegionCode | null;
  region: RegionConfig | null;
  status: RegionStatus;
  availableRegions: RegionConfig[];
  selectRegion: (code: RegionCode) => Promise<void>;
}

const RegionContext = createContext<RegionContextValue | null>(null);

/** `region-ie` / `region-uk` / `region-us` on <html> switches the accent colours (index.css). */
function applyRegionClass(code: RegionCode | null) {
  const root = document.documentElement;
  for (const c of Object.keys(REGION_CONFIGS)) root.classList.remove(`region-${c.toLowerCase()}`);
  if (code) root.classList.add(`region-${code.toLowerCase()}`);
}

/** React context provider for region state. */
export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [regionCode, setRegionCode] = useState<RegionCode | null>(getStoredRegion);
  const [status, setStatus] = useState<RegionStatus>(() => (getStoredRegion() ? "ready" : "needs-selection"));
  const queryClient = useQueryClient();
  useEffect(() => {
    applyRegionClass(regionCode);
  }, [regionCode]);

  // Every API call carries the stored region (lib/api.ts), so the server answers for the right one.
  const selectRegion = useCallback(
    async (code: RegionCode) => {
      setRegionCode(code);
      setStoredRegion(code);
      setStatus("ready");
      try {
        await apiCall("POST", "/api/region/select", { regionCode: code });
      } catch (error) {
        // Still switched on this device; the next visit re-sends the header.
        console.error("Region selection failed", error);
      } finally {
        queryClient.invalidateQueries();
      }
    },
    [queryClient]
  );

  const value = useMemo<RegionContextValue>(
    () => ({
      regionCode,
      region: regionCode ? REGION_CONFIGS[regionCode] : null,
      status,
      availableRegions: REGION_LIST,
      selectRegion,
    }),
    [regionCode, status, selectRegion]
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

/** React hook exposing the region context value. */
export function useRegionContext(): RegionContextValue {
  const value = useContext(RegionContext);
  if (!value) throw new Error("useRegion must be used inside RegionProvider");
  return value;
}
