import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Category, GroupedCategories } from '@/types/categories';

export type { Category, GroupedCategories };

/**
 * Returns the caller's categories grouped by kind and sorted by name.
 * `includeArchived: false` (default) hides archived categories from the
 * picker on forms; the category-management page passes `true` to show them.
 */
export async function listCategories(
  options: { includeArchived?: boolean } = {},
): Promise<GroupedCategories> {
  const { includeArchived = false } = options;
  const supabase = await createClient();

  let query = supabase.from('categories').select('*').order('name', { ascending: true });
  if (!includeArchived) query = query.eq('archived', false);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  return {
    income: rows.filter((r) => r.kind === 'income'),
    expense: rows.filter((r) => r.kind === 'expense'),
  };
}

export async function getCategory(id: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
