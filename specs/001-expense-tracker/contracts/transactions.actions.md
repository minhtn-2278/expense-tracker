# Contract: Transactions Server Actions

**Module**: `features/transactions/actions.ts`
**Trust boundary**: browser → server. Every action validates input with Zod
and enforces ownership via RLS (primary) + explicit server check (secondary).

Shared `ActionResult<T>` as defined in [`auth.actions.md`](./auth.actions.md).

## Shared input schemas

```ts
// features/transactions/schemas.ts
export const TransactionInput = z.object({
  kind: z.enum(['income', 'expense']),
  amount: z.coerce.number().int().positive(),       // VND, whole đồng only
  occurredAt: z.string().datetime(),                 // ISO 8601 UTC
  categoryId: z.string().uuid(),
  note: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
});
export type TransactionInput = z.infer<typeof TransactionInput>;

export const TransactionFilters = z.object({
  from:       z.string().date().optional(),          // inclusive, user-local
  to:         z.string().date().optional(),          // inclusive, user-local
  kind:       z.enum(['income', 'expense']).optional(),
  categoryIds: z.array(z.string().uuid()).max(50).optional(),
  amountMin:  z.coerce.number().int().nonnegative().optional(),
  amountMax:  z.coerce.number().int().positive().optional(),
  q:          z.string().trim().max(200).optional(), // note substring
  page:       z.coerce.number().int().min(1).default(1),
}).refine(
  f => !(f.from && f.to) || f.from <= f.to,
  { path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' },
).refine(
  f => !(f.amountMin && f.amountMax) || f.amountMin <= f.amountMax,
  { path: ['amountMax'], message: 'Số tiền tối đa phải lớn hơn tối thiểu.' },
);
```

## `createTransaction(input)`

Satisfies FR-007, FR-008, FR-009.

**Input**: `TransactionInput`.

**Behaviour**:

1. `TransactionInput.safeParse(input)` — return `VALIDATION` on failure.
2. Load `category = categories.findOne({ id: categoryId })` using the server
   client (RLS guarantees it belongs to the caller). If not found or
   `archived = true` → `{ code: 'CATEGORY_NOT_AVAILABLE' }`.
3. Server-side check: `category.kind === input.kind`. Mismatch →
   `{ code: 'CATEGORY_KIND_MISMATCH' }`. (The DB trigger will also reject this,
   but the server message is clearer.)
4. Insert row. `user_id` is set by `default auth.uid()` at DB layer.
5. `revalidatePath('/transactions')` and `revalidatePath('/dashboard')`.
6. Return `{ ok: true, data: { id } }`.

## `updateTransaction(id, input)`

Satisfies FR-011.

**Input**:

```ts
UpdateInput = z.object({
  id: z.string().uuid(),
  patch: TransactionInput.partial(),
});
```

**Behaviour**:

1. Validate.
2. If `patch.kind` or `patch.categoryId` provided, re-run the
   "category exists + same kind + same owner + not archived" checks as above.
3. Update with `where id = :id` (RLS denies rows not owned by caller → the
   query affects 0 rows, we map that to `{ code: 'NOT_FOUND' }`).
4. Revalidate the two paths above.

## `deleteTransaction(id)`

Satisfies FR-011.

**Input**: `{ id: uuid }`.

**Behaviour**:

1. Validate.
2. `supabase.from('transactions').delete().eq('id', id)` — RLS ensures cross-
   user deletes do nothing; we check `count === 1` and return `NOT_FOUND`
   otherwise.
3. Revalidate.

## `listTransactions(filters)` *(query, not a mutation)*

Used by the transactions page and the CSV Route Handler.

**Input**: `TransactionFilters`.

**Behaviour**:

1. Parse. Convert `from` / `to` from user-local dates into inclusive UTC
   bounds using the caller's `profiles.timezone`.
2. Build a parameterised Supabase query with the filters applied.
3. `q` → `.ilike('note', '%' + q + '%')` (note: `q` is escaped — `%` and `_`
   in the user's input are backslash-escaped by a small helper).
4. Order `occurred_at desc, id desc`; paginate `.range((page-1)*50, page*50-1)`.
5. Return `{ rows, total, page, pageSize }`.

**Errors**: `VALIDATION` only (no side effects to fail).

## Notes

- None of these actions imports the service-role client.
- All errors that should be shown to the user return Vietnamese copy; the
  `code` is the stable key used by tests and logs.
- The raw inputs are discarded after parsing; downstream code only ever sees
  `z.infer<typeof TransactionInput>`.
