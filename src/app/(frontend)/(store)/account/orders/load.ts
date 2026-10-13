import "server-only";
import { getUserProfile } from "@/lib/auth";
import { listOrdersByEmail, listOrdersByUser } from "@/lib/repo/orders";
import type { Order } from "@/lib/types";

/**
 * Orders placed while signed in, plus guest orders placed with the account's email once that email is confirmed.
 * (Not by phone: nobody checks that the phone number on an account belongs to its owner.)
 */
export async function loadCustomerOrders(userId: string): Promise<Order[]> {
  const profile = await getUserProfile(userId).catch(() => null);
  const [byUser, byEmail] = await Promise.all([
    listOrdersByUser(userId).catch(() => [] as Order[]),
    profile?.emailVerified ? listOrdersByEmail(profile.email).catch(() => [] as Order[]) : Promise.resolve([] as Order[]),
  ]);
  const map = new Map<string, Order>();
  for (const o of [...byUser, ...byEmail]) map.set(o.id, o);
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * One order for the person looking at it: the signed-in customer's own order (same rules as the list above), or –
 * without an account – the order this device placed (the signed order cookie set at checkout). Otherwise null.
 */
export async function loadViewableOrder(orderNumber: string): Promise<{ order: Order; signedIn: boolean } | null> {
  const n = orderNumber.trim().toUpperCase();
  const { getSessionUser } = await import("@/lib/auth");
  const user = await getSessionUser().catch(() => null);
  if (user && user.role === "customer") {
    const order = (await loadCustomerOrders(user.id)).find((o) => o.orderNumber.toUpperCase() === n);
    if (order) return { order, signedIn: true };
  }
  const [{ cookies }, { LAST_ORDER_COOKIE, cookieMatchesOrder }, { getOrderByNumber }] = await Promise.all([import("next/headers"), import("@/lib/order-cookie"), import("@/lib/repo/orders")]);
  if (!cookieMatchesOrder((await cookies()).get(LAST_ORDER_COOKIE)?.value, n)) return null;
  const order = await getOrderByNumber(n).catch(() => null);
  return order ? { order, signedIn: false } : null;
}
