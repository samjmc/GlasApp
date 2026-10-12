/**
 * Test support: every political write checks consent on the user's politics.users row at the moment
 * it writes (server/account/consent.ts withPoliticalConsent), so a test that writes for a user has to
 * record that user's consent first.
 */
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

/** Give each user consent to the current wording, creating their row if needed. */
export async function consentTo(pool: Queryable, ...userIds: string[]): Promise<void> {
  for (const id of userIds) {
    await pool.query(
      `insert into politics.users (id, political_consent_at, political_consent_version) values ($1, now(), $2)
       on conflict (id) do update set political_consent_at = now(), political_consent_version = $2`,
      [id, POLITICAL_CONSENT_VERSION],
    );
  }
}
