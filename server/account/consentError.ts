/**
 * The refusal for a political write without consent, kept apart from consent.ts (which needs the
 * database) so a router can map it to a 403 while its tests mock consent.ts.
 */
import type { Response } from 'express';
import { formatError } from '../utils/responseFormatters';

/** Sent with a 403 so the client can tell "ask for consent" from any other refusal. */
export const CONSENT_REQUIRED = 'CONSENT_REQUIRED';

/** Thrown by a political write when, at the moment of writing, the user has no consent. Nothing was stored. */
export class ConsentRequiredError extends Error {
  constructor() {
    super('No consent to store political opinions');
  }
}

/** The 403 for a request that would save political opinions without consent. */
export function sendConsentRequired(res: Response): void {
  res.status(403).json(formatError(CONSENT_REQUIRED, 'Agree to the use of your political opinions before saving them.'));
}
