import { redirect } from 'next/navigation';
import { getServerSession } from '@/features/auth/session';

/**
 * Public auth shell. If the visitor already has a session, bounce them
 * into the authenticated area so /login and /register never render over
 * a live session.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();
  if (session) redirect('/transactions');

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
