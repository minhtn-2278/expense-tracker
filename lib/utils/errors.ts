/**
 * ActionResult — the discriminated-union shape returned by every Server
 * Action. Callers pattern-match on `ok` and never throw for expected
 * errors.
 *
 * `code` is a stable machine key used by tests and logs; `message` is the
 * Vietnamese copy shown to users. `fieldErrors` is the per-field map
 * produced by Zod's flatten on validation failures.
 *
 * Shape mirrors contracts/auth.actions.md and contracts/transactions.actions.md.
 */

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T>;
export function ok(): ActionResult<void>;
export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data: data as T };
}

export function fail(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error: { code, message, fieldErrors } };
}
