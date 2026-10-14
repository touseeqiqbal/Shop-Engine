import { getSessionUser, getUserProfile } from "@/lib/auth";
import { rateLimitKey } from "@/lib/rate-limit";
import { getCurrentStore } from "@/lib/tenant";
import { loadCustomerOrders } from "../orders/load";

export const dynamic = "force-dynamic";

/**
 * GET /account/data-export – "Download my data": the signed-in customer's profile, saved addresses, wishlist and their
 * orders at this store, as a JSON file (a copy of the personal data the shop holds about them).
 */
export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimitKey(`data-export:${user.id}`, 5, 60 * 60_000)) return Response.json({ error: "Please wait a while before downloading again." }, { status: 429 });
  const [profile, orders, store] = await Promise.all([getUserProfile(user.id), loadCustomerOrders(user.id).catch(() => []), getCurrentStore().catch(() => null)]);
  const data = {
    exportedAt: new Date().toISOString(),
    store: store ? { name: store.name } : null,
    profile: profile ? { email: profile.email, name: profile.name ?? null, phone: profile.phone ?? null, emailVerified: profile.emailVerified } : null,
    addresses: profile?.addresses ?? [],
    wishlist: profile?.wishlist ?? [],
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      placedAt: o.createdAt,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      customer: o.customer,
      items: o.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, upgrades: i.upgrades.map((u) => u.label) })),
      subtotal: o.subtotal,
      discount: o.discount,
      deliveryCharge: o.deliveryCharge,
      total: o.total,
      notes: o.notes ?? null,
      marketingConsent: o.marketingConsent === true,
    })),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
