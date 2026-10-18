/**
 * A shop sign-in made before the account's last password change / reset is over (a stolen session ends there).
 * `signedInAt`: seconds, from the token's `authTime` (src/auth.ts) – 0 for tokens older than that claim, which count as
 * made before. Auth.js renews a token's `iat` on every refresh, so `iat` can't be used for this.
 */
export function sessionStillValid(signedInAt: number | undefined, sessionsValidAfter: string | null | undefined): boolean {
  if (!sessionsValidAfter) return true;
  return (signedInAt ?? 0) * 1000 + 999 >= Date.parse(sessionsValidAfter);
}
