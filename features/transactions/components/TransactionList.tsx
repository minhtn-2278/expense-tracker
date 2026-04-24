import Link from 'next/link';
import { formatVND } from '@/lib/utils/money';
import type { TransactionPage } from '../queries';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function TransactionList({ page }: { page: TransactionPage }) {
  if (page.rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        Chưa có giao dịch nào. Bấm <strong>Thêm giao dịch</strong> để bắt đầu.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {page.rows.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex flex-1 flex-col">
              <span
                className={`text-sm font-medium ${
                  t.kind === 'income' ? 'text-emerald-700' : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {t.kind === 'income' ? '+' : '−'} {formatVND(Number(t.amount))}
              </span>
              <span className="text-xs text-zinc-500">
                {t.category?.name ?? 'Không rõ danh mục'} · {dateFormatter.format(new Date(t.occurred_at))}
              </span>
              {t.note && <span className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t.note}</span>}
            </div>
            <Link
              href={`/transactions/${t.id}/edit`}
              className="rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Sửa
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {page.page > 1 && (
            <Link
              href={`/transactions?page=${page.page - 1}`}
              className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              ← Trước
            </Link>
          )}
          <span className="text-zinc-500">
            Trang {page.page} / {totalPages}
          </span>
          {page.page < totalPages && (
            <Link
              href={`/transactions?page=${page.page + 1}`}
              className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sau →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
