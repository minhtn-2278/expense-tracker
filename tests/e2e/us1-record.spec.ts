import { test, expect } from '@playwright/test';

/**
 * US1 MVP smoke test — the independent-test criterion from
 * specs/001-expense-tracker/spec.md User Story 1.
 *
 * Walks: register → land on /transactions → create income → create expense
 * → edit expense → delete expense → logout → log back in → income remains.
 *
 * Preconditions:
 *   - `supabase start` running.
 *   - `.env.local` populated so the dev server boots.
 *   - Dev server started by Playwright's webServer config (npm run dev).
 *
 * Each run uses a fresh email so the test does not collide with prior data.
 * Run `supabase db reset` before the test batch if you want to clean up.
 */

const uniq = () => `alice+${Date.now()}@local.test`;

test('US1 — register, record transactions, edit, delete, re-login, data intact', async ({
  page,
}) => {
  const email = uniq();
  const password = 'password123';

  // ── Register ────────────────────────────────────────────────────────────
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText(/Chưa có giao dịch nào/)).toBeVisible();

  // ── Create income transaction ───────────────────────────────────────────
  await page.getByRole('link', { name: '+ Thêm giao dịch' }).click();
  await page.getByLabel('Thu', { exact: true }).check();
  await page.getByLabel('Số tiền').fill('20000000');
  // Default category for income is 'Lương' — pick the first option.
  await page.getByLabel('Danh mục').selectOption({ index: 0 });
  await page.getByRole('button', { name: 'Tạo giao dịch' }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText(/\+ 20\.000\.000/)).toBeVisible();

  // ── Create expense transaction ──────────────────────────────────────────
  await page.getByRole('link', { name: '+ Thêm giao dịch' }).click();
  await page.getByLabel('Chi', { exact: true }).check();
  await page.getByLabel('Số tiền').fill('150000');
  await page.getByLabel('Danh mục').selectOption({ index: 0 });
  await page.getByRole('button', { name: 'Tạo giao dịch' }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText(/− 150\.000/)).toBeVisible();

  // ── Edit the expense: change amount to 200 000 ──────────────────────────
  await page.getByRole('link', { name: 'Sửa' }).first().click();
  const amountInput = page.getByLabel('Số tiền');
  await amountInput.fill('200000');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText(/− 200\.000/)).toBeVisible();

  // ── Delete the expense (edit page has Xoá button) ───────────────────────
  await page.getByRole('link', { name: 'Sửa' }).first().click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Xoá' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText(/− 200\.000/)).toHaveCount(0);

  // ── Logout ──────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // ── Log back in — income must still be there ────────────────────────────
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText(/\+ 20\.000\.000/)).toBeVisible();
});
