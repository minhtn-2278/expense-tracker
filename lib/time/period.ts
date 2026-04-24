import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
} from 'date-fns';

export type Period = 'day' | 'week' | 'month';

export interface PeriodBounds {
  /** inclusive lower bound in UTC */
  fromUtc: Date;
  /** exclusive upper bound in UTC */
  toUtc: Date;
}

/**
 * Compute the UTC bounds of a period that contains `anchor`, interpreted
 * in the user's local time zone. Weeks start on Monday (ISO 8601 /
 * clarification Q5).
 *
 * Example: anchor = 2026-04-24T08:00Z, tz = 'Asia/Ho_Chi_Minh', period='week'
 *   → from = 2026-04-20T00:00 local = 2026-04-19T17:00Z
 *     to   = 2026-04-27T00:00 local = 2026-04-26T17:00Z
 */
export function toPeriodBounds(
  period: Period,
  anchor: Date,
  tz: string,
): PeriodBounds {
  const zoned = toZonedTime(anchor, tz);

  let fromLocal: Date;
  let toLocal: Date;

  switch (period) {
    case 'day':
      fromLocal = startOfDay(zoned);
      toLocal = endOfDay(zoned);
      break;
    case 'week':
      fromLocal = startOfWeek(zoned, { weekStartsOn: 1 });
      toLocal = endOfWeek(zoned, { weekStartsOn: 1 });
      break;
    case 'month':
      fromLocal = startOfMonth(zoned);
      toLocal = endOfMonth(zoned);
      break;
  }

  // endOfDay/Week/Month returns the last millisecond of the period; add 1ms
  // so the upper bound is exclusive.
  toLocal = new Date(toLocal.getTime() + 1);

  return {
    fromUtc: fromZonedTime(fromLocal, tz),
    toUtc: fromZonedTime(toLocal, tz),
  };
}

export function shiftPeriod(
  period: Period,
  anchor: Date,
  tz: string,
  delta: number,
): Date {
  const zoned = toZonedTime(anchor, tz);
  const shifted =
    period === 'day'
      ? addDays(zoned, delta)
      : period === 'week'
        ? addWeeks(zoned, delta)
        : addMonths(zoned, delta);
  return fromZonedTime(shifted, tz);
}

/**
 * Format an anchor as a user-meaningful `YYYY-MM-DD` in the given tz —
 * used for passing as p_anchor to dashboard_totals RPC and for URL
 * search params.
 */
export function formatLocalDate(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}
