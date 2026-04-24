import { describe, it, expect } from 'vitest';
import { cleanSearchParams } from '@/lib/utils/search-params';

/**
 * Regression shield for the bug where the transactions page filter parse
 * collapsed entirely because native <form method="GET"> submits empty strings
 * for untouched inputs, and `z.string().date()` / `z.coerce.number()` /
 * `z.enum(...)` all reject `""`. Symptom: URL applied but list + filter bar
 * defaults both reverted to empty. Fix: strip empty-string and empty-array
 * entries before Zod sees them.
 */

describe('cleanSearchParams', () => {
  it('keeps non-empty single values untouched', () => {
    expect(cleanSearchParams({ q: 'cafe', kind: 'income' })).toEqual({
      q: 'cafe',
      kind: 'income',
    });
  });

  it('drops keys whose value is an empty string', () => {
    expect(
      cleanSearchParams({ q: 'cafe', from: '', to: '', kind: '', amountMin: '' }),
    ).toEqual({ q: 'cafe' });
  });

  it('keeps non-empty array entries and drops empty-string array members', () => {
    expect(
      cleanSearchParams({
        categoryIds: ['uuid-1', '', 'uuid-2'],
      }),
    ).toEqual({ categoryIds: ['uuid-1', 'uuid-2'] });
  });

  it('drops array keys that become empty after filtering', () => {
    expect(cleanSearchParams({ categoryIds: ['', ''] })).toEqual({});
  });

  it('drops keys whose value is `undefined` (Next can pass this for missing keys)', () => {
    expect(cleanSearchParams({ q: undefined, kind: 'income' })).toEqual({
      kind: 'income',
    });
  });

  it('preserves Vietnamese text verbatim', () => {
    expect(cleanSearchParams({ q: 'Ăn uống' })).toEqual({ q: 'Ăn uống' });
  });

  it('coerces a single-value string into an array for declared array keys', () => {
    expect(
      cleanSearchParams(
        { categoryIds: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        ['categoryIds'],
      ),
    ).toEqual({ categoryIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] });
  });

  it('leaves array values alone for declared array keys', () => {
    expect(
      cleanSearchParams(
        { categoryIds: ['uuid-1', 'uuid-2'] },
        ['categoryIds'],
      ),
    ).toEqual({ categoryIds: ['uuid-1', 'uuid-2'] });
  });

  it('drops declared array keys when the value is an empty string', () => {
    expect(cleanSearchParams({ categoryIds: '' }, ['categoryIds'])).toEqual({});
  });
});
