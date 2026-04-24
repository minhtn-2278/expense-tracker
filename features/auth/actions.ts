'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/lib/utils/errors';
import { RegisterInput, LoginInput } from './schemas';

/**
 * Auth Server Actions receive `FormData`, not a plain object.
 *
 * Why: Next.js's dev server and error stack traces serialise Server Action
 * arguments. A plain `{ email, password }` object gets rendered verbatim
 * into the terminal when the action throws or when HMR echoes a request.
 * `FormData` renders as `FormData {}` without field contents, so the
 * password never appears in a dev-time log line. Combined with the
 * try/catch wrappers below (which guarantee the actions never reject),
 * nothing in this file should ever leak the password to logs.
 *
 * Constitution: Principle IV + "Secrets in logs" in Development Workflow.
 */

function extractFields(
  fd: FormData,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    const v = fd.get(key);
    if (v !== null) out[key] = v;
  }
  return out;
}

export async function registerAction(
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const parsed = RegisterInput.safeParse(extractFields(formData, ['email', 'password']));
  if (!parsed.success) {
    return fail(
      'VALIDATION',
      'Dữ liệu không hợp lệ.',
      parsed.error.flatten().fieldErrors,
    );
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        return fail('EMAIL_TAKEN', 'Email này đã được sử dụng.');
      }
      if (msg.includes('password')) {
        return fail('WEAK_PASSWORD', 'Mật khẩu chưa đủ mạnh.');
      }
      return fail('UNKNOWN', 'Không thể đăng ký. Vui lòng thử lại.');
    }

    revalidatePath('/', 'layout');
    return ok({ email });
  } catch {
    // Swallow the thrown error. We must not re-throw: an unhandled rejection
    // from a Server Action causes Next.js to log the call arguments, and
    // even with FormData we do not want stack traces pointing at the call.
    return fail('UNKNOWN', 'Không thể đăng ký. Vui lòng thử lại.');
  }
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = LoginInput.safeParse(extractFields(formData, ['email', 'password']));
  if (!parsed.success) {
    return fail(
      'VALIDATION',
      'Dữ liệu không hợp lệ.',
      parsed.error.flatten().fieldErrors,
    );
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return fail('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
    }

    revalidatePath('/', 'layout');
    return ok();
  } catch {
    return fail('UNKNOWN', 'Không thể đăng nhập. Vui lòng thử lại.');
  }
}

/**
 * Terminate the current session and send the user back to /login.
 * Takes no arguments so there is nothing to log on any code path.
 */
export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if signOut throws, proceed with the redirect. The session cookie
    // is cleared server-side by @supabase/ssr before signOut rejects in
    // almost every known failure mode.
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
