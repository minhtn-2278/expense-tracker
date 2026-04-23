# Contract: Categories Server Actions

**Module**: `features/categories/actions.ts`
Shared `ActionResult<T>`.

## Schemas

```ts
// features/categories/schemas.ts
export const CategoryInput = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['income', 'expense']),
});

export const RenameCategoryInput = z.object({
  id:   z.string().uuid(),
  name: z.string().trim().min(1).max(40),
});
```

## `createCategory(input)`

Satisfies FR-013.

1. Validate `CategoryInput`.
2. Pre-insert uniqueness check: a `select` for `(user_id = auth.uid(), name,
   kind, archived = false)` returning nothing. Partial unique index at the DB
   is the second line of defence; a violation is mapped to the same error.
3. Insert. `user_id` default from RLS.
4. Return `{ ok: true, data: { id } }`.

**Errors**: `VALIDATION`, `DUPLICATE_NAME`.

## `renameCategory({ id, name })`

Satisfies FR-013.

1. Validate.
2. Update with ownership implicit via RLS; 0 affected rows → `NOT_FOUND`.
3. Partial unique index catches collisions → map to `DUPLICATE_NAME`.

## `archiveCategory(id)` and `unarchiveCategory(id)`

Satisfies FR-013 and Edge Case "deleting a category with transactions".

- `archiveCategory`: `update categories set archived = true where id = :id`.
- `unarchiveCategory`: before unarchive, check there is no active category
  with the same `(user_id, name, kind)`; reject with `DUPLICATE_NAME` if so.

## `deleteCategory(id)`

Satisfies FR-014.

1. Validate `{ id: uuid }`.
2. `select count(*) from transactions where category_id = :id` (RLS ensures
   scope). If `> 0` → `{ ok: false, error: { code: 'CATEGORY_IN_USE' } }`;
   the UI copy instructs the user to archive instead.
3. `delete from categories where id = :id` — `on delete restrict` is still
   there as a last-ditch guard.

**Errors**: `VALIDATION`, `CATEGORY_IN_USE`, `NOT_FOUND`.

## `listCategories({ includeArchived = false })` *(query)*

Used by the category picker and the manage-categories page.

Returns `{ income: Category[]; expense: Category[] }` sorted by name.
