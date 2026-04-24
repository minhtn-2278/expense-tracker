import Link from 'next/link';
import { listTransactions } from '@/features/transactions/queries';
import { TransactionFilters } from '@/features/transactions/schemas';
import { TransactionList } from '@/features/transactions/components/TransactionList';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = TransactionFilters.safeParse(raw);
  const filters = parsed.success ? parsed.data : TransactionFilters.parse({});
  const page = await listTransactions(filters);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Giao dịch</h1>
        <Link
          href="/transactions/new"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          + Thêm giao dịch
        </Link>
      </header>
      <TransactionList page={page} />
    </section>
  );
}
