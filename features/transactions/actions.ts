'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/lib/utils/errors';
import type { Database } from '@/types/database';
import {
  TransactionInput,
  TransactionId,
  UpdateTransactionInput,
} from './schemas';

type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export async function createTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = TransactionInput.safeParse(raw);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  const cat = await supabase
    .from('categories')
    .select('id, kind, archived')
    .eq('id', parsed.data.categoryId)
    .maybeSingle();
  if (!cat.data) return fail('CATEGORY_NOT_AVAILABLE', 'Danh mục không hợp lệ.');
  if (cat.data.archived)
    return fail('CATEGORY_NOT_AVAILABLE', 'Danh mục đã lưu trữ, không thể dùng.');
  if (cat.data.kind !== parsed.data.kind) {
    return fail(
      'CATEGORY_KIND_MISMATCH',
      'Loại giao dịch và loại danh mục không khớp.',
    );
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      occurred_at: parsed.data.occurredAt,
      category_id: parsed.data.categoryId,
      note: parsed.data.note ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return fail('UNKNOWN', 'Không thể tạo giao dịch.');

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return ok({ id: data.id });
}

export async function updateTransactionAction(raw: unknown): Promise<ActionResult> {
  const parsed = UpdateTransactionInput.safeParse(raw);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  // Revalidate category if kind or categoryId is being changed.
  if (parsed.data.patch.kind || parsed.data.patch.categoryId) {
    const categoryId = parsed.data.patch.categoryId;
    const kind = parsed.data.patch.kind;
    if (!categoryId || !kind) {
      return fail(
        'VALIDATION',
        'Khi đổi loại hoặc danh mục, phải cập nhật cả hai để đảm bảo khớp.',
      );
    }
    const cat = await supabase
      .from('categories')
      .select('kind, archived')
      .eq('id', categoryId)
      .maybeSingle();
    if (!cat.data) return fail('CATEGORY_NOT_AVAILABLE', 'Danh mục không hợp lệ.');
    if (cat.data.archived)
      return fail('CATEGORY_NOT_AVAILABLE', 'Danh mục đã lưu trữ, không thể dùng.');
    if (cat.data.kind !== kind) {
      return fail(
        'CATEGORY_KIND_MISMATCH',
        'Loại giao dịch và loại danh mục không khớp.',
      );
    }
  }

  const patch: TransactionUpdate = {};
  if (parsed.data.patch.kind !== undefined) patch.kind = parsed.data.patch.kind;
  if (parsed.data.patch.amount !== undefined) patch.amount = parsed.data.patch.amount;
  if (parsed.data.patch.occurredAt !== undefined)
    patch.occurred_at = parsed.data.patch.occurredAt;
  if (parsed.data.patch.categoryId !== undefined)
    patch.category_id = parsed.data.patch.categoryId;
  if (parsed.data.patch.note !== undefined) patch.note = parsed.data.patch.note ?? null;

  const { data, error } = await supabase
    .from('transactions')
    .update(patch)
    .eq('id', parsed.data.id)
    .select('id');
  if (error) return fail('UNKNOWN', 'Không thể cập nhật giao dịch.');
  if (!data?.length) return fail('NOT_FOUND', 'Không tìm thấy giao dịch.');

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return ok();
}

export async function deleteTransactionAction(raw: unknown): Promise<ActionResult> {
  const parsed = TransactionId.safeParse(raw);
  if (!parsed.success) return fail('VALIDATION', 'Dữ liệu không hợp lệ.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', parsed.data.id)
    .select('id');
  if (error) return fail('UNKNOWN', 'Không thể xoá giao dịch.');
  if (!data?.length) return fail('NOT_FOUND', 'Không tìm thấy giao dịch.');

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return ok();
}
