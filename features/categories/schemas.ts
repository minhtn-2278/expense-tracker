import { z } from 'zod';

export const CategoryKind = z.enum(['income', 'expense']);
export type CategoryKind = z.infer<typeof CategoryKind>;

export const CategoryInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Tên danh mục không được để trống.' })
    .max(40, { message: 'Tên danh mục tối đa 40 ký tự.' }),
  kind: CategoryKind,
});
export type CategoryInput = z.infer<typeof CategoryInput>;

export const RenameCategoryInput = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, { message: 'Tên danh mục không được để trống.' })
    .max(40, { message: 'Tên danh mục tối đa 40 ký tự.' }),
});
export type RenameCategoryInput = z.infer<typeof RenameCategoryInput>;

export const CategoryId = z.object({ id: z.string().uuid() });
export type CategoryId = z.infer<typeof CategoryId>;
