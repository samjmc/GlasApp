/**
 * Phone verification codes. Pure: no database, no SMS.
 *
 * The old flow wrote the code to users.verification_code and checked it against
 * phone_verification_tokens, a table nothing ever wrote to, so no code could ever verify.
 * Now one place holds it: a salted hash, an expiry and an attempt count on the user's row.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { generateVerificationCode } from '../services/verificationService';

export const PHONE_E164 = /^\+[1-9]\d{1,14}$/;
export const PHONE_CODE_DIGITS = 6;
export const PHONE_CODE_MINUTES = 10;
/** Wrong guesses allowed per code: 5 of 1,000,000 is a 0.0005% guess rate. */
export const PHONE_CODE_MAX_ATTEMPTS = 5;

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
  const code = generateVerificationCode(PHONE_CODE_DIGITS);
  return { code, hash: hashCode(userId, code), expiresAt: new Date(now.getTime() + PHONE_CODE_MINUTES * 60_000) };
}

export interface StoredCode {
  phoneCodeHash: string | null;
  phoneCodeExpiresAt: Date | null;
  phoneCodeAttempts: number;
}

export type CheckResult = 'verified' | 'wrong' | 'expired' | 'no_code' | 'too_many_attempts';

export function checkCode(userId: string, stored: StoredCode, code: string, now = new Date()): CheckResult {
  if (!stored.phoneCodeHash || !stored.phoneCodeExpiresAt) return 'no_code';
  if (stored.phoneCodeAttempts >= PHONE_CODE_MAX_ATTEMPTS) return 'too_many_attempts';
  if (stored.phoneCodeExpiresAt.getTime() <= now.getTime()) return 'expired';
  const given = Buffer.from(hashCode(userId, code), 'hex');
  const want = Buffer.from(stored.phoneCodeHash, 'hex');
  return given.length === want.length && timingSafeEqual(given, want) ? 'verified' : 'wrong';
}
