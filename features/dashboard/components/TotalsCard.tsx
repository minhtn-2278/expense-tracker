import { formatVND } from '@/lib/utils/money';

interface Props {
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export function TotalsCard({ totalIncome, totalExpense, net }: Props) {
  return (
    <section
      aria-label="Tổng quan"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <Stat label="Tổng thu" value={totalIncome} accent="positive" />
      <Stat label="Tổng chi" value={totalExpense} accent="negative" />
      <Stat label="Số dư" value={net} accent={net >= 0 ? 'positive' : 'negative'} />
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'positive' | 'negative';
}) {
  const color =
    accent === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  const sign = accent === 'positive' ? '+ ' : '− ';
  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>
        {sign}
        {formatVND(Math.abs(value))}
      </div>
    </div>
  );
}
