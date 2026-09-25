/**
 * The regions Glas covers. Ireland is live; the UK and US editions are previews that show
 * what is coming and never display invented data.
 */
export type RegionCode = "IE" | "UK" | "US";

export const REGION_CODES: readonly RegionCode[] = ["IE", "UK", "US"];

/** Default region code used by the app. */
export const DEFAULT_REGION_CODE: RegionCode = "IE";

export type RegionStatus = "live" | "preview";

export interface RegionConfig {
  code: RegionCode;
  name: string;
  shortName: string;
  defaultLocale: string;
  status: RegionStatus;
  /** The chamber Glas scores, and what its members and seats are called. */
  legislature: {
    chamber: string;
    /** Short name for navigation: "Dáil", "Commons", "Congress". */
    chamberShort: string;
    members: number;
    memberTitle: string;
    memberTitlePlural: string;
    seatName: string;
    seatNamePlural: string;
    seats: number;
  };
  /** One line for the region picker. */
  tagline: string;
}

/** Configuration for each supported region. Seat and member counts are the chambers' sizes. */
export const REGION_CONFIGS: Record<RegionCode, RegionConfig> = {
  IE: {
    code: "IE",
    name: "Ireland",
    shortName: "Ireland",
    defaultLocale: "en-IE",
    status: "live",
    legislature: {
      chamber: "Dáil Éireann",
      chamberShort: "Dáil",
      members: 174,
      memberTitle: "TD",
      memberTitlePlural: "TDs",
      seatName: "constituency",
      seatNamePlural: "constituencies",
      seats: 43,
    },
    tagline: "Every TD scored on votes, questions and debate.",
  },
  UK: {
    code: "UK",
    name: "United Kingdom",
    shortName: "UK",
    defaultLocale: "en-GB",
    status: "preview",
    legislature: {
      chamber: "House of Commons",
      chamberShort: "Commons",
      members: 650,
      memberTitle: "MP",
      memberTitlePlural: "MPs",
      seatName: "constituency",
      seatNamePlural: "constituencies",
      seats: 650,
    },
    tagline: "MPs and Commons divisions. In preview.",
  },
  US: {
    code: "US",
    name: "United States",
    shortName: "US",
    defaultLocale: "en-US",
    status: "preview",
    legislature: {
      chamber: "Congress",
      chamberShort: "Congress",
      members: 535,
      memberTitle: "member of Congress",
      memberTitlePlural: "members of Congress",
      seatName: "district",
      seatNamePlural: "districts",
      seats: 435,
    },
    tagline: "Congress and roll-call votes. In preview.",
  },
};

/** Flat list of configured regions, in picker order. */
export const REGION_LIST = REGION_CODES.map((code) => REGION_CONFIGS[code]);

/** Type guard for the RegionCode type. */
export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === "string" && (REGION_CODES as readonly string[]).includes(value);
}
