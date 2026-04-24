import { notFound } from 'next/navigation';
import { listCategories } from '@/features/categories/queries';
import { getTransaction } from '@/features/transactions/queries';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [transaction, categories] = await Promise.all([
    getTransaction(id),
    listCategories({ includeArchived: true }),
  ]);
  if (!transaction) notFound();
  return <TransactionForm mode="edit" categories={categories} initial={transaction} />;
}
