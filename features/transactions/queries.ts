import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { TransactionFilters } from './schemas';

export type Transaction = Database['public']['Tables']['transactions']['Row'];

export type TransactionRow = Transaction & {
  category: { name: string; kind: 'income' | 'expense' } | null;
};

const PAGE_SIZE = 50;

export interface TransactionPage {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated transaction list for the current user, newest first.
 *
 * US1 exercises only the pagination path (no filters). US3 will enable
 * the filter branches; the shape is kept here so the page component and
 * the export route handler share one query helper.
 */
export async function listTransactions(
  filters: TransactionFilters,
): Promise<TransactionPage> {
  const supabase = await createClient();

  let q = supabase
    .from('transactions')
    .select('*, category:categories(name, kind)', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false });

  if (filters.kind) q = q.eq('kind', filters.kind);
  if (filters.categoryIds?.length) q = q.in('category_id', filters.categoryIds);
  if (filters.amountMin !== undefined) q = q.gte('amount', filters.amountMin);
  if (filters.amountMax !== undefined) q = q.lte('amount', filters.amountMax);
  if (filters.from) q = q.gte('occurred_at', `${filters.from}T00:00:00Z`);
  if (filters.to) q = q.lte('occurred_at', `${filters.to}T23:59:59.999Z`);
  if (filters.q) q = q.ilike('note', `%${escapeLike(filters.q)}%`);

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data as TransactionRow[]) ?? [],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}

export async function getTransaction(id: string): Promise<TransactionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*, category:categories(name, kind)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TransactionRow | null;
}

/**
 * Escape user-provided substring so `%` and `_` are matched literally
 * in an ILIKE clause.
 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
