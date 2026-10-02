/**
 * Phone verification codes. Pure: no database, no SMS.
 *
 * The old flow wrote the code to users.verification_code and checked it against
 * phone_verification_tokens, a table nothing ever wrote to, so no code could ever verify.
 * Now one place holds it: a salted hash, an expiry and an attempt count on the user's row.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const PHONE_E164 = /^\+[1-9]\d{1,14}$/;
export const PHONE_CODE_DIGITS = 6;
export const PHONE_CODE_MINUTES = 10;
/** Wrong guesses allowed per code: 5 of 1,000,000 is a 0.0005% guess rate. */
export const PHONE_CODE_MAX_ATTEMPTS = 5;
/** Each code is a paid text message, so a user waits this long before the next one. */
export const PHONE_RESEND_SECONDS = 60;

/** Digits from the CSPRNG: Math.random is predictable, and this code is the proof of ownership. */
export function generateCode(digits = PHONE_CODE_DIGITS): string {
  return Array.from({ length: digits }, () => randomInt(0, 10)).join('');
}

/** Salted with the user id so the same code for two users never hashes alike. */
export function hashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

export interface IssuedCode {
  code: string;
  hash: string;
  expiresAt: Date;
}

export function issueCode(userId: string, now = new Date()): IssuedCode {
  const code = generateCode();
  return { code, hash: hashCode(userId, code), expiresAt: new Date(now.getTime() + PHONE_CODE_MINUTES * 60_000) };
}

export interface StoredCode {
  phoneCodeHash: string | null;
  phoneCodeExpiresAt: Date | null;
  phoneCodeAttempts: number;
}

/** True while the current code is younger than PHONE_RESEND_SECONDS. */
export function issuedRecently(stored: StoredCode, now = new Date()): boolean {
  if (!stored.phoneCodeExpiresAt) return false;
  const issuedAt = stored.phoneCodeExpiresAt.getTime() - PHONE_CODE_MINUTES * 60_000;
  return now.getTime() - issuedAt < PHONE_RESEND_SECONDS * 1000;
}

export type CheckResult ='verified' | 'wrong' | 'expired' | 'no_code' | 'too_many_attempts';

export function checkCode(userId: string, stored: StoredCode, code: string, now = new Date()): CheckResult {
  if (!stored.phoneCodeHash || !stored.phoneCodeExpiresAt) return 'no_code';
  if (stored.phoneCodeAttempts >= PHONE_CODE_MAX_ATTEMPTS) return 'too_many_attempts';
  if (stored.phoneCodeExpiresAt.getTime() <= now.getTime()) return 'expired';
  const given = Buffer.from(hashCode(userId, code), 'hex');
  const want = Buffer.from(stored.phoneCodeHash, 'hex');
  return given.length === want.length && timingSafeEqual(given, want) ? 'verified' : 'wrong';
}
