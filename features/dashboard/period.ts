import {
  toPeriodBounds,
  shiftPeriod,
  formatLocalDate,
  type Period,
} from '@/lib/time/period';
import { formatInTimeZone } from 'date-fns-tz';

export { toPeriodBounds, shiftPeriod, formatLocalDate };
export type { Period };

/**
 * Vietnamese user-facing label for a period anchored at `anchor`,
 * compared against `now` (default: current wall clock).
 *
 *   day   → "Hôm nay" | "DD/MM/YYYY"
 *   week  → "Tuần này" | "Tuần DD/MM – DD/MM/YYYY"
 *   month → "Tháng này" | "Tháng MM/YYYY"
 */
export function labelForPeriod(
  period: Period,
  anchor: Date,
  tz: string,
  now: Date = new Date(),
): string {
  const anchorBounds = toPeriodBounds(period, anchor, tz);
  const nowBounds = toPeriodBounds(period, now, tz);
  const sameBucket =
    anchorBounds.fromUtc.getTime() === nowBounds.fromUtc.getTime();

  if (period === 'day') {
    if (sameBucket) return 'Hôm nay';
    return formatInTimeZone(anchor, tz, 'dd/MM/yyyy');
  }

  if (period === 'week') {
    if (sameBucket) return 'Tuần này';
    const endInclusive = new Date(anchorBounds.toUtc.getTime() - 1);
    const start = formatInTimeZone(anchorBounds.fromUtc, tz, 'dd/MM');
    const end = formatInTimeZone(endInclusive, tz, 'dd/MM/yyyy');
    return `Tuần ${start} – ${end}`;
  }

  // month
  if (sameBucket) return 'Tháng này';
  return formatInTimeZone(anchor, tz, "'Tháng' MM/yyyy");
}
