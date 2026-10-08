import { describe, expect, it, vi } from 'vitest';
import { relativeDate } from './utils';
describe('relative dates', () => {
  it('handles today, yesterday, older and future dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    expect(relativeDate('2026-10-07T09:00:00Z')).toBe('Today');
    expect(relativeDate('2026-10-06T09:00:00Z')).toBe('Yesterday');
    expect(relativeDate('2026-10-02T09:00:00Z')).toBe('5 days ago');
    expect(relativeDate('2026-10-09T09:00:00Z')).toBe('Today');
    vi.useRealTimers();
  });
});
