/**
 * Error monitoring (Sentry). Off until SENTRY_DSN is set – then every server error (pages, server actions,
 * API routes, /cms, Payload hooks) and every error logged with log.error() is reported, tagged with the area
 * (storefront / checkout / admin) so alerts can be routed. Set the alert rules in Sentry (e.g. email on new issue).
 *
 *   SENTRY_DSN               server DSN
 *   NEXT_PUBLIC_SENTRY_DSN   browser DSN (usually the same value)
 *   SENTRY_ENVIRONMENT       production / staging (defaults from STAGING)
 */

export const sentryEnabled = () => Boolean(process.env.SENTRY_DSN);
export const sentryEnvironment = () => process.env.SENTRY_ENVIRONMENT || (process.env.STAGING === "true" ? "staging" : process.env.NODE_ENV === "production" ? "production" : "development");

/** Area of the site a URL belongs to – used as a Sentry tag. */
export function areaOf(path: string) {
  if (path.startsWith("/cms") || path.startsWith("/cms-api")) return "admin";
  if (path.startsWith("/checkout") || path.startsWith("/order-confirmation") || path.startsWith("/confirm-order")) return "checkout";
  if (path.startsWith("/api")) return "api";
  return "storefront";
}

export async function captureError(err: unknown, context: Record<string, unknown> = {}) {
  if (!sentryEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
      if (typeof context.event === "string") scope.setTag("event", context.event);
      Sentry.captureException(err);
    });
  } catch {
    /* monitoring must never break the app */
  }
}
