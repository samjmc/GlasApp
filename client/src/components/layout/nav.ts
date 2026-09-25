import { BarChart3, Compass, Home, Landmark, Lightbulb, MapPin, UserRound, type LucideIcon } from "lucide-react";
import type { RegionConfig } from "@shared/region-config";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the phone bottom bar. */
  shortLabel?: string;
  icon: LucideIcon;
  /** Other path prefixes that count as "inside" this section. */
  also?: string[];
}

/** The one list of app sections. The sidebar shows all; the phone bar shows `BOTTOM_NAV`. */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/rankings", label: "Rankings", icon: BarChart3, also: ["/td/", "/party/"] },
  { href: "/debates", label: "Dáil record", shortLabel: "Dáil", icon: Landmark },
  { href: "/constituencies", label: "Constituencies", icon: MapPin, also: ["/constituency/"] },
  { href: "/quiz", label: "Ideology quiz", shortLabel: "Quiz", icon: Compass },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/my-politics", label: "My politics", shortLabel: "Me", icon: UserRound },
];

const byHref = (href: string) => MAIN_NAV.find((item) => item.href === href)!;

/** Phone bar: two either side of the centre action button. */
export const BOTTOM_NAV: { left: NavItem[]; right: NavItem[] } = {
  left: [byHref("/"), byHref("/rankings")],
  right: [byHref("/debates"), byHref("/my-politics")],
};

/** Labels that depend on the region's parliament: "Dáil record" / "Commons record", "Districts". */
export function labelFor(item: NavItem, region: RegionConfig | null, short = false): string {
  const l = region?.legislature;
  if (l && item.href === "/debates") return short ? l.chamberShort : `${l.chamberShort} record`;
  if (l && item.href === "/constituencies") return l.seatNamePlural.charAt(0).toUpperCase() + l.seatNamePlural.slice(1);
  return short ? item.shortLabel ?? item.label : item.label;
}

export function isActive(item: NavItem, location: string): boolean {
  const path = location.split("?")[0];
  if (item.href === "/") return path === "/";
  const prefixes = [item.href, ...(item.also ?? [])];
  return prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
}

export const FOOTER_LINKS = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-of-service", label: "Terms" },
  { href: "/contact", label: "Contact" },
];
