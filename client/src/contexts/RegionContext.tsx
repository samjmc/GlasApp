import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_REGION_CODE,
  REGION_CONFIGS,
  REGION_LIST,
  REGION_NEWS_MOCK,
  REGION_DAILY_SESSION_MOCK,
  type RegionCode,
  type RegionConfig,
} from "@shared/region-config";
import { isRegionCode } from "@shared/region-config";

type RegionStatus = "loading" | "ready" | "needs-selection";

interface RegionContextValue {
  regionCode: RegionCode | null;
  region: RegionConfig | null;
  status: RegionStatus;
  availableRegions: typeof REGION_LIST;
  selectRegion: (code: RegionCode) => Promise<void>;
  refreshRegion: () => Promise<void>;
  isMockRegion: boolean;
}

const defaultRegion = REGION_CONFIGS[DEFAULT_REGION_CODE];

const RegionContext = createContext<RegionContextValue>({
  regionCode: DEFAULT_REGION_CODE,
  region: defaultRegion,
  status: "loading",
  availableRegions: REGION_LIST,
  selectRegion: async () => {},
  refreshRegion: async () => {},
  isMockRegion: false,
});

const LOCAL_STORAGE_KEY = "glas.region";

function getStoredRegion(): RegionCode | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  return isRegionCode(stored) ? stored : null;
}

function setStoredRegion(code: RegionCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, code);
}

function computeMockRegion(code: RegionCode | null): boolean {
  if (!code) return false;
  return Boolean(REGION_NEWS_MOCK[code] || REGION_DAILY_SESSION_MOCK[code]);
}

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [regionCode, setRegionCode] = useState<RegionCode | null>(null);
  const [status, setStatus] = useState<RegionStatus>("loading");
  const [availableRegions, setAvailableRegions] = useState(REGION_LIST);
  const [isMockRegion, setIsMockRegion] = useState(false);
  const queryClient = useQueryClient();

  const regionRef = useRef<RegionCode | null>(null);
  const fetchPatchedRef = useRef(false);

  useEffect(() => {
    regionRef.current = regionCode;
    setIsMockRegion(computeMockRegion(regionCode));
  }, [regionCode]);

  const patchFetch = useCallback(() => {
    if (typeof window === "undefined" || fetchPatchedRef.current) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    fetchPatchedRef.current = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const currentRegion = regionRef.current || getStoredRegion();

      if (!currentRegion) {
        return originalFetch(input as any, init);
      }

      try {
        let url: URL | null = null;
        if (typeof input === "string" || input instanceof URL) {
          url = new URL(input.toString(), window.location.origin);
        } else if (input instanceof Request) {
          url = new URL(input.url, window.location.origin);
        }

        if (!url || url.origin !== window.location.origin) {
          return originalFetch(input as any, init);
        }

        const baseHeaders =
          (init && init.headers)
            ? new Headers(init.headers as HeadersInit)
            : input instanceof Request
            ? new Headers(input.headers)
            : new Headers();

        if (!baseHeaders.has("x-region-code")) {
          baseHeaders.set("x-region-code", currentRegion);
        }

        if (input instanceof Request) {
          const request = new Request(input, {
            ...init,
            headers: baseHeaders,
          });
          return originalFetch(request);
        }

        const finalInit: RequestInit = {
          ...init,
          headers: baseHeaders,
        };

        return originalFetch(input as any, finalInit);
      } catch (error) {
        console.error("Region fetch patch failed", error);
        return originalFetch(input as any, init);
      }
    };

    return () => {
      window.fetch = originalFetch;
      fetchPatchedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const undoPatch = patchFetch();
    return undoPatch;
  }, [patchFetch]);

  const loadAvailableRegions = useCallback(async () => {
    try {
      const res = await fetch("/api/region/available", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load regions");
      const data = await res.json();
      if (Array.isArray(data.regions) && data.regions.length > 0) {
        setAvailableRegions(data.regions);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Falling back to static region list", error);
      }
      setAvailableRegions(REGION_LIST);
    }
  }, []);

  const loadRegion = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/region/current", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to resolve region");
      const data = await res.json();
      if (isRegionCode(data.regionCode)) {
        setRegionCode(data.regionCode);
        setStoredRegion(data.regionCode);
        setIsMockRegion(Boolean(data.hasMockNews || data.hasMockDailySession));
        setStatus("ready");
        return;
      }
      throw new Error("Invalid region payload");
    } catch (error) {
      const storedRegion = getStoredRegion();
      if (storedRegion) {
        setRegionCode(storedRegion);
        setStatus("ready");
        return;
      }
      setRegionCode(null);
      setStatus("needs-selection");
    }
  }, []);

  useEffect(() => {
    loadAvailableRegions();
    loadRegion();
  }, [loadAvailableRegions, loadRegion]);

  const selectRegion = useCallback(async (code: RegionCode) => {
    setRegionCode(code);
    setStoredRegion(code);
    setStatus("loading");

    try {
      const res = await fetch("/api/region/select", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regionCode: code }),
      });

      if (!res.ok) {
        throw new Error(`Failed to persist region ${code}`);
      }

      const data = await res.json();
      if (isRegionCode(data.regionCode)) {
        setRegionCode(data.regionCode);
        setIsMockRegion(Boolean(data.hasMockNews || data.hasMockDailySession || computeMockRegion(data.regionCode)));
      } else {
        setIsMockRegion(computeMockRegion(code));
      }
    } catch (error) {
      console.error("Region selection failed", error);
      setIsMockRegion(computeMockRegion(code));
    } finally {
      queryClient.invalidateQueries();
      setStatus("ready");
    }
  }, [queryClient]);

  const region = useMemo(() => (regionCode ? REGION_CONFIGS[regionCode] : null), [regionCode]);

  const contextValue = useMemo<RegionContextValue>(() => ({
    regionCode,
    region,
    status,
    availableRegions,
    selectRegion,
    refreshRegion: loadRegion,
    isMockRegion,
  }), [regionCode, region, status, availableRegions, selectRegion, loadRegion, isMockRegion]);

  return <RegionContext.Provider value={contextValue}>{children}</RegionContext.Provider>;
}

export function useRegionContext(): RegionContextValue {
  return useContext(RegionContext);
}


