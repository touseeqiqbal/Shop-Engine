/**
 * A database error inside an open transaction aborts it (Postgres): every later statement fails, and COMMIT quietly
 * rolls the whole save back – the caller would see "saved" while nothing was. Side jobs that are allowed to fail (a
 * notification, a webhook event) catch their errors – but a DATABASE error inside a transaction must go on up, so the
 * save fails visibly instead.
 */

/** A Postgres error (a 5-character SQLSTATE code) – also when wrapped (`cause`). */
export function isDatabaseError(e: unknown): boolean {
  let x: unknown = e;
  for (let i = 0; x && i < 5; i++) {
    const code = (x as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return true;
    x = (x as { cause?: unknown }).cause;
  }
  return false;
}

/** In a catch block of a side job: rethrows when the error has aborted the caller's transaction. */
export function rethrowIfAborted(e: unknown, req?: { transactionID?: unknown } | null): void {
  if (req?.transactionID && isDatabaseError(e)) throw e;
}
