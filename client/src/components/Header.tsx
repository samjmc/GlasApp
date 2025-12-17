import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ManualPWAInstall } from "./ManualPWAInstall";
import { Search, X } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { GlobalSearch } from "./GlobalSearch";
import glasLogo from '@assets/Gemini_Generated_Image_v9oiqwv9oiqwv9oi.png';
import { RegionSwitcher } from "./RegionSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useDailySession } from "@/hooks/useDailySession";

const Header = () => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
  
  // Set dark mode as default
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.add("dark");
    }
  }, []);
  
  return (
    <header className="sticky top-0 z-50 bg-white shadow dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/">
              <img
                src={glasLogo}
                alt="Glas Politics"
                className="h-10 w-auto sm:h-14 lg:h-16"
              />
            </Link>
          </div>

          {/* Middle: Search (sm+) + Desktop nav (md+) */}
          <div className="hidden sm:flex items-center min-w-0 flex-1 gap-3 lg:gap-4">
            <div className="min-w-0 flex-1 max-w-xl">
              <GlobalSearch />
            </div>
            <nav className="hidden md:flex items-center gap-1 lg:gap-2 xl:gap-4 shrink-0">
            <Link href="/debates" className="text-xs lg:text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-2 lg:px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
              Debates
            </Link>
            <Link href="/enhanced-quiz" className="text-xs lg:text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-2 lg:px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
              Quiz
            </Link>
            <Link href="/ideas" className="text-xs lg:text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-2 lg:px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
              Ideas
            </Link>
            <Link href="/my-politics" className="text-xs lg:text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-2 lg:px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
              Profile
            </Link>
            {isAuthenticated && (
              <Link href="/admin/shadow" className="text-xs lg:text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 lg:px-3 py-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap">
                Admin
              </Link>
            )}
            </nav>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3 shrink-0">
            {/* Mobile Search Toggle Button */}
            <Button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 sm:hidden"
              aria-label="Toggle search"
            >
              {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            <div className="hidden lg:block flex-shrink-0">
              <ManualPWAInstall />
            </div>

            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-2 lg:gap-3 rounded-full border border-orange-200/70 bg-gradient-to-r from-orange-100 via-amber-100 to-rose-100 px-2 lg:px-4 py-1 lg:py-1.5 text-xs lg:text-sm font-semibold text-orange-700 shadow-sm dark:border-orange-400/30 dark:from-orange-900/40 dark:via-amber-800/40 dark:to-rose-900/40 dark:text-orange-200 flex-shrink-0 whitespace-nowrap">
                <span className="relative flex items-center justify-center">
                  <span className="absolute inset-0 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-orange-400/30 blur-sm" />
                  <span className="text-base lg:text-lg animate-[flicker_1.6s_ease-in-out_infinite]">
                    🔥
                  </span>
                </span>
                <span className="text-base lg:text-lg font-black tracking-tight">
                  {streakLoading ? "…" : streakCount ?? 0}
                </span>
              </div>
            )}
            
            <div className="flex-shrink-0">
              <RegionSwitcher />
            </div>

            <div className="flex-shrink-0">
              <AuthButton />
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {mobileSearchOpen && (
          <div className="sm:hidden pb-3">
            <GlobalSearch />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;