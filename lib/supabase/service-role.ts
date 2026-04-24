import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Service-role Supabase client — BYPASSES ROW-LEVEL SECURITY.
 *
 * USE WITH EXTREME CARE. This client authenticates with the
 * SUPABASE_SERVICE_ROLE_KEY, which grants full admin access to the database.
 *
 * Guard-rails:
 *   - `import "server-only"` above causes the Next.js build to fail if this
 *     module is ever imported (transitively) from a "use client" boundary.
 *   - The service role key is read from a non-NEXT_PUBLIC_ env var; it
 *     cannot reach the browser bundle.
 *
 * You should basically never need this in v1. It exists so that admin
 * scripts (account deletion, migrations, seed helpers) have a documented
 * entry point that cannot be accidentally smuggled into client code.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
