/**
 * Phone verification code generation and validation.
 *
 * The code is the sole proof of phone ownership, so the source of its randomness is a
 * security property, not an implementation detail — hence the structural assertion.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { generateVerificationCode, getVerificationExpiration, validateVerificationCode } from './verificationService';

describe('generateVerificationCode', () => {
  it('returns six digits by default', () => {
    const code = generateVerificationCode();
    assert.equal(code.length, 6);
    assert.match(code, /^[0-9]{6}$/);
  });

  it('honours a requested length', () => {
    for (const length of [1, 4, 8, 12]) {
      const code = generateVerificationCode(length);
      assert.equal(code.length, length, `length ${length}`);
      assert.match(code, new RegExp(`^[0-9]{${length}}$`));
    }
  });

  it('draws every digit and does not repeat itself', () => {
    const codes = Array.from({ length: 500 }, () => generateVerificationCode());
    const digits = new Set(codes.join('').split(''));
    // A generator stuck on a constant, or one that lost its per-draw call, fails here.
    assert.equal(digits.size, 10, `expected all ten digits, saw ${[...digits].sort().join('')}`);
    assert.ok(new Set(codes).size > 490, 'codes are not distinct enough to be random');
  });

  it('is generated from the CSPRNG, not Math.random', () => {
    // Strip comments first: this file's own prose names Math.random to explain why it
    // is not used, and a plain substring check matches that and passes vacuously.
    const src = fs
      .readFileSync(path.join(__dirname, 'verificationService.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.ok(src.includes("randomInt } from 'node:crypto'"), 'crypto.randomInt import missing');
    assert.ok(/\brandomInt\s*\(/.test(src), 'randomInt is imported but never called');
    assert.equal(/\bMath\.random\b/.test(src), false, 'Math.random is predictable; use randomInt');
  });
});

describe('validateVerificationCode', () => {
  const future = () => new Date(Date.now() + 60_000);
  const past = () => new Date(Date.now() - 60_000);

  it('accepts a matching, unexpired code', () => {
    assert.equal(validateVerificationCode('123456', '123456', future()), true);
  });

  it('rejects a mismatched code', () => {
    assert.equal(validateVerificationCode('123456', '654321', future()), false);
  });

  it('rejects an expired code even when it matches', () => {
    assert.equal(validateVerificationCode('123456', '123456', past()), false);
  });

  it('rejects when no code was ever stored', () => {
    assert.equal(validateVerificationCode(null, '123456', future()), false);
    assert.equal(validateVerificationCode(undefined, '123456', future()), false);
  });

  it('rejects when there is no expiry to check against', () => {
    assert.equal(validateVerificationCode('123456', '123456', null), false);
    assert.equal(validateVerificationCode('123456', '123456', undefined), false);
  });
});

describe('getVerificationExpiration', () => {
  it('defaults to ten minutes ahead', () => {
    const delta = getVerificationExpiration().getTime() - Date.now();
    assert.ok(delta > 9 * 60_000 && delta <= 10 * 60_000 + 1000, `delta was ${delta}ms`);
  });

  it('honours a custom window', () => {
    const delta = getVerificationExpiration(2).getTime() - Date.now();
    assert.ok(delta > 60_000 && delta <= 2 * 60_000 + 1000, `delta was ${delta}ms`);
  });
});
