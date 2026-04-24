import { CategoryManager } from '@/features/categories/components/CategoryManager';
import { listCategories } from '@/features/categories/queries';

export default async function CategoriesPage() {
  const grouped = await listCategories({ includeArchived: true });
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Danh mục</h1>
      <CategoryManager initial={grouped} />
    </section>
  );
}
