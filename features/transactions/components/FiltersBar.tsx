import type { GroupedCategories } from '@/types/categories';

export interface FilterDefaults {
  q?: string;
  from?: string;
  to?: string;
  kind?: 'income' | 'expense';
  categoryIds?: string[];
  amountMin?: string;
  amountMax?: string;
}

interface Props {
  categories: GroupedCategories;
  defaults: FilterDefaults;
}

/**
 * Native GET form. Submitting navigates the browser to
 * `/transactions?<serialized>`, which forces Next to re-render the server
 * page with fresh `searchParams`. An earlier JS-driven version used
 * `router.push(...)` and — due to Next's router cache — did not always
 * re-render for same-path navigations, so q/kind/category/amount filters
 * appeared to be ignored even though the CSV export route (invoked directly)
 * saw the same params fine.
 *
 * Kept as a server component: no hooks, no client JS required. Controls are
 * uncontrolled; `defaults` seed them from the already-parsed filters.
 */
export function FiltersBar({ categories, defaults }: Props) {
  const allCategories = [...categories.income, ...categories.expense].sort((a, b) =>
    a.name.localeCompare(b.name, 'vi'),
  );

  return (
    <form
      method="GET"
      action="/transactions"
      className="grid grid-cols-1 gap-3 rounded border border-zinc-200 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Tìm kiếm</span>
        <input
          aria-label="Từ khoá"
          name="q"
          type="search"
          defaultValue={defaults.q ?? ''}
          placeholder="Ghi chú…"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Loại</span>
        <select
          aria-label="Loại"
          name="kind"
          defaultValue={defaults.kind ?? ''}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Tất cả</option>
          <option value="income">Thu</option>
          <option value="expense">Chi</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Từ ngày</span>
        <input
          aria-label="Từ ngày"
          name="from"
          type="date"
          defaultValue={defaults.from ?? ''}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Đến ngày</span>
        <input
          aria-label="Đến ngày"
          name="to"
          type="date"
          defaultValue={defaults.to ?? ''}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Tối thiểu (VND)</span>
        <input
          aria-label="Tối thiểu"
          name="amountMin"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={defaults.amountMin ?? ''}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Tối đa (VND)</span>
        <input
          aria-label="Tối đa"
          name="amountMax"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={defaults.amountMax ?? ''}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">Danh mục</span>
        <select
          aria-label="Danh mục"
          name="categoryIds"
          multiple
          size={Math.min(4, Math.max(2, allCategories.length))}
          defaultValue={defaults.categoryIds ?? []}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.kind === 'income' ? 'Thu' : 'Chi'} · {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Áp dụng
        </button>
        <a
          href="/transactions"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Xoá lọc
        </a>
      </div>
    </form>
  );
}
