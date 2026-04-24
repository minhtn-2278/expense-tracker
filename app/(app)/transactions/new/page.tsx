import { listCategories } from '@/features/categories/queries';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';

export default async function NewTransactionPage() {
  const categories = await listCategories();
  return <TransactionForm mode="create" categories={categories} />;
}
