# Contract: Auth Server Actions

**Module**: `features/auth/actions.ts`
**Trust boundary**: browser → server. Every action validates input with Zod
before any side effect and maps known Supabase errors to user-safe messages.

All actions return an `ActionResult<T>`:

```ts
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };
```

## `registerAction(input)`

Satisfies FR-001, FR-002, FR-003, FR-005 (via RLS), and the clarification
"accounts are immediately usable".

**Input** (Zod schema `RegisterInput` in `features/auth/schemas.ts`):

```ts
RegisterInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/),
});
```

**Behaviour**:

1. Parse with `RegisterInput.safeParse(formData)`. On failure → return
   `{ ok: false, error: { code: 'VALIDATION', fieldErrors } }`.
2. Call `supabase.auth.signUp({ email, password })` **without** email
   confirmation (disabled in Supabase dashboard / `supabase/config.toml`).
3. On Supabase error mapping:
   - `"User already registered"` → `{ code: 'EMAIL_TAKEN', message: 'Email này đã được sử dụng.' }`
   - password policy violation (Supabase side) → `{ code: 'WEAK_PASSWORD', message: 'Mật khẩu chưa đủ mạnh.' }`
   - anything else → `{ code: 'UNKNOWN', message: 'Không thể đăng ký. Vui lòng thử lại.' }`
4. On success, the database trigger `on_auth_user_created` has already run
   inside the same transaction as `auth.users` insert — it created the
   `public.profiles` row (mirroring `auth.users.id` and `email`) and seeded
   the default Vietnamese category set. No app-code insert into `profiles`
   or `categories` is needed here. See
   [`../data-model.md §0`](../data-model.md#0-relationship-to-supabase-auth-authusers--publicprofiles)
   for the trigger body. Return `{ ok: true, data: undefined }` and let the
   client redirect to `/transactions`.

**Output on success**: `{ ok: true, data: undefined }` — the session cookie
is set by Supabase SSR before this returns.

## `loginAction(input)`

Satisfies FR-004.

**Input** (`LoginInput`):

```ts
LoginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
```

**Behaviour**:

1. Parse input.
2. Call `supabase.auth.signInWithPassword({ email, password })`.
3. On Supabase `"Invalid login credentials"` → return
   `{ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' } }`.
   The message is intentionally generic — it does not reveal whether the email
   exists (matches Edge Case "registration enumeration" handling for login
   too).
4. On success, return `{ ok: true }`; client redirects to `/transactions`.

## `logoutAction()`

Satisfies FR-004 (logout side) and FR-006 (on-logout session end).

**Input**: none.

**Behaviour**:

1. Call `supabase.auth.signOut()` (clears session cookies via `@supabase/ssr`).
2. `revalidatePath('/', 'layout')`.
3. `redirect('/login')`.

**Output**: never returns (redirects).

## Notes

- None of these three actions ever handles a `service-role` client. Signup uses
  the anon-keyed server client; the signup trigger runs inside the database
  under `security definer` and is the only code path allowed to insert into
  `profiles`.
- Session duration is configured once in `supabase/config.toml`:
  `session_refresh_rolling = true`, `session_inactivity_timeout = "720h"`
  (30 days) — satisfies FR-006.
- There are **no** `forgotPasswordAction`, `resetPasswordAction`, or
  `changePasswordAction` in v1 (per the spec clarification).
