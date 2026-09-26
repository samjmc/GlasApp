import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PHONE_CODE_DIGITS,
  PHONE_CODE_MAX_ATTEMPTS,
  PHONE_CODE_MINUTES,
  PHONE_E164,
  PHONE_RESEND_SECONDS,
  checkCode,
  generateCode,
  hashCode,
  issueCode,
  issuedRecently,
} from './phone';

const NOW = new Date('2026-09-25T12:00:00Z');

describe('issueCode', () => {
  it('makes a 6-digit code, stores only its salted hash, and expires in 10 minutes', () => {
    const issued = issueCode('user-a', NOW);
    expect(issued.code).toMatch(new RegExp(`^\\d{${PHONE_CODE_DIGITS}}$`));
    expect(issued.hash).toBe(hashCode('user-a', issued.code));
    expect(issued.hash).not.toContain(issued.code);
    expect(issued.expiresAt.getTime() - NOW.getTime()).toBe(PHONE_CODE_MINUTES * 60_000);
  });

  it('salts by user: the same code hashes differently for two users', () => {
    expect(hashCode('user-a', '123456')).not.toBe(hashCode('user-b', '123456'));
  });
});

describe('checkCode', () => {
  const stored = (over: Partial<{ hash: string | null; expires: Date | null; attempts: number }> = {}) => ({
    phoneCodeHash: over.hash === undefined ? hashCode('user-a', '123456') : over.hash,
    phoneCodeExpiresAt: over.expires === undefined ? new Date(NOW.getTime() + 60_000) : over.expires,
    phoneCodeAttempts: over.attempts ?? 0,
  });

  it('verifies the right code', () => {
    expect(checkCode('user-a', stored(), '123456', NOW)).toBe('verified');
  });
  it('rejects a wrong code, and the right code for another user', () => {
    expect(checkCode('user-a', stored(), '654321', NOW)).toBe('wrong');
    expect(checkCode('user-b', stored(), '123456', NOW)).toBe('wrong');
  });
  it('rejects an expired code even when it is right', () => {
    expect(checkCode('user-a', stored({ expires: NOW }), '123456', NOW)).toBe('expired');
  });
  it('burns the code after the attempt limit, even for the right code', () => {
    expect(checkCode('user-a', stored({ attempts: PHONE_CODE_MAX_ATTEMPTS }), '123456', NOW)).toBe('too_many_attempts');
    expect(checkCode('user-a', stored({ attempts: PHONE_CODE_MAX_ATTEMPTS - 1 }), '123456', NOW)).toBe('verified');
  });
  it('says so when no code was ever issued', () => {
    expect(checkCode('user-a', stored({ hash: null }), '123456', NOW)).toBe('no_code');
    expect(checkCode('user-a', stored({ expires: null }), '123456', NOW)).toBe('no_code');
  });
});

describe('generateCode', () => {
  it('draws every digit and does not repeat itself', () => {
    const codes = Array.from({ length: 500 }, () => generateCode());
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codes.join('')).size).toBe(10);
    expect(new Set(codes).size).toBeGreaterThan(490);
  });

  it('uses the CSPRNG, not Math.random', () => {
    // Comments stripped: the source names Math.random to say why it is not used.
    const src = fs.readFileSync(path.join(__dirname, 'phone.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).toMatch(/\brandomInt\(/);
    expect(src).not.toMatch(/\bMath\.random\b/);
  });
});

describe('issuedRecently', () => {
  const at = (issuedAt: Date) => ({
    phoneCodeHash: 'h',
    phoneCodeExpiresAt: new Date(issuedAt.getTime() + PHONE_CODE_MINUTES * 60_000),
    phoneCodeAttempts: 0,
  });
  it('is true inside the resend window and false after it', () => {
    expect(issuedRecently(at(NOW), new Date(NOW.getTime() + (PHONE_RESEND_SECONDS - 1) * 1000))).toBe(true);
    expect(issuedRecently(at(NOW), new Date(NOW.getTime() + PHONE_RESEND_SECONDS * 1000))).toBe(false);
  });
  it('is false when no code is waiting', () => {
    expect(issuedRecently({ phoneCodeHash: null, phoneCodeExpiresAt: null, phoneCodeAttempts: 0 }, NOW)).toBe(false);
  });
});

describe('PHONE_E164', () => {
  it.each(['+353871234567', '+15551234567'])('accepts %s', (n) => expect(PHONE_E164.test(n)).toBe(true));
  it.each(['0871234567', '+0871234567', '+353 87 123 4567', ''])('rejects %j', (n) => expect(PHONE_E164.test(n)).toBe(false));
});
