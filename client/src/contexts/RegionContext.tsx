import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  REGION_CONFIGS,
  REGION_LIST,
  isRegionCode,
  type RegionCode,
  type RegionConfig,
} from "@shared/region-config";

type RegionStatus = "loading" | "ready" | "needs-selection";

interface RegionContextValue {
  regionCode: RegionCode | null;
  region: RegionConfig | null;
  status: RegionStatus;
  availableRegions: RegionConfig[];
  selectRegion: (code: RegionCode) => Promise<void>;
}

const RegionContext = createContext<RegionContextValue | null>(null);

/** Set only when the visitor has picked a region themselves; until then we ask. */
const LOCAL_STORAGE_KEY = "glas.region";

function getStoredRegion(): RegionCode | null {
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return isRegionCode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function setStoredRegion(code: RegionCode) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, code);
  } catch {
    // Not remembered on this device; the server cookie still holds it.
  }
}

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
  const regionRef = useRef<RegionCode | null>(regionCode);

  useEffect(() => {
    regionRef.current = regionCode;
    applyRegionClass(regionCode);
  }, [regionCode]);

  // Every same-origin request carries the region, so the server answers for the right one.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const current = regionRef.current;
      if (!current) return originalFetch(input, init);
      const url = new URL(input instanceof Request ? input.url : input.toString(), window.location.origin);
      if (url.origin !== window.location.origin) return originalFetch(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("x-region-code")) headers.set("x-region-code", current);
      return input instanceof Request
        ? originalFetch(new Request(input, { ...init, headers }))
        : originalFetch(input, { ...init, headers });
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const selectRegion = useCallback(
    async (code: RegionCode) => {
      setRegionCode(code);
      setStoredRegion(code);
      setStatus("ready");
      try {
        const res = await fetch("/api/region/select", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode: code }),
        });
        if (!res.ok) throw new Error(`Failed to save region ${code}`);
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
