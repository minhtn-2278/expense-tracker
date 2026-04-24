import { describe, it, expect } from 'vitest';
import { CSV_HEADER, UTF8_BOM, encodeRow } from '@/features/transactions/csv';

describe('CSV_HEADER', () => {
  it('matches the contract — date,type,category,amount,note', () => {
    expect(CSV_HEADER).toBe('date,type,category,amount,note');
  });
});

describe('UTF8_BOM', () => {
  it('is the single BOM character (U+FEFF)', () => {
    expect(UTF8_BOM).toBe('﻿');
    expect(UTF8_BOM).toHaveLength(1);
  });
});

describe('encodeRow', () => {
  const base = {
    date: '2026-04-23',
    type: 'expense' as const,
    category: 'Ăn uống',
    amount: 150000,
    note: '',
  };

  it('emits plain fields without quoting when no special chars present', () => {
    expect(encodeRow({ ...base, note: 'trưa' })).toBe(
      '2026-04-23,expense,Ăn uống,150000,trưa',
    );
  });

  it('preserves Vietnamese diacritics verbatim (no URL/HTML encoding)', () => {
    const row = encodeRow({ ...base, category: 'Ăn uống', note: 'Cà phê sữa đá' });
    expect(row).toContain('Ăn uống');
    expect(row).toContain('Cà phê sữa đá');
  });

  it('quotes and escapes fields containing a comma', () => {
    expect(encodeRow({ ...base, note: 'trưa, chiều' })).toBe(
      '2026-04-23,expense,Ăn uống,150000,"trưa, chiều"',
    );
  });

  it('quotes and doubles embedded double quotes (RFC 4180)', () => {
    expect(encodeRow({ ...base, note: 'nói "hi"' })).toBe(
      '2026-04-23,expense,Ăn uống,150000,"nói ""hi"""',
    );
  });

  it('quotes fields containing a newline', () => {
    expect(encodeRow({ ...base, note: 'dòng 1\ndòng 2' })).toBe(
      '2026-04-23,expense,Ăn uống,150000,"dòng 1\ndòng 2"',
    );
  });

  it('emits an empty note as an empty trailing field (unquoted)', () => {
    expect(encodeRow({ ...base, note: '' })).toBe(
      '2026-04-23,expense,Ăn uống,150000,',
    );
  });

  it('treats null note identically to an empty string', () => {
    expect(encodeRow({ ...base, note: null })).toBe(
      '2026-04-23,expense,Ăn uống,150000,',
    );
  });

  it('amount is emitted as an integer without thousand separators', () => {
    expect(encodeRow({ ...base, amount: 1500000 })).toContain(',1500000,');
  });

  it('quotes a category name containing a comma', () => {
    expect(
      encodeRow({ ...base, category: 'Ăn, uống', note: 'x' }),
    ).toBe('2026-04-23,expense,"Ăn, uống",150000,x');
  });
});
