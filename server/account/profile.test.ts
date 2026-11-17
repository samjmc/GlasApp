/**
 * Google sign-in puts one name in `user_metadata` (`full_name`, `name`) and no first or last name, so
 * the profile copy found nothing and a Google user saw a blank name on their profile.
 */
import { describe, expect, it } from 'vitest';
import { PROFILE_LIMITS, splitFullName } from './profile';

describe('splitFullName', () => {
  it('splits a Google full name at the first space', () => {
    expect(splitFullName({ full_name: 'Sam McDonnell', name: 'Sam McDonnell' })).toEqual({ first: 'Sam', last: 'McDonnell' });
    expect(splitFullName({ full_name: '  Mary Lou   McDonald ' })).toEqual({ first: 'Mary', last: 'Lou McDonald' });
  });

  it('falls back to `name`, and gives no last name for one word', () => {
    expect(splitFullName({ name: 'Cher' })).toEqual({ first: 'Cher', last: null });
  });

  it('gives nothing for no usable name', () => {
    expect(splitFullName({})).toEqual({ first: null, last: null });
    expect(splitFullName({ full_name: '   ', name: 42 })).toEqual({ first: null, last: null });
  });

  it('drops a part longer than its column', () => {
    expect(splitFullName({ full_name: `${'a'.repeat(PROFILE_LIMITS.firstName + 1)} Tester` })).toEqual({ first: null, last: 'Tester' });
  });
});
