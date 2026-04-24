'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategoryInput } from '../schemas';
import type { Category, GroupedCategories } from '../queries';
import {
  createCategoryAction,
  renameCategoryAction,
  archiveCategoryAction,
  unarchiveCategoryAction,
  deleteCategoryAction,
} from '../actions';

export function CategoryManager({ initial }: { initial: GroupedCategories }) {
  return (
    <div className="flex flex-col gap-6">
      <NewCategoryForm />
      <CategoryGroup title="Danh mục thu" kind="income" rows={initial.income} />
      <CategoryGroup title="Danh mục chi" kind="expense" rows={initial.expense} />
    </div>
  );
}

function NewCategoryForm() {
  const router = useRouter();
  const [topError, setTopError] = useState<string | null>(null);
  const form = useForm<CategoryInput>({
    resolver: zodResolver(CategoryInput),
    defaultValues: { name: '', kind: 'expense' },
    mode: 'onBlur',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setTopError(null);
    const result = await createCategoryAction(values);
    if (!result.ok) {
      setTopError(result.error.message);
      return;
    }
    form.reset({ name: '', kind: values.kind });
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span>Tên</span>
        <input
          type="text"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('name')}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Loại</span>
        <select
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('kind')}
        >
          <option value="expense">Chi</option>
          <option value="income">Thu</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Thêm danh mục
      </button>
      {topError && <span className="text-sm text-red-600">{topError}</span>}
    </form>
  );
}

function CategoryGroup({
  title,
  rows,
}: {
  title: string;
  kind: 'income' | 'expense';
  rows: Category[];
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Chưa có danh mục.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handle = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setErr(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Lỗi không xác định.');
      }
    });

  return (
    <li
      className={`flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 dark:border-zinc-800 ${
        category.archived ? 'opacity-60' : ''
      }`}
    >
      {editing ? (
        <>
          <input
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            disabled={pending}
            className="rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() =>
              handle(async () => {
                const r = await renameCategoryAction({ id: category.id, name });
                if (!r.ok) throw new Error(r.error.message);
                setEditing(false);
              })
            }
          >
            Lưu
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setEditing(false);
              setName(category.name);
            }}
          >
            Huỷ
          </button>
        </>
      ) : (
        <>
          <span className="flex-1">
            {category.name}
            {category.archived && (
              <span className="ml-2 text-xs text-zinc-500">(đã lưu trữ)</span>
            )}
          </span>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setEditing(true)}
          >
            Đổi tên
          </button>
          {category.archived ? (
            <button
              type="button"
              disabled={pending}
              className="rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() =>
                handle(async () => {
                  const r = await unarchiveCategoryAction({ id: category.id });
                  if (!r.ok) throw new Error(r.error.message);
                })
              }
            >
              Khôi phục
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() =>
                handle(async () => {
                  const r = await archiveCategoryAction({ id: category.id });
                  if (!r.ok) throw new Error(r.error.message);
                })
              }
            >
              Lưu trữ
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => {
              if (!confirm(`Xoá danh mục "${category.name}"?`)) return;
              handle(async () => {
                const r = await deleteCategoryAction({ id: category.id });
                if (!r.ok) throw new Error(r.error.message);
              });
            }}
          >
            Xoá
          </button>
        </>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </li>
  );
}
