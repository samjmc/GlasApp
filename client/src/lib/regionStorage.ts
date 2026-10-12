import { isRegionCode, type RegionCode } from "@shared/region-config";

/** Set only when the visitor has picked a region themselves; until then we ask. */
const LOCAL_STORAGE_KEY = "glas.region";

/** Holds the choice for this page load when the browser refuses storage. */
let chosenThisLoad: RegionCode | null = null;

/** The region the visitor picked, or null when they have not picked one. */
export function getStoredRegion(): RegionCode | null {
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return isRegionCode(stored) ? stored : chosenThisLoad;
  } catch {
    return chosenThisLoad;
  }
}

export function setStoredRegion(code: RegionCode) {
  chosenThisLoad = code;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, code);
  } catch {
    // Not remembered on this device; the server cookie still holds it.
  }
}
