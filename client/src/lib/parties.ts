/**
 * The one place the UI gets a party's colours and short name.
 *
 * Keys are party names exactly as `politics.tds.party` stores them. `dot` is for marks on the
 * dark or light ground (dots, bars); `fill` is dark enough to carry white initials.
 */
export interface PartyStyle {
  name: string;
  short: string;
  dot: string;
  fill: string;
}

const PARTIES: PartyStyle[] = [
  { name: "Sinn Féin", short: "SF", dot: "#3FA38F", fill: "#2F6B5E" },
  { name: "Fianna Fáil", short: "FF", dot: "#6CC46C", fill: "#3B7A3B" },
  { name: "Fine Gael", short: "FG", dot: "#5B9BEF", fill: "#1F5FAD" },
  { name: "Labour Party", short: "Lab", dot: "#E0574F", fill: "#B3261E" },
  { name: "Social Democrats", short: "SD", dot: "#A66BC4", fill: "#6B2C82" },
  { name: "Green Party", short: "GP", dot: "#9BCB3C", fill: "#4C7A12" },
  { name: "People Before Profit-Solidarity", short: "PBP", dot: "#F07AA8", fill: "#9B2A5A" },
  { name: "Aontú", short: "Aon", dot: "#C9B458", fill: "#6E5E1E" },
  { name: "Independent Ireland", short: "II", dot: "#4FB3D9", fill: "#1F6F8B" },
  { name: "100% RDR", short: "RDR", dot: "#C7C7C7", fill: "#555C58" },
  { name: "Independent", short: "Ind", dot: "#9AA5A0", fill: "#4E5853" },
];

/** The spelling shared/data.ts uses for the one party whose name differs from the Oireachtas data. */
const ALIASES: Record<string, string> = {
  "people before profit": "People Before Profit-Solidarity",
};

const BY_NAME = new Map(PARTIES.map((p) => [p.name.toLowerCase(), p]));

const UNKNOWN: Omit<PartyStyle, "name" | "short"> = { dot: "#9AA5A0", fill: "#4E5853" };

export function partyStyle(name: string | null | undefined): PartyStyle {
  const key = (name ?? "").trim().toLowerCase();
  const found = BY_NAME.get(key) ?? BY_NAME.get((ALIASES[key] ?? "").toLowerCase());
  if (found) return found;
  const label = name?.trim() || "Unknown";
  return { name: label, short: label.slice(0, 3), ...UNKNOWN };
}

export const PARTY_NAMES = PARTIES.map((p) => p.name);

/** Two-letter initials for an avatar: "Mary Lou McDonald" -> "MM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
