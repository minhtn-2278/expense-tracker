'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/lib/utils/errors';
import {
  CategoryInput,
  CategoryId,
  RenameCategoryInput,
} from './schemas';

export async function createCategoryAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CategoryInput.safeParse(raw);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  // Pre-insert duplicate check — the partial unique index is the DB
  // fallback, this gives a clean error message.
  const { data: clash } = await supabase
    .from('categories')
    .select('id')
    .eq('name', parsed.data.name)
    .eq('kind', parsed.data.kind)
    .eq('archived', false)
    .maybeSingle();
  if (clash) return fail('DUPLICATE_NAME', 'Tên danh mục đã tồn tại.');

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: parsed.data.name, kind: parsed.data.kind })
    .select('id')
    .single();
  if (error || !data) return fail('UNKNOWN', 'Không thể tạo danh mục.');

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return ok({ id: data.id });
}

export async function renameCategoryAction(raw: unknown): Promise<ActionResult> {
  const parsed = RenameCategoryInput.safeParse(raw);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .select('id');
  if (error) {
    if (error.code === '23505') return fail('DUPLICATE_NAME', 'Tên danh mục đã tồn tại.');
    return fail('UNKNOWN', 'Không thể đổi tên danh mục.');
  }
  if (!updated?.length) return fail('NOT_FOUND', 'Không tìm thấy danh mục.');

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return ok();
}

export async function archiveCategoryAction(raw: unknown): Promise<ActionResult> {
  return setArchived(raw, true);
}

export async function unarchiveCategoryAction(raw: unknown): Promise<ActionResult> {
  return setArchived(raw, false);
}

export async function deleteCategoryAction(raw: unknown): Promise<ActionResult> {
  const parsed = CategoryId.safeParse(raw);
  if (!parsed.success) return fail('VALIDATION', 'Dữ liệu không hợp lệ.');

  const supabase = await createClient();

  // Refuse deletion while any transaction still references this category.
  // ON DELETE RESTRICT at the DB is the backstop.
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', parsed.data.id);
  if ((count ?? 0) > 0) {
    return fail(
      'CATEGORY_IN_USE',
      'Danh mục đang được dùng bởi giao dịch — hãy lưu trữ thay vì xoá.',
    );
  }

  const { data: deleted, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', parsed.data.id)
    .select('id');
  if (error) return fail('UNKNOWN', 'Không thể xoá danh mục.');
  if (!deleted?.length) return fail('NOT_FOUND', 'Không tìm thấy danh mục.');

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return ok();
}

async function setArchived(raw: unknown, archived: boolean): Promise<ActionResult> {
  const parsed = CategoryId.safeParse(raw);
  if (!parsed.success) return fail('VALIDATION', 'Dữ liệu không hợp lệ.');

  const supabase = await createClient();

  // Unarchive must not create a duplicate (same user, same name + kind,
  // and some other row already active).
  if (!archived) {
    const { data: target } = await supabase
      .from('categories')
      .select('name, kind')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (!target) return fail('NOT_FOUND', 'Không tìm thấy danh mục.');

    const { data: clash } = await supabase
      .from('categories')
      .select('id')
      .eq('name', target.name)
      .eq('kind', target.kind)
      .eq('archived', false)
      .neq('id', parsed.data.id)
      .maybeSingle();
    if (clash) {
      return fail('DUPLICATE_NAME', 'Đã có danh mục cùng tên đang hoạt động.');
    }
  }

  const { data: updated, error } = await supabase
    .from('categories')
    .update({ archived })
    .eq('id', parsed.data.id)
    .select('id');
  if (error) return fail('UNKNOWN', 'Không thể cập nhật trạng thái danh mục.');
  if (!updated?.length) return fail('NOT_FOUND', 'Không tìm thấy danh mục.');

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return ok();
}
