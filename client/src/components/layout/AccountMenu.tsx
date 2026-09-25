import { Link, useLocation } from "wouter";
import { Globe, LogIn, LogOut, Moon, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeChoice } from "@/contexts/ThemeContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useRegion } from "@/hooks/useRegion";
import type { RegionCode } from "@shared/region-config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Match my device" },
];

function displayName(user: NonNullable<ReturnType<typeof useAuth>["user"]>): string {
  return user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Your account";
}

/** The account button: sign in when signed out; profile, theme, region and admin links when signed in. */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useIsAdmin();
  const { regionCode, availableRegions, selectRegion } = useRegion();
  const [, navigate] = useLocation();

  const signOut = async () => {
    try {
      await logout?.();
      navigate("/");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const trigger =
    isAuthenticated && user ? (
      <Button variant="ghost" size="icon" className="rounded-full p-0" aria-label="Account menu">
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.profileImageUrl || ""} alt="" />
          <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
            {(user.firstName || user.email || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Button>
    ) : (
      <Button variant="ghost" size="icon" aria-label="Settings" disabled={isLoading}>
        <Settings className="!size-5" />
      </Button>
    );

  return (
    <div className="flex items-center gap-2">
      {!isAuthenticated && !isLoading && !compact && (
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {isAuthenticated && user ? (
            <>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate">{displayName(user)}</span>
                {user.email && <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/my-politics">
                  <UserRound className="mr-2 h-4 w-4" /> My politics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <Settings className="mr-2 h-4 w-4" /> Profile and settings
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" /> Sign in or create an account
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Moon className="h-3.5 w-3.5" /> Appearance
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeChoice)}>
            {THEMES.map((t) => (
              <DropdownMenuRadioItem key={t.value} value={t.value}>
                {t.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          {availableRegions.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Globe className="h-3.5 w-3.5" /> Region
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={regionCode ?? ""} onValueChange={(code) => selectRegion(code as RegionCode)}>
                {availableRegions.map((region) => (
                  <DropdownMenuRadioItem key={region.code} value={region.code}>
                    {region.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/admin">Pledge tracker</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/shadow">Agent monitor</Link>
              </DropdownMenuItem>
            </>
          )}

          {isAuthenticated && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
