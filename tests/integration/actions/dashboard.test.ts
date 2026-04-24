import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * aggregateForPeriod integration test.
 *
 * With a mocked Supabase client, assert:
 *   1. The caller's profile timezone is read and forwarded to the
 *      `dashboard_totals` RPC as `p_tz`.
 *   2. A missing profile (e.g. just-created account) falls back to
 *      `Asia/Ho_Chi_Minh`.
 *   3. The RPC result is passed through shaped as expected — no bucketing
 *      in JS; the DB function is the source of truth.
 *
 * RLS correctness is verified manually per supabase/RLS-VERIFY.md.
 */

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: 'user-1' } },
      error: null,
    })),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}));
vi.mock('server-only', () => ({}));

const { aggregateForPeriod } = await import('@/features/dashboard/queries');

function mockProfileTimezone(tz: string | null) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table !== 'profiles') throw new Error(`unexpected from(${table})`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: tz === null ? null : { timezone: tz },
            error: null,
          }),
        }),
      }),
    };
  });
}

const RPC_OK = {
  data: {
    from: '2026-04-19T17:00:00+00:00',
    to: '2026-04-26T17:00:00+00:00',
    totalIncome: 20000000,
    totalExpense: 500000,
    net: 19500000,
    byCategory: {
      income: [{ categoryId: 'c1', name: 'Lương', total: 20000000 }],
      expense: [{ categoryId: 'c2', name: 'Ăn uống', total: 500000 }],
    },
  },
  error: null,
};

beforeEach(() => {
  supabaseMock.from.mockReset();
  supabaseMock.rpc.mockReset();
});

describe('aggregateForPeriod', () => {
  it("calls dashboard_totals RPC with the user's profile timezone", async () => {
    mockProfileTimezone('Asia/Ho_Chi_Minh');
    supabaseMock.rpc.mockResolvedValue(RPC_OK);

    const anchor = new Date('2026-04-22T06:00:00Z');
    await aggregateForPeriod({ period: 'week', anchor });

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'dashboard_totals',
      expect.objectContaining({
        p_period: 'week',
        p_tz: 'Asia/Ho_Chi_Minh',
        p_anchor: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('falls back to Asia/Ho_Chi_Minh when the profile row has no timezone', async () => {
    mockProfileTimezone(null);
    supabaseMock.rpc.mockResolvedValue(RPC_OK);

    await aggregateForPeriod({ period: 'day', anchor: new Date() });

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'dashboard_totals',
      expect.objectContaining({ p_tz: 'Asia/Ho_Chi_Minh' }),
    );
  });

  it('returns the typed totals + category breakdown from the RPC', async () => {
    mockProfileTimezone('Asia/Ho_Chi_Minh');
    supabaseMock.rpc.mockResolvedValue(RPC_OK);

    const result = await aggregateForPeriod({
      period: 'week',
      anchor: new Date('2026-04-22T06:00:00Z'),
    });

    expect(result.totalIncome).toBe(20000000);
    expect(result.totalExpense).toBe(500000);
    expect(result.net).toBe(19500000);
    expect(result.byCategory.income).toHaveLength(1);
    expect(result.byCategory.income[0]?.name).toBe('Lương');
    expect(result.byCategory.expense[0]?.name).toBe('Ăn uống');
  });

  it('returns zeroed totals + empty category arrays when the period has no transactions', async () => {
    mockProfileTimezone('Asia/Ho_Chi_Minh');
    supabaseMock.rpc.mockResolvedValue({
      data: {
        from: '',
        to: '',
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
        byCategory: { income: [], expense: [] },
      },
      error: null,
    });

    const result = await aggregateForPeriod({
      period: 'month',
      anchor: new Date(),
    });

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.net).toBe(0);
    expect(result.byCategory.income).toEqual([]);
    expect(result.byCategory.expense).toEqual([]);
  });
});
