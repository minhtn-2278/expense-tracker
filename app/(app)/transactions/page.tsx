import Link from 'next/link';
import { listTransactions } from '@/features/transactions/queries';
import { TransactionFilters } from '@/features/transactions/schemas';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { FiltersBar } from '@/features/transactions/components/FiltersBar';
import { ExportCsvButton } from '@/features/transactions/components/ExportCsvButton';
import { listCategories } from '@/features/categories/queries';
import { cleanSearchParams } from '@/lib/utils/search-params';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = TransactionFilters.safeParse(cleanSearchParams(raw, ['categoryIds']));
  const filters = parsed.success ? parsed.data : TransactionFilters.parse({});

  const [page, categories] = await Promise.all([
    listTransactions(filters),
    listCategories({ includeArchived: false }),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Giao dịch</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton />
          <Link
            href="/transactions/new"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            + Thêm giao dịch
          </Link>
        </div>
      </header>
      <FiltersBar
        categories={categories}
        defaults={{
          q: filters.q,
          from: filters.from,
          to: filters.to,
          kind: filters.kind,
          categoryIds: filters.categoryIds,
          amountMin: filters.amountMin?.toString(),
          amountMax: filters.amountMax?.toString(),
        }}
      />
      <TransactionList page={page} />
    </section>
  );
}
