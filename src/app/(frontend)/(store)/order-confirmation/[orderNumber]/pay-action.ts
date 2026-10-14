"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LAST_ORDER_COOKIE, cookieMatchesOrder } from "@/lib/order-cookie";
import { getOrderByNumber } from "@/lib/repo/orders";
import { isCmsConfigured } from "@/lib/db/config";

/**
 * "Pay now" on the thank-you page of a card order still waiting for its payment: back to the payment provider's page
 * (the same one – it is never charged twice). Only for the browser that placed the order, or its signed-in owner.
 */
export async function payNow(orderNumber: string): Promise<void> {
  if (!isCmsConfigured) return;
  const [order, jar, user] = await Promise.all([getOrderByNumber(orderNumber), cookies(), getSessionUser().catch(() => null)]);
  const allowed = !!order && (cookieMatchesOrder(jar.get(LAST_ORDER_COOKIE)?.value, order.orderNumber) || (!!user && !!order.userId && order.userId === user.id));
  const back = `/order-confirmation/${encodeURIComponent(orderNumber)}`;
  if (!order || !allowed || order.status !== "awaiting-payment") redirect(back);
  const [{ openCheckoutUrl }, { payloadClient }] = await Promise.all([import("@/lib/payments"), import("@/lib/cms/catalog-source")]);
  const url = await openCheckoutUrl(await payloadClient(), Number(order.id)).catch(() => null);
  redirect(url ?? `${back}?payment=expired`);
}
