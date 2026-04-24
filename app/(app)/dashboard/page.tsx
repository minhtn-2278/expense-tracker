import { z } from 'zod';
import { aggregateForPeriod } from '@/features/dashboard/queries';
import {
  labelForPeriod,
  shiftPeriod,
  formatLocalDate,
  type Period,
} from '@/features/dashboard/period';
import { PeriodSwitcher } from '@/features/dashboard/components/PeriodSwitcher';
import { TotalsCard } from '@/features/dashboard/components/TotalsCard';
import { CategoryBreakdown } from '@/features/dashboard/components/CategoryBreakdown';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

const SearchParams = z.object({
  period: z.enum(['day', 'week', 'month']).default('month'),
  anchor: z.string().date().optional(),
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = SearchParams.safeParse(raw);
  const { period, anchor: rawAnchor } = parsed.success
    ? parsed.data
    : { period: 'month' as Period, anchor: undefined };

  // `anchor` in URL is a YYYY-MM-DD string in the user's tz. Convert to Date.
  const now = new Date();
  const anchorDate = rawAnchor
    ? new Date(`${rawAnchor}T00:00:00Z`)
    : now;

  const totals = await aggregateForPeriod({ period, anchor: anchorDate });

  const anchorLocal = formatLocalDate(anchorDate, DEFAULT_TZ);
  const todayLocal = formatLocalDate(now, DEFAULT_TZ);
  const prevAnchor = formatLocalDate(
    shiftPeriod(period, anchorDate, DEFAULT_TZ, -1),
    DEFAULT_TZ,
  );
  const nextAnchor = formatLocalDate(
    shiftPeriod(period, anchorDate, DEFAULT_TZ, +1),
    DEFAULT_TZ,
  );
  const label = labelForPeriod(period, anchorDate, DEFAULT_TZ, now);

  const isEmpty = totals.totalIncome === 0 && totals.totalExpense === 0;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <PeriodSwitcher
          period={period}
          anchor={anchorLocal}
          todayAnchor={todayLocal}
          onPrev={prevAnchor}
          onNext={nextAnchor}
          label={label}
        />
      </header>

      <TotalsCard
        totalIncome={totals.totalIncome}
        totalExpense={totals.totalExpense}
        net={totals.net}
      />

      {isEmpty ? (
        <p className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Không có giao dịch nào trong kỳ này.
        </p>
      ) : (
        <CategoryBreakdown
          income={totals.byCategory.income}
          expense={totals.byCategory.expense}
        />
      )}
    </section>
  );
}
