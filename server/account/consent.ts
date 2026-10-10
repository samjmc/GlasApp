/**
 * Consent to process political opinions (GDPR Art. 9(2)(a)). The one place that records,
 * checks and withdraws it; the wording and its version live in shared/consent.ts.
 *
 * Granting stores when and which wording. Withdrawing erases the political data in the same
 * transaction: without the consent there is no basis left to keep it.
 */
import type { NextFunction, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { hasPoliticalConsent as hasConsent, POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { users } from '@shared/schema/accounts';
import { db, type Db } from '../db';
import { formatError } from '../utils/responseFormatters';
import { erasePoliticalData, type PoliticalDataCounts } from './deleteUserData';
import { ensureProfile } from './profile';

/** True when this user has agreed to the current wording. */
export async function hasPoliticalConsent(userId: string, database: Db = db): Promise<boolean> {
  const [row] = await database
    .select({ politicalConsentAt: users.politicalConsentAt, politicalConsentVersion: users.politicalConsentVersion })
    .from(users)
    .where(eq(users.id, userId));
  return hasConsent(row);
}

/** Record consent to the current wording. Re-granting overwrites the date and version. */
export async function grantPoliticalConsent(userId: string, database: Db = db): Promise<void> {
  await ensureProfile(userId, database);
  await database
    .update(users)
    .set({ politicalConsentAt: sql`now()`, politicalConsentVersion: POLITICAL_CONSENT_VERSION, updatedAt: sql`now()` })
    .where(eq(users.id, userId));
}

/** Withdraw consent and erase the political data, all or nothing. Returns what was erased. */
export async function withdrawPoliticalConsent(userId: string, database: Db = db): Promise<PoliticalDataCounts> {
  await ensureProfile(userId, database);
  return database.transaction(async (tx) => {
    const erased = await erasePoliticalData(tx, userId);
    await tx
      .update(users)
      .set({ politicalConsentAt: null, politicalConsentVersion: null, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
    return erased;
  });
}

/** Sent with a 403 so the client can tell "ask for consent" from any other refusal. */
export const CONSENT_REQUIRED = 'CONSENT_REQUIRED';

/** Route guard, after requireAuth: stops a request that would save political opinions without consent. */
export async function requirePoliticalConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await hasPoliticalConsent(req.user!.id)) return next();
    res.status(403).json(formatError(CONSENT_REQUIRED, 'Agree to the use of your political opinions before saving them.'));
  } catch (error) {
    next(error);
  }
}
