import { describe, expect, it } from 'vitest';
import { equalToken } from './guards';
describe('CSRF constant-time comparison', () => {
  it('rejects absent, empty, different, and Unicode-length-mismatched tokens', () => {
    expect(equalToken(undefined, undefined)).toBe(false);
    expect(equalToken('', '')).toBe(false);
    expect(equalToken('abc', 'abd')).toBe(false);
    expect(equalToken('é', 'aa')).toBe(false);
    expect(equalToken('csrf-secret', 'csrf-secret')).toBe(true);
  });
});
