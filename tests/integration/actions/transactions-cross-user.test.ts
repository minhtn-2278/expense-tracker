import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Action-layer cross-user test.
 *
 * Postgres RLS makes cross-user SELECT / UPDATE / DELETE affect zero rows
 * (the row is invisible). The action must interpret "0 rows affected" as
 * NOT_FOUND rather than returning `ok: true` on a silent no-op. This test
 * asserts that interpretation with a mocked Supabase client — RLS itself
 * is verified manually per supabase/RLS-VERIFY.md.
 */

const supabaseMock = {
  from: vi.fn(),
  auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('server-only', () => ({}));

const { deleteTransactionAction, updateTransactionAction } = await import(
  '@/features/transactions/actions'
);

// RFC 4122 v4 UUID — required by Zod 4's strict z.string().uuid().
const TARGET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

beforeEach(() => {
  supabaseMock.from.mockReset();
});

describe('deleteTransactionAction — cross-user target', () => {
  it('returns NOT_FOUND when RLS hides the row (0 rows affected)', async () => {
    supabaseMock.from.mockImplementation((t: string) => {
      if (t !== 'transactions') throw new Error(`unexpected from(${t})`);
      return {
        delete: () => ({
          eq: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await deleteTransactionAction({ id: TARGET_ID });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('NOT_FOUND');
  });
});

describe('updateTransactionAction — cross-user target', () => {
  it('returns NOT_FOUND when RLS hides the row on a non-category-changing patch', async () => {
    supabaseMock.from.mockImplementation((t: string) => {
      if (t !== 'transactions') throw new Error(`unexpected from(${t})`);
      return {
        update: () => ({
          eq: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await updateTransactionAction({
      id: TARGET_ID,
      patch: { note: 'tampered' },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('NOT_FOUND');
  });
});
