/**
 * Pure CSV primitives for the US3 export route handler.
 *
 * Kept free of Supabase/Next imports so it stays trivially unit-testable
 * and (if ever needed) reusable in a worker or edge function.
 *
 * Encoding policy (RFC 4180 + Vietnamese Excel):
 *  - UTF-8 with BOM so `Microsoft Excel` on Windows detects Unicode.
 *  - Quote only when a field contains `,`, `"`, or `\n`. Embedded `"` doubled.
 *  - Fixed column order matches the HTTP contract:
 *    `date,type,category,amount,note`.
 */

export const UTF8_BOM = '﻿';
export const CSV_HEADER = 'date,type,category,amount,note';

export interface CsvRow {
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  note: string | null;
}

export function encodeRow(row: CsvRow): string {
  return [
    escape(row.date),
    row.type,
    escape(row.category),
    String(row.amount),
    escape(row.note ?? ''),
  ].join(',');
}

function escape(field: string): string {
  if (field === '') return '';
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
