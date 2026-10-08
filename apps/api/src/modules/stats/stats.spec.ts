import { describe, expect, it } from 'vitest';
import { summarize } from './stats.module';
describe('dashboard calculations', () => {
  it('returns zero for a new workspace', () => {
    const result = summarize([]);
    expect(result.total).toBe(0);
    expect(result.responseRate).toBe(0);
    expect(result.weeks).toHaveLength(8);
  });
  it('excludes wishlist from response-rate denominator and respects week boundaries', () => {
    const result = summarize(
      [
        { status: 'WISHLIST', appliedAt: null },
        { status: 'INTERVIEW', appliedAt: new Date('2026-10-05T00:00:00Z') },
        { status: 'APPLIED', appliedAt: new Date('2026-10-04T23:59:00Z') },
      ],
      new Date('2026-10-07T12:00:00Z'),
    );
    expect(result.responseRate).toBe(50);
    expect(result.weeks[7]?.applications).toBe(1);
    expect(result.weeks[6]?.applications).toBe(1);
  });
});
