import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/**
 * Header nav bolds the link that matches the current pathname so the user
 * always knows which page they're on. Prefix matching — `/transactions/123`
 * still bolds "Giao dịch".
 */

const ACTIVE_CLASS = 'font-semibold';
const INACTIVE_SIGNAL = 'text-zinc-600';

function mockPathname(pathname: string) {
  vi.doMock('next/navigation', () => ({ usePathname: () => pathname }));
}

async function loadNav() {
  vi.resetModules();
  const mod = await import('@/app/(app)/Nav');
  return mod.Nav;
}

afterEach(() => {
  cleanup();
  vi.doUnmock('next/navigation');
});

describe('<Nav />', () => {
  it('bolds "Giao dịch" when on /transactions', async () => {
    mockPathname('/transactions');
    const Loaded = await loadNav();
    render(<Loaded />);
    expect(screen.getByRole('link', { name: /Giao dịch/ })).toHaveClass(ACTIVE_CLASS);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveClass(INACTIVE_SIGNAL);
    expect(screen.getByRole('link', { name: /Danh mục/ })).toHaveClass(INACTIVE_SIGNAL);
  });

  it('bolds "Dashboard" when on /dashboard', async () => {
    mockPathname('/dashboard');
    const Loaded = await loadNav();
    render(<Loaded />);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveClass(ACTIVE_CLASS);
    expect(screen.getByRole('link', { name: /Giao dịch/ })).toHaveClass(INACTIVE_SIGNAL);
  });

  it('bolds "Danh mục" when on /categories', async () => {
    mockPathname('/categories');
    const Loaded = await loadNav();
    render(<Loaded />);
    expect(screen.getByRole('link', { name: /Danh mục/ })).toHaveClass(ACTIVE_CLASS);
  });

  it('still bolds "Giao dịch" on nested paths like /transactions/new', async () => {
    mockPathname('/transactions/new');
    const Loaded = await loadNav();
    render(<Loaded />);
    expect(screen.getByRole('link', { name: /Giao dịch/ })).toHaveClass(ACTIVE_CLASS);
  });
});
