/**
 * The Replit-era root schema. Its tables (parties, elections, user_activity, the Shadow
 * Cabinet's) never existed in GlasCore and are gone; every table now lives in
 * shared/schema/*.ts. Only this type is left, for the static party list in shared/data.ts.
 */

/** A political party with ideological positions on the political compass. */
export interface PoliticalParty {
  id: string;
  name: string;
  country: string;
  economic: number;
  social: number;
  description: string;
  color: string;
}
