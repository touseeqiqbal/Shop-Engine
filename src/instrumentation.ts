import type { Instrumentation } from "next";

/**
 * Runs once when the server starts (Next.js instrumentation hook).
 * - Error monitoring (Sentry) when SENTRY_DSN is set.
 * - Housekeeping timer (auto-cancel unconfirmed COD orders, …) on the Node.js server only –
 *   never during `next build`, never without a database, and not when HOUSEKEEPING=off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Missing secrets stop the server; config problems are logged (see lib/startup-checks.ts)
  if (process.env.NEXT_PHASE !== "phase-production-build") (await import("./lib/startup-checks")).runStartupChecks();

  if (process.env.SENTRY_DSN) {
    const [Sentry, { sentryEnvironment }] = await Promise.all([import("@sentry/nextjs"), import("./lib/monitoring")]);
    // performance tracing is off unless SENTRY_TRACES_SAMPLE_RATE is set (e.g. 0.1 = one request in ten)
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: sentryEnvironment(), tracesSampleRate: Math.min(1, Math.max(0, Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0)) });
  }

  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.HOUSEKEEPING === "off") return;
  if (!process.env.DATABASE_URL) return;

  const minutes = Math.max(1, Number(process.env.HOUSEKEEPING_MINUTES) || 5);
  // Run the chores through this server's own /api/cron route so they get a normal request context
  // (cached settings, revalidation and notifications don't work outside a request).
  process.env.HOUSEKEEPING_INTERNAL_KEY ??= Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  const port = process.env.PORT || "3000";
  const tick = async (reason: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron?reason=${reason}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.HOUSEKEEPING_INTERNAL_KEY}` },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) (await import("./lib/log")).log.warn("housekeeping.cron_status", { status: res.status });
    } catch (e) {
      (await import("./lib/log")).log.error("housekeeping.failed", e);
    }
  };
  // first run a minute after start-up (lets the server warm up), then every few minutes
  setTimeout(() => void tick("startup"), 60_000).unref?.();
  setInterval(() => void tick("timer"), minutes * 60_000).unref?.();
}

/** Every server-side error (pages, server actions, route handlers, /cms) → Sentry, tagged storefront / checkout / admin. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!process.env.SENTRY_DSN) return;
  const [Sentry, { areaOf }] = await Promise.all([import("@sentry/nextjs"), import("./lib/monitoring")]);
  Sentry.withScope((scope) => {
    scope.setTag("area", areaOf(request.path));
    scope.setTag("route", context.routePath);
    Sentry.captureRequestError(err, request, context);
  });
};
