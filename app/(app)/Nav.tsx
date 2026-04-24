'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

const NAV: readonly NavItem[] = [
  { href: '/transactions', label: 'Giao dịch' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/categories', label: 'Danh mục' },
];

const ACTIVE =
  'font-semibold text-zinc-900 dark:text-zinc-100';
const INACTIVE =
  'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';

export function Nav() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex items-center gap-4 text-sm">
      {NAV.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? ACTIVE : INACTIVE}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
