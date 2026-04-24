import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Auth action regression suite.
 *
 * Two properties both tests below pin down:
 *   (A) The action accepts `FormData`. This keeps the password out of the
 *       JS object payload that Next.js would otherwise serialize into
 *       dev-server logs and stack traces on an unhandled rejection.
 *   (B) The action never throws — even when the underlying Supabase SDK
 *       rejects. A throwing Server Action causes Next to log the call
 *       arguments; with (A) those are FormData, but we still want belt-
 *       and-braces so stack traces stay clean.
 *
 * If either property regresses, the returned `ActionResult` type leaks a
 * password into the server's log stream.
 */

const supabaseMock = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('server-only', () => ({}));

const { registerAction, loginAction } = await import('@/features/auth/actions');

const PASSWORD = 'supersecret123';

function makeFormData(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return fd;
}

beforeEach(() => {
  supabaseMock.auth.signUp.mockReset();
  supabaseMock.auth.signInWithPassword.mockReset();
});

describe('registerAction', () => {
  it('accepts FormData and returns ok on a successful signup', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: {}, error: null });

    const result = await registerAction(makeFormData('a@b.test', PASSWORD));
    expect(result.ok).toBe(true);
    // The password must never appear anywhere inside the returned payload.
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });

  it('returns UNKNOWN instead of throwing when Supabase rejects', async () => {
    supabaseMock.auth.signUp.mockRejectedValue(new Error('network boom'));

    const result = await registerAction(makeFormData('a@b.test', PASSWORD));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('UNKNOWN');
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });

  it('returns VALIDATION without calling Supabase when the email is malformed', async () => {
    const result = await registerAction(makeFormData('not-an-email', PASSWORD));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('VALIDATION');
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });
});

describe('loginAction', () => {
  it('accepts FormData and returns ok on successful login', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    const result = await loginAction(makeFormData('a@b.test', PASSWORD));
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });

  it('returns UNKNOWN instead of throwing when Supabase rejects', async () => {
    supabaseMock.auth.signInWithPassword.mockRejectedValue(new Error('network boom'));

    const result = await loginAction(makeFormData('a@b.test', PASSWORD));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('UNKNOWN');
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });

  it('returns INVALID_CREDENTIALS (not password-specific) on Supabase auth failure', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const result = await loginAction(makeFormData('a@b.test', PASSWORD));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('INVALID_CREDENTIALS');
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });
});
