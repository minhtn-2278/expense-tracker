'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { Period } from '@/lib/time/period';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
];

interface Props {
  period: Period;
  anchor: string; // YYYY-MM-DD in the user's tz
  todayAnchor: string; // YYYY-MM-DD for `now` in user's tz
  onPrev: string; // precomputed anchor for previous period (server-supplied)
  onNext: string; // precomputed anchor for next period
  label: string;
}

export function PeriodSwitcher({
  period,
  anchor,
  todayAnchor,
  onPrev,
  onNext,
  label,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function navigate(nextPeriod: Period, nextAnchor: string) {
    const next = new URLSearchParams(params);
    next.set('period', nextPeriod);
    next.set('anchor', nextAnchor);
    startTransition(() => router.push(`/dashboard?${next.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Kỳ hiển thị"
        className="inline-flex w-fit rounded-full border border-zinc-300 p-1 dark:border-zinc-700"
      >
        {PERIODS.map((p) => {
          const active = p.value === period;
          return (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={pending}
              className={`rounded-full px-3 py-1 text-sm ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
              onClick={() => navigate(p.value, anchor)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          onClick={() => navigate(period, onPrev)}
        >
          ← Trước
        </button>
        <button
          type="button"
          disabled={pending || anchor === todayAnchor}
          className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          onClick={() => navigate(period, todayAnchor)}
        >
          Hiện tại
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          onClick={() => navigate(period, onNext)}
        >
          Sau →
        </button>
        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      </div>
    </div>
  );
}
