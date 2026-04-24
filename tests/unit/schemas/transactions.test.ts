import { describe, it, expect } from 'vitest';
import { TransactionInput, TransactionFilters } from '@/features/transactions/schemas';

// RFC 4122 v4 UUID: the 3rd segment starts with '4' and the 4th with 8/9/a/b.
// Zod 4's z.string().uuid() enforces this strictly.
const validBase = {
  kind: 'expense' as const,
  amount: 150000,
  occurredAt: '2026-04-23T10:00:00.000Z',
  categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('TransactionInput', () => {
  it('accepts a well-formed expense', () => {
    expect(TransactionInput.safeParse(validBase).success).toBe(true);
  });

  it('rejects zero amount', () => {
    expect(TransactionInput.safeParse({ ...validBase, amount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(TransactionInput.safeParse({ ...validBase, amount: -1 }).success).toBe(false);
  });

  it('rejects fractional amount (VND is zero-decimal)', () => {
    expect(TransactionInput.safeParse({ ...validBase, amount: 1.5 }).success).toBe(false);
  });

  it('rejects a non-UUID category id', () => {
    expect(
      TransactionInput.safeParse({ ...validBase, categoryId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects a note longer than 500 chars', () => {
    expect(
      TransactionInput.safeParse({ ...validBase, note: 'a'.repeat(501) }).success,
    ).toBe(false);
  });

  it('treats empty-string note as absent', () => {
    const result = TransactionInput.safeParse({ ...validBase, note: '' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.note).toBeUndefined();
  });
});

describe('TransactionFilters', () => {
  it('defaults page to 1', () => {
    const result = TransactionFilters.safeParse({});
    expect(result.success).toBe(true);
    expect(result.success && result.data.page).toBe(1);
  });

  it('rejects from > to', () => {
    const result = TransactionFilters.safeParse({ from: '2026-05-01', to: '2026-04-01' });
    expect(result.success).toBe(false);
  });

  it('rejects amountMin > amountMax', () => {
    const result = TransactionFilters.safeParse({ amountMin: 1000, amountMax: 500 });
    expect(result.success).toBe(false);
  });
});
