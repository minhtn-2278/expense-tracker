import type { Database } from './database';

export type Category = Database['public']['Tables']['categories']['Row'];

export interface GroupedCategories {
  income: Category[];
  expense: Category[];
}
