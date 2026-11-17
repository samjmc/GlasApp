/**
 * Single source of truth for the addresses and host the app publishes. The previous .ie domain
 * has no DNS, so mail sent there went nowhere. These are the live addresses (shared with
 * GlasIntelligence). Import from here; do not write an address or the host as a literal.
 */
export const SITE_HOST = 'politics.glasinsight.com';
export const SITE_URL = `https://${SITE_HOST}`;

/** General contact, partnership, data correction, feature requests, legal. */
export const CONTACT_EMAIL = 'hello@glasinsight.com';
/** Bugs, abuse reports, technical support. */
export const SUPPORT_EMAIL = 'support@glasinsight.com';
/** Privacy, GDPR and data requests. */
export const PRIVACY_EMAIL = 'privacy@glasinsight.com';