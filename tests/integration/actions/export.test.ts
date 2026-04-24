import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contract test for the CSV export route handler.
 *
 *   GET /api/transactions/export
 *
 * Assertions:
 *   1. Unauthenticated → 302 redirect to /login.
 *   2. Matching rows      → 200 + BOM + header + 3 data lines.
 *   3. Zero matching rows → 409 NOTHING_TO_EXPORT.
 *   4. Invalid filters    → 400 VALIDATION.
 *
 * Boundary under test = the route's orchestration; Supabase is mocked so we
 * never need a live DB. RLS correctness is verified manually per
 * supabase/RLS-VERIFY.md.
 */

type Row = {
  occurred_at: string;
  kind: 'income' | 'expense';
  amount: number;
  note: string | null;
  category: { name: string } | null;
};

function makeBuilder(rows: Row[]) {
  const builder: Record<string, unknown> = {};
  const passthrough = () => builder;
  builder.select = passthrough;
  builder.order = passthrough;
  builder.eq = passthrough;
  builder.in = passthrough;
  builder.gte = passthrough;
  builder.lte = passthrough;
  builder.ilike = passthrough;
  builder.range = passthrough;
  builder.then = (onFulfilled: (value: { data: Row[]; error: null }) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  return builder;
}

type GetUserResult = {
  data: { user: { id: string } | null };
  error: null;
};

const supabaseMock = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(
      async (): Promise<GetUserResult> => ({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    ),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}));
vi.mock('server-only', () => ({}));

// Redirect() in route handlers normally throws NEXT_REDIRECT. We catch that
// mode-switch via the real `next/navigation` module, but stub it so the test
// can assert a 302 without a running Next runtime.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${url};302;`, url });
  },
}));

const { GET } = await import('@/app/api/transactions/export/route');

beforeEach(() => {
  supabaseMock.from.mockReset();
  supabaseMock.auth.getUser.mockReset();
  supabaseMock.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
});

const THREE_ROWS: Row[] = [
  {
    occurred_at: '2026-04-20T07:00:00.000Z',
    kind: 'expense',
    amount: 150000,
    note: 'trưa',
    category: { name: 'Ăn uống' },
  },
  {
    occurred_at: '2026-04-21T02:00:00.000Z',
    kind: 'income',
    amount: 20000000,
    note: null,
    category: { name: 'Lương' },
  },
  {
    occurred_at: '2026-04-22T12:00:00.000Z',
    kind: 'expense',
    amount: 50000,
    note: 'cà phê, sữa đá',
    category: { name: 'Ăn uống' },
  },
];

function makeRequest(search = ''): Request {
  return new Request(`http://localhost/api/transactions/export${search}`);
}

describe('GET /api/transactions/export', () => {
  it('returns 200 with BOM + header + one line per matching row', async () => {
    supabaseMock.from.mockReturnValue(makeBuilder(THREE_ROWS));

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/csv/);
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="transactions-\d{8}\.csv"$/,
    );

    // The BOM is a wire-format concern: read bytes, not the decoded string
    // (Response.text() strips U+FEFF during UTF-8 decoding).
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    const lines = body.replace(/^﻿/, '').trim().split('\n');
    expect(lines[0]).toBe('date,type,category,amount,note');
    expect(lines).toHaveLength(4);

    // Quoted field with embedded comma must survive the round trip.
    expect(lines.some((l) => l.includes('"cà phê, sữa đá"'))).toBe(true);
  });

  it('returns 409 NOTHING_TO_EXPORT when no rows match', async () => {
    supabaseMock.from.mockReturnValue(makeBuilder([]));

    const res = await GET(makeRequest());

    expect(res.status).toBe(409);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NOTHING_TO_EXPORT');
  });

  it('redirects unauthenticated callers to /login', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    // When the route calls `redirect('/login')` our stub throws with a
    // `NEXT_REDIRECT` digest that Next understands. We surface that here.
    await expect(GET(makeRequest())).rejects.toMatchObject({
      message: 'NEXT_REDIRECT',
      url: '/login',
    });
  });

  it('returns 400 VALIDATION for malformed filter params', async () => {
    supabaseMock.from.mockReturnValue(makeBuilder(THREE_ROWS));

    const res = await GET(makeRequest('?from=2026-05-01&to=2026-04-01'));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION');
  });
});
