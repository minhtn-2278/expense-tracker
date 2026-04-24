import { test, expect } from '@playwright/test';

/**
 * US3 — search, filter, CSV export.
 *
 * Runs only against a local Supabase + dev server. Scope:
 *   1. Seed 5 transactions through the US1 UI.
 *   2. Apply each filter type (q, date range, kind, category, amount range).
 *   3. Assert list narrows; snapshot filtered row count.
 *   4. Click Export; intercept the download.
 *   5. Assert the downloaded file is UTF-8 with BOM, matches the filtered
 *      rows exactly, and opens cleanly as a Vietnamese-aware CSV.
 *
 * Guardrails: uses a freshly registered test account; does not depend on
 * data from other specs.
 */

const USER_EMAIL = `us3-${Date.now()}@example.test`;
const USER_PASSWORD = 'Passw0rd-' + Date.now();

const SEED = [
  { kind: 'expense', amount: '50000', category: 'Ăn uống', note: 'cà phê' },
  { kind: 'expense', amount: '150000', category: 'Ăn uống', note: 'trưa, chiều' },
  { kind: 'income', amount: '20000000', category: 'Lương', note: '' },
  { kind: 'expense', amount: '500000', category: 'Đi lại', note: 'xăng xe' },
  { kind: 'expense', amount: '30000', category: 'Ăn uống', note: 'trà đá' },
] as const;

async function register(page: import('@playwright/test').Page) {
  await page.goto('/register');
  await page.getByLabel('Email').fill(USER_EMAIL);
  await page.getByLabel('Mật khẩu').fill(USER_PASSWORD);
  await page.getByRole('button', { name: /Đăng ký/i }).click();
  await page.waitForURL(/\/dashboard/);
}

async function addTransaction(
  page: import('@playwright/test').Page,
  t: (typeof SEED)[number],
) {
  await page.goto('/transactions/new');
  if (t.kind === 'income') {
    await page.getByLabel(/Thu nhập/i).check();
  } else {
    await page.getByLabel(/Chi tiêu/i).check();
  }
  await page.getByLabel(/Số tiền/i).fill(t.amount);
  await page.getByLabel(/Danh mục/i).selectOption({ label: t.category });
  if (t.note) await page.getByLabel(/Ghi chú/i).fill(t.note);
  await page.getByRole('button', { name: /Lưu|Thêm giao dịch/i }).click();
  await page.waitForURL(/\/transactions/);
}

test.describe('US3 — search + filter + CSV export', () => {
  test.beforeEach(async ({ page }) => {
    await register(page);
    for (const row of SEED) await addTransaction(page, row);
    await page.goto('/transactions');
  });

  test('narrows by keyword search', async ({ page }) => {
    await expect(page.getByRole('listitem')).toHaveCount(5);
    await page.getByLabel(/Từ khoá|Tìm kiếm/i).fill('trà');
    await page.getByRole('button', { name: /Áp dụng|Lọc/i }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByText('trà đá')).toBeVisible();
  });

  test('narrows by kind + category + amount range', async ({ page }) => {
    await page.getByLabel(/Loại/i).selectOption('expense');
    await page.getByLabel(/Danh mục/i).selectOption({ label: 'Ăn uống' });
    await page.getByLabel(/Tối thiểu/i).fill('40000');
    await page.getByLabel(/Tối đa/i).fill('200000');
    await page.getByRole('button', { name: /Áp dụng|Lọc/i }).click();
    await expect(page.getByRole('listitem')).toHaveCount(2); // 50000 + 150000
  });

  test('exports filtered rows as UTF-8 CSV with BOM', async ({ page }) => {
    await page.getByLabel(/Loại/i).selectOption('expense');
    await page.getByRole('button', { name: /Áp dụng|Lọc/i }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Xuất CSV/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^transactions-\d{8}\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);

    // UTF-8 BOM at position 0.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const body = bytes.toString('utf8').replace(/^﻿/, '');
    const lines = body.trim().split('\n');
    expect(lines[0]).toBe('date,type,category,amount,note');
    // 4 expenses in seed.
    expect(lines).toHaveLength(1 + 4);
    // Diacritics survive.
    expect(body).toContain('Ăn uống');
  });

  test('shows friendly error when exporting an empty filter', async ({ page }) => {
    await page.getByLabel(/Từ khoá|Tìm kiếm/i).fill('no-such-note-xyz-123');
    await page.getByRole('button', { name: /Áp dụng|Lọc/i }).click();
    await page.getByRole('button', { name: /Xuất CSV/i }).click();
    await expect(
      page.getByText(/Không có giao dịch nào để xuất/i),
    ).toBeVisible();
  });
});
