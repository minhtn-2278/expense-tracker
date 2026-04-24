import { createClient } from '@/lib/supabase/server';

export interface ServerSession {
  userId: string;
  email: string;
}

/**
 * Returns the current authenticated user (verified against Supabase Auth)
 * or `null` if no valid session. Safe to call from Server Components,
 * Server Actions, and Route Handlers.
 *
 * `supabase.auth.getUser()` makes a network call to GoTrue to validate
 * the JWT; prefer it over `getSession()` for anything security-sensitive.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  if (!user.email) return null;

  return { userId: user.id, email: user.email };
}
