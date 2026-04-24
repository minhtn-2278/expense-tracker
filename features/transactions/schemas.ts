import { z } from 'zod';

export const TransactionKind = z.enum(['income', 'expense']);
export type TransactionKind = z.infer<typeof TransactionKind>;

/**
 * Input for createTransaction + updateTransaction server actions.
 * VND has no fractional part, so amount is coerced to integer.
 */
export const TransactionInput = z.object({
  kind: TransactionKind,
  // `z.number()` (not `z.coerce.number()`) keeps input type == output type so
  // RHF + zodResolver generics align. RHF supplies a number via
  // `register('amount', { valueAsNumber: true })`; empty fields become NaN,
  // which fails `.positive()` with a clear message.
  amount: z
    .number({ message: 'Số tiền không hợp lệ.' })
    .int({ message: 'Số tiền phải là số nguyên (VND).' })
    .positive({ message: 'Số tiền phải lớn hơn 0.' }),
  occurredAt: z.iso.datetime({ message: 'Thời điểm không hợp lệ.' }),
  categoryId: z.string().uuid({ message: 'Danh mục không hợp lệ.' }),
  // Empty-string note passes validation (length 0 ≤ 500) and is stored as-is.
  // We intentionally do not coerce '' → undefined in the schema: doing so
  // would make the Zod input type diverge from the output type and break
  // RHF + zodResolver generic inference.
  note: z
    .string()
    .trim()
    .max(500, { message: 'Ghi chú tối đa 500 ký tự.' })
    .optional(),
});
export type TransactionInput = z.infer<typeof TransactionInput>;

/**
 * Filters used by listTransactions + the CSV export route handler.
 * US1 consumes only { page }; US3 activates the rest.
 */
export const TransactionFilters = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    kind: TransactionKind.optional(),
    categoryIds: z.array(z.string().uuid()).max(50).optional(),
    amountMin: z.coerce.number().int().nonnegative().optional(),
    amountMax: z.coerce.number().int().positive().optional(),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((f) => !(f.from && f.to) || f.from <= f.to, {
    path: ['to'],
    message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
  })
  .refine((f) => !(f.amountMin && f.amountMax) || f.amountMin <= f.amountMax, {
    path: ['amountMax'],
    message: 'Số tiền tối đa phải lớn hơn số tiền tối thiểu.',
  });
export type TransactionFilters = z.infer<typeof TransactionFilters>;

export const TransactionId = z.object({ id: z.string().uuid() });
export const UpdateTransactionInput = z.object({
  id: z.string().uuid(),
  patch: TransactionInput.partial(),
});
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInput>;
