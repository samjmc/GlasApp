/**
 * Facts shared by playwright.config.ts, prepare-db.ts and the spec. Imports nothing, so the
 * spec never loads server code.
 */

/**
 * The TDs prepare-db.ts seeds. Party spellings match client/src/lib/parties.ts, so the names
 * the UI shows equal the stored ones. Six, because PartyMatchResults shows "Least like you"
 * only when there are more than five parties.
 */
export const E2E_TDS = [
  { name: 'E2E National Deputy', party: 'National Party', constituency: 'E2E North' },
  { name: 'E2E Freedom Deputy', party: 'Irish Freedom Party', constituency: 'E2E South' },
  { name: 'E2E Aontú Deputy', party: 'Aontú', constituency: 'E2E East' },
  { name: 'E2E FG Deputy', party: 'Fine Gael', constituency: 'E2E West' },
  { name: 'E2E SD Deputy', party: 'Social Democrats', constituency: 'E2E Midlands' },
  { name: 'E2E PBP Deputy', party: 'People Before Profit-Solidarity', constituency: 'E2E Central' },
] as const;

/**
 * Inherited variables the e2e server must not see (LLMs, Redis, Twilio). Set to '' rather than
 * left out: the webServer inherits the parent environment, and dotenv never overrides a
 * variable that is already set, so '' also keeps a local dotenv file from filling them in.
 * SUPABASE_SERVICE_ROLE_KEY is not here: '' crashes server/auth/supabase.ts (it falls back
 * with `??`), so playwright.config.ts sets it to a dummy instead.
 */
export const BLANKED_ENV = [
  'LLM_API_KEY',
  'LLM_BASE_URL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'TAVILY_API_KEY',
  'REDIS_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
] as const;
