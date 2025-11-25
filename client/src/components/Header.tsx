import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ManualPWAInstall } from "./ManualPWAInstall";
import { Sun, Moon } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { GlobalSearch } from "./GlobalSearch";
import glasLogo from '@assets/glas_logo_3d_ripple.png';
import { RegionSwitcher } from "./RegionSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useDailySession } from "@/hooks/useDailySession";

const Header = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { isAuthenticated } = useAuth();
  const { data: dailySession, isLoading: streakLoading } = useDailySession(isAuthenticated);

  const streakCount = useMemo(() => {
    if (!dailySession) return null;
    if (typeof dailySession.streakCount === "number") {
      return dailySession.streakCount;
    }
    if (dailySession.completion?.streakCount) {
      return dailySession.completion.streakCount;
    }
    return null;
  }, [dailySession]);
  
  // Initialize theme based on user preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("theme") === "dark") {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      } else if (localStorage.getItem("theme") === "light") {
        setTheme("light");
        document.documentElement.classList.remove("dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    }
  }, []);
  
  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      setTheme("dark");
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };
  
  return (
    <header className="sticky top-0 z-50 bg-white shadow dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 py-3 sm:gap-4 sm:py-4">
          {/* Logo */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link href="/">
              <img
                src={glasLogo}
                alt="Glas Politics"
                className="h-10 w-auto sm:h-12"
              />
            </Link>
            <Link href="/">
              <span className="hidden text-lg font-semibold text-[#77eab1] dark:text-white lg:block">
                Glas Politics
              </span>
            </Link>
          </div>

          {/* Search Bar - Center */}
          <div className="order-3 w-full sm:order-none sm:flex-1 sm:max-w-xl">
            <GlobalSearch />
          </div>

          {/* Desktop Navigation - Visible only on md+ screens */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-4 mx-4">
            <Link href="/debates" className="text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Debates
            </Link>
            <Link href="/enhanced-quiz" className="text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Quiz
            </Link>
            <Link href="/ideas" className="text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Ideas
            </Link>
            <Link href="/my-politics" className="text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Profile
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden md:block">
              <ManualPWAInstall />
            </div>

            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-3 rounded-full border border-orange-200/70 bg-gradient-to-r from-orange-100 via-amber-100 to-rose-100 px-4 py-1.5 text-sm font-semibold text-orange-700 shadow-sm dark:border-orange-400/30 dark:from-orange-900/40 dark:via-amber-800/40 dark:to-rose-900/40 dark:text-orange-200">
                <span className="relative flex items-center justify-center">
                  <span className="absolute inset-0 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-orange-400/30 blur-sm" />
                  <span className="text-lg animate-[flicker_1.6s_ease-in-out_infinite]">
                    🔥
                  </span>
                </span>
                <span className="text-lg font-black tracking-tight">
                  {streakLoading ? "…" : streakCount ?? 0}
                </span>
              </div>
            )}
            
            <RegionSwitcher />

            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <AuthButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;