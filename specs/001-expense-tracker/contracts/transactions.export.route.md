# Contract: CSV Export Route Handler

**Path**: `GET /api/transactions/export`
**Module**: `app/api/transactions/export/route.ts`
Satisfies FR-022, FR-023, FR-024 and SC-006.

## Auth

Requires an authenticated session. Route handler calls
`supabase.auth.getUser()`; `null` user → `302 → /login`.

## Query params

Accepts exactly the same filter params as the transactions list, parsed with
the shared `TransactionFilters` Zod schema from
[`transactions.actions.md`](./transactions.actions.md) — minus `page`
(export always covers all matching rows, capped at 10k to satisfy SC-006).

Invalid params → `400` with a JSON body `{ error: { code: 'VALIDATION', fieldErrors } }`.

## Empty-result behaviour (FR-024)

If the filtered query would return zero rows, the handler responds **`409
Conflict`** with JSON body
`{ error: { code: 'NOTHING_TO_EXPORT', message: 'Không có giao dịch nào để xuất.' } }`
and **does not** emit a CSV file. The client-side `ExportCsvButton` renders this
message inline.

## Response

On success:

- Status: `200 OK`
- Headers:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="transactions-YYYYMMDD.csv"`
    where the date is the current user-local date.
  - `Cache-Control: no-store`
- Body: UTF-8 with BOM (`﻿`), then the lines below.

### Column order and header row

```
date,type,category,amount,note
```

- `date` — ISO `YYYY-MM-DD` in the user's timezone.
- `type` — `income` or `expense` (English stable keys; the UI displays
  Vietnamese translations but the CSV is for downstream tools).
- `category` — the Vietnamese category `name` at the moment of export.
- `amount` — integer VND, no thousand separators.
- `note` — as stored; RFC 4180 quoted when it contains `,`, `"`, or newline.

## Streaming

The handler returns a `ReadableStream`. Implementation sketch:

```ts
export async function GET(req: NextRequest) {
  const filters = TransactionFilters.omit({ page: true }).parse(searchParamsFrom(req));
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const iterator = streamMatchingTransactions(supabase, filters);          // AsyncIterable
  const first = await iterator[Symbol.asyncIterator]().next();
  if (first.done) return nothingToExport();                                // 409

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('﻿' + 'date,type,category,amount,note\n'));
      controller.enqueue(encoder.encode(encodeRow(first.value) + '\n'));
      for await (const row of iterator) controller.enqueue(encoder.encode(encodeRow(row) + '\n'));
      controller.close();
    },
  });

  return new Response(body, { headers: exportHeaders() });
}
```

## Error handling

- Unauthenticated → `302 → /login`.
- Validation → `400` (see above).
- Empty result → `409` (see above).
- Internal error mid-stream → the stream is closed with an error; the client
  sees a truncated download and surfaces a toast. This case is expected to be
  rare; logs include a request id but never the filter values (they could
  contain `q` with personal text).
