import { describe, expect, it } from 'vitest';
import { POLITICAL_CONSENT_VERSION, hasPoliticalConsent } from './consent';

describe('hasPoliticalConsent', () => {
  const given = { politicalConsentAt: '2026-10-10T12:00:00.000Z', politicalConsentVersion: POLITICAL_CONSENT_VERSION };

  it('is true only for a date plus the current wording', () => {
    expect(hasPoliticalConsent(given)).toBe(true);
    expect(hasPoliticalConsent({ ...given, politicalConsentAt: new Date() })).toBe(true);
  });

  it('is false when there is no row, no date, no version, or an older version', () => {
    expect(hasPoliticalConsent(null)).toBe(false);
    expect(hasPoliticalConsent(undefined)).toBe(false);
    expect(hasPoliticalConsent({})).toBe(false);
    expect(hasPoliticalConsent({ ...given, politicalConsentAt: null })).toBe(false);
    expect(hasPoliticalConsent({ ...given, politicalConsentVersion: null })).toBe(false);
    expect(hasPoliticalConsent({ ...given, politicalConsentVersion: POLITICAL_CONSENT_VERSION - 1 })).toBe(false);
  });
});
