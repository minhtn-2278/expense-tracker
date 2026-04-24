/**
 * Normalise a `searchParams`-shaped object before handing it to a Zod schema.
 *
 *  1. Strip empty-string and empty-array entries.
 *     A native `<form method="GET">` submits every control even when blank,
 *     and Zod fields like `z.string().date()` / `z.coerce.number()` /
 *     `z.enum([...])` reject `""`. Without this pass a single blank field
 *     cascades into a full parse failure.
 *
 *  2. Coerce known-array keys from a single string to `[string]`.
 *     Next's App Router delivers `searchParams.categoryIds` as a bare string
 *     when there is exactly one matching value in the URL, and only as an
 *     array when there are two or more. The schema declares
 *     `categoryIds: z.array(...)` so the single-value case needs coercion.
 */
export function cleanSearchParams(
  raw: Record<string, string | string[] | undefined>,
  arrayKeys: readonly string[] = [],
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const arrayKeySet = new Set(arrayKeys);

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const kept = value.filter((v) => typeof v === 'string' && v !== '');
      if (kept.length > 0) out[key] = kept;
    } else if (typeof value === 'string' && value !== '') {
      out[key] = arrayKeySet.has(key) ? [value] : value;
    }
  }
  return out;
}
