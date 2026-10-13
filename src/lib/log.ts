/**
 * Structured logs: one JSON line per event, so Railway's log search (and any log tool) can filter by event,
 * order number, level… Phone numbers and emails are masked. Errors also go to Sentry when it's set up.
 *
 *   log.info("order.placed", { order: "UTS-…", total: 1500 })
 *   log.error("courier.book_failed", err, { order })
 */

type Fields = Record<string, unknown>;

const mask = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  if (/^[^@\s]+@[^@\s]+$/.test(v)) return v.replace(/^(.).*(@.*)$/, "$1***$2");
  const d = v.replace(/\D/g, "");
  if (d.length >= 10 && d.length <= 13 && /^[+\d\s-]+$/.test(v)) return `***${d.slice(-4)}`;
  return v;
};
const SENSITIVE = /phone|email|mobile/i;

function clean(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) out[k] = SENSITIVE.test(k) ? mask(v) : v;
  return out;
}

function write(level: "info" | "warn" | "error", event: string, fields: Fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...clean(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields: Fields = {}) => write("info", event, fields),
  warn: (event: string, fields: Fields = {}) => write("warn", event, fields),
  error: (event: string, err: unknown, fields: Fields = {}) => {
    const e = err instanceof Error ? err : new Error(String(err));
    write("error", event, { ...fields, error: e.message, stack: e.stack?.split("\n").slice(0, 4).join(" | ") });
    void import("./monitoring").then((m) => m.captureError(e, { event, ...clean(fields) })).catch(() => undefined);
  },
};
