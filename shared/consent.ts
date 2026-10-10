/**
 * Consent to process political opinions (GDPR Art. 9(2)(a), explicit consent).
 *
 * Quiz answers, votes on daily questions and policy-area rankings reveal political opinions,
 * which are special category data. The server saves none of them for a user without a
 * consent recorded against the CURRENT version below.
 *
 * Bump POLITICAL_CONSENT_VERSION whenever the statement or the list of purposes changes in
 * substance: every user is then asked again, and the stored version shows which wording
 * each person agreed to. A typo fix does not need a bump.
 */
export const POLITICAL_CONSENT_VERSION = 1;

/** The sentence the person agrees to. */
export const POLITICAL_CONSENT_STATEMENT =
  'I agree that Glas Politics may store and use my quiz answers, my votes on daily questions and my policy-area rankings. These show my political opinions.';

/** Plain statements shown beside it: what is used, for what, and how to leave. */
export const POLITICAL_CONSENT_POINTS = [
  'We use them to show your results, to match you with TDs and parties, and to keep your history.',
  'We may also study answers in aggregate, without naming anyone, to improve the quiz. Nothing is published per person.',
  'You can withdraw at any time in your profile settings. Withdrawing deletes this data.',
  'Without consent you can still take the quiz and see your result. We just do not save it.',
] as const;

/** The consent as stored on a profile row (dates arrive as ISO strings over the API). */
export interface PoliticalConsentFields {
  politicalConsentAt: Date | string | null;
  politicalConsentVersion: number | null;
}

/** True only for a consent given to the current wording. */
export function hasPoliticalConsent(fields: Partial<PoliticalConsentFields> | null | undefined): boolean {
  return Boolean(fields && fields.politicalConsentAt && fields.politicalConsentVersion === POLITICAL_CONSENT_VERSION);
}
