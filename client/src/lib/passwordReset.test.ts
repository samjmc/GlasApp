import { describe, expect, it } from 'vitest';
import { newPasswordSchema, readAuthLinkError } from './passwordReset';

describe('newPasswordSchema', () => {
  it('accepts 8+ characters typed twice', () => {
    expect(newPasswordSchema.safeParse({ password: 'abcd1234', confirmPassword: 'abcd1234' }).success).toBe(true);
  });

  it('rejects a short password and a mismatch, on the right field', () => {
    const short = newPasswordSchema.safeParse({ password: 'abc', confirmPassword: 'abc' });
    expect(short.success).toBe(false);
    expect(short.error!.issues[0].path).toEqual(['password']);

    const mismatch = newPasswordSchema.safeParse({ password: 'abcd1234', confirmPassword: 'abcd12345' });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error!.issues[0]).toMatchObject({ path: ['confirmPassword'], message: 'The two passwords do not match' });
  });
});

describe('readAuthLinkError', () => {
  it('reads the reason from the hash or the query', () => {
    expect(readAuthLinkError('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toBe('Email link is invalid or has expired');
    expect(readAuthLinkError('?error=access_denied', '')).toBe('access_denied');
  });

  it('is null for a good link', () => {
    expect(readAuthLinkError('?code=abc123', '')).toBeNull();
    expect(readAuthLinkError('', '')).toBeNull();
  });
});
