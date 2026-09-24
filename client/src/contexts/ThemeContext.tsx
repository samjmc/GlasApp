import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "dark" | "light" | "system";

const STORAGE_KEY = "glas-theme";
const DEFAULT_THEME: ThemeChoice = "dark";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    // Storage can be blocked (private mode); the default is fine.
  }
  return DEFAULT_THEME;
}

function isDark(theme: ThemeChoice): boolean {
  if (theme !== "system") return theme === "dark";
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

/** Applies the theme as a `dark` or `light` class on <html>; index.html does the same before first paint. */
function apply(theme: ThemeChoice) {
  const dark = isDark(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0D1310" : "#F4F7F5");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStored);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; still applies for this visit.
    }
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
