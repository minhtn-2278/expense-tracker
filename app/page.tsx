import { redirect } from 'next/navigation';
import { getServerSession } from '@/features/auth/session';

export default async function HomePage() {
  const session = await getServerSession();
  redirect(session ? '/transactions' : '/login');
}
