import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────
// The action module imports `@/lib/supabase/server` and `next/cache`; we
// stub both so the test exercises action LOGIC, not Postgres. Policy
// correctness is checked manually per supabase/RLS-VERIFY.md.

const supabaseMock = {
  from: vi.fn(),
  auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('server-only', () => ({}));

// Must be imported AFTER vi.mock declarations.
const { createTransactionAction } = await import('@/features/transactions/actions');

// RFC 4122 v4 UUID — required by Zod 4's strict z.string().uuid().
const VALID = {
  kind: 'income' as const,
  amount: 1000,
  occurredAt: '2026-04-23T10:00:00.000Z',
  categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function mockCategoryLookup(
  category: { id: string; kind: 'income' | 'expense'; archived: boolean } | null,
) {
  return {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: category, error: null }) }),
    }),
  };
}

beforeEach(() => {
  supabaseMock.from.mockReset();
});

describe('createTransactionAction — category/kind precheck', () => {
  it('returns CATEGORY_KIND_MISMATCH when kind != category.kind', async () => {
    supabaseMock.from.mockImplementation((t: string) => {
      if (t === 'categories') {
        return mockCategoryLookup({
          id: VALID.categoryId,
          kind: 'expense', // caller supplied 'income'
          archived: false,
        });
      }
      throw new Error(`unexpected from(${t})`);
    });

    const result = await createTransactionAction(VALID);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('CATEGORY_KIND_MISMATCH');
  });

  it('returns CATEGORY_NOT_AVAILABLE when the category is archived', async () => {
    supabaseMock.from.mockImplementation((t: string) => {
      if (t === 'categories') {
        return mockCategoryLookup({
          id: VALID.categoryId,
          kind: 'income',
          archived: true,
        });
      }
      throw new Error(`unexpected from(${t})`);
    });

    const result = await createTransactionAction(VALID);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('CATEGORY_NOT_AVAILABLE');
  });

  it('returns CATEGORY_NOT_AVAILABLE when the category does not exist', async () => {
    supabaseMock.from.mockImplementation((t: string) => {
      if (t === 'categories') return mockCategoryLookup(null);
      throw new Error(`unexpected from(${t})`);
    });

    const result = await createTransactionAction(VALID);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('CATEGORY_NOT_AVAILABLE');
  });

  it('rejects input with VALIDATION when amount is zero', async () => {
    const result = await createTransactionAction({ ...VALID, amount: 0 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('VALIDATION');
    // supabase.from should never have been called — schema rejected first
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
