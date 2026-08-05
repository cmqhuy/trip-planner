/**
 * Helpers for reading `unknown` catch bindings.
 *
 * A `catch` binding is not guaranteed to be an `Error` — anything can be thrown —
 * so every handler that wants a message or an HTTP status has to narrow first.
 * These keep that narrowing in one place instead of at ~30 call sites.
 */

/** The message to show a user, or `fallback` when the thrown value carries none. */
export function errorMessage(err: unknown, fallback = ''): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/**
 * The numeric `status` a Drive/HTTP rejection carries, or `undefined`.
 * Drive surfaces permission problems as 403/404, which callers branch on.
 */
export function errorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}
