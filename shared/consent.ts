/**
 * Consent to store political opinions (GDPR Art. 9(2)(a)). The text the user agrees to is in
 * client/src/components/consent/PoliticalConsentDialog.tsx. Bump the version whenever that text
 * changes: a consent counts only for the version it was given to, so everyone is asked again.
 */
export const POLITICAL_CONSENT_VERSION = '2026-10-10';

/** The error code of a political write refused for lack of consent (HTTP 403). */
export const CONSENT_REQUIRED = 'CONSENT_REQUIRED';

export interface ConsentStatus {
  granted: boolean;
  /** The current consent version, which a grant must name. */
  version: string;
  /** When the current consent was given; null when it was not. */
  grantedAt: string | null;
}
