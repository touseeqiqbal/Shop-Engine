import { IntegrationError } from "./types";
import { PrivateAddressError, publicRequest } from "@/lib/net/public-request";

/**
 * Calls to providers: a time limit, JSON in and out, and the provider's own error message passed on (never our keys).
 */

export type HttpOptions = {
  method?: string;
  headers?: Record<string, string>;
  /** an object is sent as JSON; URLSearchParams as a form; a string as it is */
  body?: unknown;
  timeoutMs?: number;
  /** the provider's name for error messages */
  provider: string;
  /**
   * The address was typed in by the STORE ("any SMS provider" send link …), not one of ours: never to an internal
   * address (checked on the address connected to), no redirects followed.
   */
  storeSupplied?: boolean;
};

export type HttpResult<T> = { status: number; ok: boolean; data: T; headers: Headers; text: string };

export async function http<T = Record<string, unknown>>(url: string, opts: HttpOptions): Promise<HttpResult<T>> {
  const headers: Record<string, string> = { accept: "application/json", ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.body instanceof URLSearchParams) {
    body = opts.body.toString();
    headers["content-type"] ??= "application/x-www-form-urlencoded";
  } else if (typeof opts.body === "string") {
    body = opts.body;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] ??= "application/json";
  }
  let res: Response | Awaited<ReturnType<typeof publicRequest>>;
  try {
    res = opts.storeSupplied
      ? await publicRequest(url, { method: opts.method ?? (body ? "POST" : "GET"), headers, body: typeof body === "string" ? body : undefined, timeoutMs: opts.timeoutMs ?? 20_000 })
      : await fetch(url, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, redirect: "follow", signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000) });
  } catch (e) {
    if (e instanceof PrivateAddressError) throw new IntegrationError(`${opts.provider}: that address points to a private network – use the provider's public web address.`, 400);
    const timedOut = (e as Error)?.name === "TimeoutError";
    // retryable: nothing was answered – a message sent through it is tried again later (lib/notify)
    throw Object.assign(new IntegrationError(timedOut ? `${opts.provider} didn’t answer in time – please try again.` : `Couldn’t reach ${opts.provider} – please try again.`, 502), { retryable: true });
  }
  const text = typeof res.text === "string" ? res.text : await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // not JSON (some providers answer plain text or XML)
  }
  return { status: res.status, ok: res.ok, data: data as T, headers: res.headers, text };
}

/** The same, but a failed answer becomes an IntegrationError with the provider's message. */
export async function httpOk<T = Record<string, unknown>>(url: string, opts: HttpOptions & { describe?: (data: unknown) => string | null }): Promise<T> {
  const r = await http<T>(url, opts);
  if (!r.ok) throw new IntegrationError(`${opts.provider}: ${opts.describe?.(r.data) ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 || r.status === 403 ? 400 : 502);
  return r.data;
}

/** The human part of a typical provider error body. */
export function providerMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return typeof data === "string" && data.length < 300 ? data : null;
  const d = data as Record<string, unknown>;
  const pick = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
  const nested = (v: unknown) => (v && typeof v === "object" ? pick((v as Record<string, unknown>).message) ?? pick((v as Record<string, unknown>).description) ?? pick((v as Record<string, unknown>).detail) : null);
  if (Array.isArray(d.errors) && d.errors.length) return nested(d.errors[0]) ?? pick(d.errors[0]);
  return pick(d.message) ?? pick(d.error_description) ?? nested(d.error) ?? pick(d.error) ?? pick(d.detail) ?? pick(d.title) ?? pick(d.statusMessage) ?? null;
}

/** Amount in the currency's smallest unit (cents, paisa); 0-decimal currencies stay whole. */
export function toMinorUnits(amount: number, currency: string): number {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
  return Math.round(amount * 10 ** digits);
}
export function fromMinorUnits(amount: number, currency: string): number {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
  return amount / 10 ** digits;
}

/** "Rs 1,250.50" style money in a provider's request: always 2 decimals, dot. */
export const decimal = (n: number, digits = 2) => (Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits);
