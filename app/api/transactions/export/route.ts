import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TransactionFilters } from '@/features/transactions/schemas';
import { CSV_HEADER, UTF8_BOM, encodeRow } from '@/features/transactions/csv';
import { formatLocalDate } from '@/lib/time/period';
import { cleanSearchParams } from '@/lib/utils/search-params';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 10_000;

type ExportRow = {
  occurred_at: string;
  kind: 'income' | 'expense';
  amount: number;
  note: string | null;
  category: { name: string } | null;
};

export async function GET(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const url = new URL(req.url);
  const input: Record<string, string | string[]> = Object.fromEntries(url.searchParams);
  const categoryIds = url.searchParams.getAll('categoryIds');
  if (categoryIds.length > 0) input.categoryIds = categoryIds;

  const parsed = TransactionFilters.safeParse(cleanSearchParams(input, ['categoryIds']));
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION',
          message: 'Tham số không hợp lệ.',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const filters = parsed.data;

  let q = supabase
    .from('transactions')
    .select('occurred_at, kind, amount, note, category:categories(name)')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false });

  if (filters.kind) q = q.eq('kind', filters.kind);
  if (filters.categoryIds?.length) q = q.in('category_id', filters.categoryIds);
  if (filters.amountMin !== undefined) q = q.gte('amount', filters.amountMin);
  if (filters.amountMax !== undefined) q = q.lte('amount', filters.amountMax);
  if (filters.from) q = q.gte('occurred_at', `${filters.from}T00:00:00Z`);
  if (filters.to) q = q.lte('occurred_at', `${filters.to}T23:59:59.999Z`);
  if (filters.q) q = q.ilike('note', `%${escapeLike(filters.q)}%`);

  q = q.range(0, MAX_ROWS - 1);

  const { data, error } = await q;
  if (error) {
    return Response.json(
      { error: { code: 'UNKNOWN', message: 'Không thể xuất dữ liệu.' } },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as ExportRow[];
  if (rows.length === 0) {
    return Response.json(
      {
        error: {
          code: 'NOTHING_TO_EXPORT',
          message: 'Không có giao dịch nào để xuất.',
        },
      },
      { status: 409 },
    );
  }

  const tz = 'Asia/Ho_Chi_Minh';
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(UTF8_BOM + CSV_HEADER + '\n'));
      for (const row of rows) {
        controller.enqueue(
          encoder.encode(
            encodeRow({
              date: formatLocalDate(new Date(row.occurred_at), tz),
              type: row.kind,
              category: row.category?.name ?? '',
              amount: row.amount,
              note: row.note,
            }) + '\n',
          ),
        );
      }
      controller.close();
    },
  });

  const filename = `transactions-${formatLocalDate(new Date(), tz).replace(/-/g, '')}.csv`;

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
