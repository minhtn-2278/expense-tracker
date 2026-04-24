import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/features/auth/session';
import { logoutAction } from '@/features/auth/actions';

/**
 * Authentication gate for the application area. Every route under `(app)/`
 * inherits this layout, so a single call to `getServerSession()` protects
 * all of /transactions, /dashboard, and /categories without per-page
 * boilerplate.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/transactions" className="font-semibold">
              Giao dịch
            </Link>
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Dashboard
            </Link>
            <Link href="/categories" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Danh mục
            </Link>
          </nav>
          <form action={logoutAction}>
            <span className="mr-3 hidden text-xs text-zinc-500 sm:inline">{session.email}</span>
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
