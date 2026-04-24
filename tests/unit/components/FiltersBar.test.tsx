import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltersBar } from '@/features/transactions/components/FiltersBar';

/**
 * Regression shield for the bug where search/kind/category/amount filters did
 * not narrow the transactions list (only date-range did). Root cause: the
 * previous implementation called `router.push(...)` inside a JS submit handler,
 * which — paired with Next's router cache — did not always re-render the
 * server page for same-path navigations. Export CSV worked because it hit the
 * route handler directly.
 *
 * The fix: a native `<form method="GET" action="/transactions">` with a
 * `name` on every control. Browser navigation guarantees the server page
 * re-renders with the new searchParams.
 *
 * These tests lock the contract:
 *   1. The form natively submits GET to /transactions.
 *   2. Every filter control has a `name` matching `TransactionFilters`.
 *   3. `defaults` seed the controls so round-tripping preserves state.
 */

const EMPTY_CATEGORIES = { income: [], expense: [] };

describe('<FiltersBar />', () => {
  it('renders a native GET form targeting /transactions', () => {
    const { container } = render(
      <FiltersBar categories={EMPTY_CATEGORIES} defaults={{}} />,
    );
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form!.method.toLowerCase()).toBe('get');
    // jsdom resolves `action` to an absolute URL; check the pathname.
    expect(new URL(form!.action).pathname).toBe('/transactions');
  });

  it('names every filter control so native submission serializes them', () => {
    const { container } = render(
      <FiltersBar categories={EMPTY_CATEGORIES} defaults={{}} />,
    );
    for (const name of ['q', 'from', 'to', 'kind', 'amountMin', 'amountMax', 'categoryIds']) {
      expect(
        container.querySelector(`[name="${name}"]`),
        `expected a control with name="${name}"`,
      ).not.toBeNull();
    }
  });

  it('seeds controls from `defaults` so the current URL state is reflected', () => {
    render(
      <FiltersBar
        categories={EMPTY_CATEGORIES}
        defaults={{
          q: 'cà phê',
          kind: 'income',
          from: '2026-04-20',
          to: '2026-04-27',
          amountMin: '40000',
          amountMax: '200000',
        }}
      />,
    );
    expect(screen.getByLabelText(/Từ khoá/i)).toHaveValue('cà phê');
    expect(screen.getByLabelText(/Loại/i)).toHaveValue('income');
    expect(screen.getByLabelText(/Tối thiểu/i)).toHaveValue(40000);
    expect(screen.getByLabelText(/Tối đa/i)).toHaveValue(200000);
  });

  it('offers a reset that navigates to /transactions with no params', () => {
    const { container } = render(
      <FiltersBar categories={EMPTY_CATEGORIES} defaults={{ q: 'cà phê' }} />,
    );
    const reset = container.querySelector<HTMLAnchorElement>(
      'a[href="/transactions"]',
    );
    expect(reset).not.toBeNull();
  });

  it('does not mix `selected` on <option> with `defaultValue` on <select> (React warning)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <FiltersBar
          categories={{
            income: [
              { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: 'u', kind: 'income', name: 'Lương', archived: false, created_at: '', updated_at: '' },
            ],
            expense: [
              { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: 'u', kind: 'expense', name: 'Ăn uống', archived: false, created_at: '', updated_at: '' },
            ],
          }}
          defaults={{ categoryIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] }}
        />,
      );
      const called = spy.mock.calls.some((args) =>
        args.some(
          (a) =>
            typeof a === 'string' &&
            a.includes('Use the `defaultValue` or `value` props on <select>'),
        ),
      );
      expect(called).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('serializes a full-fledged GET submission via FormData', () => {
    const { container } = render(
      <FiltersBar
        categories={EMPTY_CATEGORIES}
        defaults={{ q: 'cà phê', kind: 'expense', amountMin: '40000' }}
      />,
    );
    const form = container.querySelector('form')!;
    // Prevent jsdom from attempting actual navigation on submit.
    form.addEventListener('submit', (e) => e.preventDefault());
    fireEvent.submit(form);

    const fd = new FormData(form);
    expect(fd.get('q')).toBe('cà phê');
    expect(fd.get('kind')).toBe('expense');
    expect(fd.get('amountMin')).toBe('40000');
  });
});
