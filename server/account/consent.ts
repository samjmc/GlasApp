/**
 * Consent to process political opinions (GDPR Art. 9(2)(a)). The one place that records,
 * checks and withdraws it; the wording and its version live in shared/consent.ts.
 *
 * Granting stores when and which wording. Withdrawing erases the political data in the same
 * transaction: without the consent there is no basis left to keep it.
 *
 * Known limit: a save checks consent and then writes in a later statement, and withdrawal takes no
 * lock against it. A save that passed the check a moment before a withdrawal can land after the
 * erase (a double-tap, or a second tab). It would stay until the next withdrawal or account
 * deletion. Closing it needs the check and the write in one transaction, in each write path.
 */
import type { NextFunction, Request, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { hasPoliticalConsent as hasConsent, POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { users } from '@shared/schema/accounts';
import { db, type Db } from '../db';
import { ConsentRequiredError, sendConsentRequired } from './consentError';
import { erasePoliticalData, type PoliticalDataCounts, type Tx } from './deleteUserData';
import { ensureProfile } from './profile';

export { CONSENT_REQUIRED, ConsentRequiredError } from './consentError';

/** True when this user has agreed to the current wording. */
export async function hasPoliticalConsent(userId: string, database: Db = db): Promise<boolean> {
  const [row] = await database
    .select({ politicalConsentAt: users.politicalConsentAt, politicalConsentVersion: users.politicalConsentVersion })
    .from(users)
    .where(eq(users.id, userId));
  return hasConsent(row);
}

/** Record consent to the current wording. Someone already on the current wording keeps their original date. */
export async function grantPoliticalConsent(userId: string, database: Db = db): Promise<void> {
  await ensureProfile(userId, database);
  await database
    .update(users)
    .set({ politicalConsentAt: sql`now()`, politicalConsentVersion: POLITICAL_CONSENT_VERSION, updatedAt: sql`now()` })
    .where(and(eq(users.id, userId), sql`(${users.politicalConsentAt} is null or ${users.politicalConsentVersion} is distinct from ${POLITICAL_CONSENT_VERSION})`));
}

/** Withdraw consent and erase the political data, all or nothing. Returns what was erased. */
export async function withdrawPoliticalConsent(userId: string, database: Db = db): Promise<PoliticalDataCounts> {
  return database.transaction(async (tx) => {
    // erasePoliticalData locks the users row first, so a write already inside withPoliticalConsent commits before the erase.
    const erased = await erasePoliticalData(tx, userId);
    await tx
      .update(users)
      .set({ politicalConsentAt: null, politicalConsentVersion: null, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
    return erased;
  });
}

/**
 * Run a political write in a transaction that first checks consent on the user's row FOR SHARE.
 * The route guard checks earlier, in a separate statement; this closes the gap after it. Withdrawal
 * locks the same row FOR UPDATE before it erases, so the two serialise: either this write commits
 * first and the erase removes it, or the withdrawal commits first and this throws ConsentRequiredError.
 */
export async function withPoliticalConsent<T>(userId: string, write: (tx: Tx) => Promise<T>, database: Db = db): Promise<T> {
  return database.transaction(async (tx) => {
    const [row] = await tx
      .select({ politicalConsentAt: users.politicalConsentAt, politicalConsentVersion: users.politicalConsentVersion })
      .from(users)
      .where(eq(users.id, userId))
      .for('share');
    if (!hasConsent(row)) throw new ConsentRequiredError();
    return write(tx);
  });
}

/** Route guard, after requireAuth: stops a request that would save political opinions without consent. */
export async function requirePoliticalConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await hasPoliticalConsent(req.user!.id)) return next();
    sendConsentRequired(res);
  } catch (error) {
    next(error);
  }
}
