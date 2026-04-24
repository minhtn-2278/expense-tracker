import { describe, it, expect } from 'vitest';
import { toPeriodBounds, formatLocalDate } from '@/lib/time/period';
// `features/dashboard/period.ts` does NOT exist yet — the import below is
// the Red driver: resolving it fails until T057 lands.
import { labelForPeriod } from '@/features/dashboard/period';

const VN = 'Asia/Ho_Chi_Minh';

describe('toPeriodBounds (lib/time/period.ts)', () => {
  it('week starts Monday — an anchor on Sunday maps to the Monday–Sunday range', () => {
    // 2026-04-26 is a Sunday in Vietnam (UTC+07:00).
    const anchor = new Date('2026-04-26T06:00:00Z'); // 13:00 VN
    const { fromUtc, toUtc } = toPeriodBounds('week', anchor, VN);
    expect(formatLocalDate(fromUtc, VN)).toBe('2026-04-20'); // Mon
    expect(formatLocalDate(new Date(toUtc.getTime() - 1), VN)).toBe('2026-04-26'); // Sun
  });

  it('day bounds cover exactly 24 hours anchored on the user-local date', () => {
    const anchor = new Date('2026-04-23T10:00:00Z'); // 17:00 VN
    const { fromUtc, toUtc } = toPeriodBounds('day', anchor, VN);
    expect(formatLocalDate(fromUtc, VN)).toBe('2026-04-23');
    expect(toUtc.getTime() - fromUtc.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('month bounds span the full calendar month and cross the year boundary', () => {
    const anchor = new Date('2026-12-15T12:00:00Z'); // mid-December VN
    const { fromUtc, toUtc } = toPeriodBounds('month', anchor, VN);
    expect(formatLocalDate(fromUtc, VN)).toBe('2026-12-01');
    // Exclusive upper bound = Jan 1 next year at local midnight.
    expect(formatLocalDate(toUtc, VN)).toBe('2027-01-01');
  });

  it('UTC-midnight transaction falls into the user-local day of that instant', () => {
    // 2026-04-23T00:00:00Z === 2026-04-23T07:00 VN — still "the 23rd" locally.
    const tx = new Date('2026-04-23T00:00:00Z');
    const { fromUtc, toUtc } = toPeriodBounds('day', tx, VN);
    expect(tx.getTime()).toBeGreaterThanOrEqual(fromUtc.getTime());
    expect(tx.getTime()).toBeLessThan(toUtc.getTime());
    expect(formatLocalDate(fromUtc, VN)).toBe('2026-04-23');
  });
});

describe('labelForPeriod (features/dashboard/period.ts)', () => {
  // Fixed "now" so tests are deterministic; real callers pass `new Date()`.
  const now = new Date('2026-04-24T08:00:00Z'); // Fri 15:00 VN

  it('day label for today is "Hôm nay"', () => {
    expect(labelForPeriod('day', now, VN, now)).toBe('Hôm nay');
  });

  it('day label for a past day uses Vietnamese DD/MM/YYYY', () => {
    const anchor = new Date('2026-04-23T08:00:00Z');
    expect(labelForPeriod('day', anchor, VN, now)).toBe('23/04/2026');
  });

  it('week label for the period containing "now" is "Tuần này"', () => {
    // 2026-04-22 Wed → same week as "now" (Apr 24 Fri)
    const anchor = new Date('2026-04-22T06:00:00Z');
    expect(labelForPeriod('week', anchor, VN, now)).toBe('Tuần này');
  });

  it('week label for a past week uses "Tuần DD/MM – DD/MM/YYYY"', () => {
    // Previous week: Mon 2026-04-13 → Sun 2026-04-19
    const anchor = new Date('2026-04-15T06:00:00Z');
    expect(labelForPeriod('week', anchor, VN, now)).toBe('Tuần 13/04 – 19/04/2026');
  });

  it('month label for the current month is "Tháng này"', () => {
    const anchor = new Date('2026-04-15T06:00:00Z');
    expect(labelForPeriod('month', anchor, VN, now)).toBe('Tháng này');
  });

  it('month label for a past month uses "Tháng MM/YYYY"', () => {
    const anchor = new Date('2026-03-15T06:00:00Z');
    expect(labelForPeriod('month', anchor, VN, now)).toBe('Tháng 03/2026');
  });
});
