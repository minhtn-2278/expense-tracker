import { formatVND } from '@/lib/utils/money';
import type { CategoryTotal } from '../queries';

interface Props {
  income: CategoryTotal[];
  expense: CategoryTotal[];
}

export function CategoryBreakdown({ income, expense }: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <BreakdownList title="Theo danh mục thu" rows={income} accent="positive" />
      <BreakdownList title="Theo danh mục chi" rows={expense} accent="negative" />
    </section>
  );
}

function BreakdownList({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: CategoryTotal[];
  accent: 'positive' | 'negative';
}) {
  const color =
    accent === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  const sign = accent === 'positive' ? '+ ' : '− ';

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Không có giao dịch trong kỳ.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((row) => (
            <li key={row.categoryId} className="flex items-center justify-between">
              <span>{row.name}</span>
              <span className={color}>
                {sign}
                {formatVND(Math.abs(row.total))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
