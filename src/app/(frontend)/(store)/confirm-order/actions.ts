"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cancelByCustomer, confirmOrder } from "@/lib/cms/confirm";
import { LAST_ORDER_COOKIE, cookieMatchesOrder } from "@/lib/order-cookie";
import { rateLimit } from "@/lib/rate-limit";

/** Confirm / cancel from the link in WhatsApp, SMS or email. */
export async function confirmByLink(token: string) {
  if (!(await rateLimit("confirm-link", 20, 10 * 60_000))) redirect(`/confirm-order/${token}?e=busy`);
  const r = await confirmOrder({ token }, "link");
  redirect(`/confirm-order/${token}${r.ok ? "" : `?e=${r.reason}`}`);
}

export async function cancelByLink(token: string) {
  if (!(await rateLimit("confirm-link", 20, 10 * 60_000))) redirect(`/confirm-order/${token}?e=busy`);
  await cancelByCustomer(token);
  redirect(`/confirm-order/${token}`);
}

export type CodeState = { ok?: boolean; message?: string; ts?: number };

/** The 6-digit code typed on the thank-you page. Only works on the device that placed the order. */
export async function confirmByCode(orderNumber: string, _prev: CodeState, fd: FormData): Promise<CodeState> {
  const ts = Date.now();
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, message: "Enter the 6-digit code from the message we sent you.", ts };
  const jar = await cookies();
  if (!cookieMatchesOrder(jar.get(LAST_ORDER_COOKIE)?.value, orderNumber)) return { ok: false, message: "Please use the link in the message we sent you.", ts };
  if (!(await rateLimit("confirm-code", 6, 10 * 60_000))) return { ok: false, message: "Too many tries. Please wait 10 minutes or use the link in the message.", ts };
  const r = await confirmOrder({ orderNumber, code }, "code");
  if (r.ok) return { ok: true, message: "Thank you – your order is confirmed and will be packed soon.", ts };
  const messages: Record<string, string> = {
    "wrong-code": "That code isn't right. Check the message and try again.",
    "too-many": "Too many wrong codes. Please use the link in the message we sent you, or WhatsApp us.",
    expired: "The time to confirm has passed and the order was cancelled. Please order again or WhatsApp us.",
    "not-waiting": "This order doesn't need confirming any more.",
    "not-found": "Order not found.",
  };
  return { ok: false, message: messages[r.reason] ?? "Something went wrong.", ts };
}
