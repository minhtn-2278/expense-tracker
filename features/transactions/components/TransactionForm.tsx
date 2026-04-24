'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TransactionInput } from '../schemas';
import type { GroupedCategories } from '@/types/categories';
import type { TransactionRow } from '../queries';
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
} from '../actions';

interface Props {
  mode: 'create' | 'edit';
  categories: GroupedCategories;
  initial?: TransactionRow;
}

export function TransactionForm({ mode, categories, initial }: Props) {
  const router = useRouter();
  const [topError, setTopError] = useState<string | null>(null);

  const defaults = useMemo<TransactionInput>(() => {
    if (initial) {
      return {
        kind: initial.kind,
        amount: Number(initial.amount),
        occurredAt: initial.occurred_at,
        categoryId: initial.category_id,
        note: initial.note ?? undefined,
      };
    }
    return {
      kind: 'expense',
      amount: 0,
      occurredAt: new Date().toISOString(),
      categoryId: categories.expense[0]?.id ?? '',
      note: undefined,
    };
  }, [initial, categories]);

  const form = useForm<TransactionInput>({
    resolver: zodResolver(TransactionInput),
    defaultValues: defaults,
    mode: 'onBlur',
  });

  // `useWatch` (not `form.watch(...)`) so the React Compiler can safely
  // memoise this subtree — `form.watch` returns a fresh function each render.
  const kind = useWatch({ control: form.control, name: 'kind', defaultValue: defaults.kind });
  const picker = kind === 'income' ? categories.income : categories.expense;

  const onSubmit = form.handleSubmit(async (values) => {
    setTopError(null);
    const result =
      mode === 'create'
        ? await createTransactionAction(values)
        : await updateTransactionAction({ id: initial!.id, patch: values });
    if (!result.ok) {
      if (result.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(result.error.fieldErrors)) {
          if (msgs?.[0]) form.setError(field as keyof TransactionInput, { message: msgs[0] });
        }
      } else {
        setTopError(result.error.message);
      }
      return;
    }
    router.push('/transactions');
    router.refresh();
  });

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm('Xoá giao dịch này?')) return;
    const result = await deleteTransactionAction({ id: initial.id });
    if (!result.ok) {
      setTopError(result.error.message);
      return;
    }
    router.push('/transactions');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {mode === 'create' ? 'Thêm giao dịch' : 'Sửa giao dịch'}
      </h1>

      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" value="expense" {...form.register('kind')} /> Chi
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" value="income" {...form.register('kind')} /> Thu
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>Số tiền (VND)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('amount', { valueAsNumber: true })}
        />
        {form.formState.errors.amount && (
          <span className="text-xs text-red-600">{form.formState.errors.amount.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Danh mục</span>
        <select
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('categoryId')}
        >
          {picker.length === 0 && <option value="">— chưa có danh mục —</option>}
          {picker.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {form.formState.errors.categoryId && (
          <span className="text-xs text-red-600">{form.formState.errors.categoryId.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Thời điểm</span>
        <input
          type="datetime-local"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          defaultValue={toLocalDatetime(defaults.occurredAt)}
          onChange={(e) => {
            const iso = e.target.value
              ? new Date(e.target.value).toISOString()
              : new Date().toISOString();
            form.setValue('occurredAt', iso, { shouldValidate: true });
          }}
        />
        {form.formState.errors.occurredAt && (
          <span className="text-xs text-red-600">{form.formState.errors.occurredAt.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Ghi chú (tuỳ chọn)</span>
        <textarea
          rows={3}
          maxLength={500}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('note')}
        />
        {form.formState.errors.note && (
          <span className="text-xs text-red-600">{form.formState.errors.note.message}</span>
        )}
      </label>

      {topError && <p className="text-sm text-red-600">{topError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {mode === 'create' ? 'Tạo giao dịch' : 'Lưu thay đổi'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Xoá
          </button>
        )}
      </div>
    </form>
  );
}

function toLocalDatetime(iso: string): string {
  // datetime-local input expects 'YYYY-MM-DDTHH:mm' in the browser's timezone.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
