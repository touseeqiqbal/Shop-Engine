/**
 * Browser error monitoring (storefront, checkout and /cms). Loaded only when NEXT_PUBLIC_SENTRY_DSN is set,
 * and lazily – it never delays the page.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => {
    const path = window.location.pathname;
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
      // page-load tracing only when NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE is set (e.g. 0.05)
      tracesSampleRate: Math.min(1, Math.max(0, Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0)),
      initialScope: { tags: { area: path.startsWith("/cms") ? "admin" : path.startsWith("/checkout") || path.startsWith("/order-confirmation") ? "checkout" : "storefront" } },
      ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured", /Loading chunk \d+ failed/],
    });
  });
}
