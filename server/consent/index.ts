/**
 * Consent to store political opinions (GDPR Art. 9(2)(a)); see shared/consent.ts.
 *
 *   consentStatus / grantConsent / withdrawConsent   the user's own consent (routes.ts)
 *   requirePoliticalConsent                          the gate on every route that stores opinions
 *   hasPoliticalConsent                              for a route that also serves anonymous visitors
 *
 * Withdrawing deletes the user's political data (votes, daily sessions, quiz results, pledge
 * priorities, ideology profile) and keeps the account.
 */
import { eq } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import { CONSENT_REQUIRED, POLITICAL_CONSENT_VERSION, type ConsentStatus } from '@shared/consent';
import { politicalDataConsents } from '@shared/schema/accounts';
import { deletePoliticalData, type PoliticalDataCounts } from '../account/deleteUserData';
import { db, type Db } from '../db';
import { formatError } from '../utils/responseFormatters';

export class ConsentVersionError extends Error {}

export async function consentStatus(userId: string, database: Db = db): Promise<ConsentStatus> {
  const [row] = await database.select().from(politicalDataConsents).where(eq(politicalDataConsents.userId, userId));
  const current = row?.policyVersion === POLITICAL_CONSENT_VERSION;
  return { granted: current, version: POLITICAL_CONSENT_VERSION, grantedAt: current ? row!.grantedAt.toISOString() : null };
}

export async function hasPoliticalConsent(userId: string, database: Db = db): Promise<boolean> {
  return (await consentStatus(userId, database)).granted;
}

/** `version` must be the current one: agreeing to an older text is not consent to this one. */
export async function grantConsent(userId: string, version: string, database: Db = db): Promise<ConsentStatus> {
  if (version !== POLITICAL_CONSENT_VERSION) throw new ConsentVersionError('The consent text has changed; reload and read it again');
  await database
    .insert(politicalDataConsents)
    .values({ userId, policyVersion: version })
    .onConflictDoUpdate({ target: politicalDataConsents.userId, set: { policyVersion: version, grantedAt: new Date() } });
  return consentStatus(userId, database);
}

/** Deletes the consent and the political data it covered, in one transaction. */
export async function withdrawConsent(userId: string, database: Db = db): Promise<PoliticalDataCounts> {
  return database.transaction(async (tx) => {
    const deleted = await deletePoliticalData(tx, userId);
    await tx.delete(politicalDataConsents).where(eq(politicalDataConsents.userId, userId));
    return deleted;
  });
}

/** After requireAuth: refuses with 403 CONSENT_REQUIRED unless the user has consented. */
export const requirePoliticalConsent: RequestHandler = async (req, res, next) => {
  try {
    if (await hasPoliticalConsent(req.user!.id)) return next();
    res.status(403).json(formatError(CONSENT_REQUIRED, 'Agree to store your political answers first'));
  } catch (error) {
    next(error);
  }
};
