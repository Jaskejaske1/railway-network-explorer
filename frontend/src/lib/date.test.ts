import { describe, expect, it } from 'vitest';
import { belgianNow, initialDeparture, isFuture } from './date';

describe('Belgian travel dates', () => {
  it('handles local civil time and midnight rollover', () => {
    expect(belgianNow(new Date('2026-10-15T22:58:00Z'))).toEqual({ date: '2026-10-16', time: '00:58' });
    expect(initialDeparture(new Date('2026-10-15T21:58:00Z'))).toEqual({ date: '2026-10-16', time: '00:05' });
  });
  it('rejects journeys in the past', () => {
    expect(isFuture('2026-10-16', '09:00', { date: '2026-10-16', time: '09:30' })).toBe(false);
    expect(isFuture('2026-10-17', '08:00', { date: '2026-10-16', time: '09:30' })).toBe(true);
  });
});
