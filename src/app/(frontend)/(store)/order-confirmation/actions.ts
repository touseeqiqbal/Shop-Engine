"use server";
import { cookies } from "next/headers";
import { isCmsConfigured } from "@/lib/db/config";
import { getUserByEmailCms, linkOrderToCustomerCms, requestPasswordResetCms } from "@/lib/cms/sales";
import { isEmailConfigured } from "@/lib/mailer";
import { log } from "@/lib/log";
import { LAST_ORDER_COOKIE, cookieMatchesOrder } from "@/lib/order-cookie";
import { ORDER_NUMBER_RE } from "@/lib/order-number";
import { rateLimit } from "@/lib/rate-limit";
import { getOrderByNumber } from "@/lib/repo/orders";

/** signIn / register: show a "Sign in" / "Create an account" link after the message. */
export type CreateAccountResult = { ok: boolean; message: string; signIn?: boolean; register?: boolean };

/** "a••••@gmail.com" – shows which inbox to check without printing the whole address. */
const mask = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, (_, a: string, d: string) => `${a}••••${d}`);

/**
 * Thank-you page → "Create your account" (like Shopify): the order already made a customer record for its email;
 * this emails a link to set a password. Opening it proves the inbox is theirs and turns the record (with every order
 * placed with that email) into their account. Only the device that placed the order can ask (signed order cookie).
 */
export async function createAccountFromOrder(orderNumber: string): Promise<CreateAccountResult> {
  const n = String(orderNumber ?? "").trim().toUpperCase();
  if (!ORDER_NUMBER_RE.test(n) || !isCmsConfigured) return { ok: false, register: true, message: "This didn't work here – you can still create your account:" };
  // the browser only remembers its LATEST order (for 7 days) – e.g. after a second order the first page can't do this
  if (!cookieMatchesOrder((await cookies()).get(LAST_ORDER_COOKIE)?.value, n))
    return { ok: false, register: true, message: "This button only works for the latest order placed in this browser. Create your account with the same email instead – your orders will appear in it:" };
  if (!(await rateLimit("account-from-order", 5, 30 * 60_000))) return { ok: false, message: "Already sent – please check your inbox (and spam folder)." };

  const order = await getOrderByNumber(n).catch(() => null);
  const email = order?.customer.email?.trim().toLowerCase();
  if (!order || !email) return { ok: false, register: true, message: "This order has no email address – create your account here:" };

  try {
    // normally done right after checkout already – makes sure the customer record exists
    await linkOrderToCustomerCms(order.orderNumber, { email, name: order.customer.name, phone: order.customer.phone });
    const user = await getUserByEmailCms(email);
    if (!user) return { ok: false, message: "We couldn't set up your account just now. Please try again in a minute." };
    // (never say what kind of account it is)
    if (user.role !== "customer") return { ok: true, signIn: true, message: "You already have an account with this email – sign in to see this order. Forgot the password? Use “Forgot password” on the sign-in page." };
    if (user.hasAccount && !user.emailVerified)
      return { ok: true, signIn: true, message: "There's already an account with this email that hasn't been confirmed yet. Sign in and confirm the email (or use “Forgot password”) – this order then appears in it." };
    if (user.hasAccount) return { ok: true, signIn: true, message: "You already have an account with this email – sign in to see this order. Forgot the password? Use “Forgot password” on the sign-in page." };
    if (!isEmailConfigured()) return { ok: false, message: "We can't send emails right now – please message us on WhatsApp and we'll set up your account." };
    await requestPasswordResetCms(email);
    return { ok: true, message: `We've emailed ${mask(email)} a link to set your password. Open it to finish – this order and your future orders will be in your account.` };
  } catch (e) {
    log.error("account.from_order_failed", e, { order: n });
    return { ok: false, message: "We couldn't send the email just now. Please try again in a few minutes." };
  }
}
