import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * httpOnly cookie set after checkout so the confirmation page (and the 6-digit confirm code) work for the buyer.
 * The value is "<order number>.<signature>": only the server can make it, so setting the cookie by hand to
 * someone else's order number doesn't open their order.
 */
export const LAST_ORDER_COOKIE = "urko_last_order";

function secret() {
  const s = process.env.AUTH_SECRET || process.env.PAYLOAD_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV !== "production") return "dev-only-order-cookie-secret";
  throw new Error("AUTH_SECRET is not set");
}

const sign = (orderNumber: string) => createHmac("sha256", secret()).update(`order-cookie:${orderNumber.toUpperCase()}`).digest("base64url");

export const orderCookieValue = (orderNumber: string) => `${orderNumber}.${sign(orderNumber)}`;

/** True when the cookie was issued by this server for this order. */
export function cookieMatchesOrder(value: string | undefined, orderNumber: string) {
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 0 || value.slice(0, dot).toUpperCase() !== orderNumber.toUpperCase()) return false;
  const want = Buffer.from(sign(orderNumber));
  const got = Buffer.from(value.slice(dot + 1));
  return want.length === got.length && timingSafeEqual(want, got);
}
