import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountNav, DemoBanner, FindOrdersByPhone, OrderRows } from "@/components/account/account-ui";
import { getSessionUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { loadCustomerOrders } from "./load";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteInfo(); // the current store's own name
  return pageMetadata({
    title: `My Orders | ${name}`,
    description: "Your order history and delivery status.",
    path: "/account/orders",
    noindex: true,
  });
}

export default async function OrdersPage() {
  const heading = (
    <h1 className="font-display text-3xl font-bold sm:text-4xl">
      My <span className="gradient-text">orders</span>
    </h1>
  );
  if (!isDatabaseConfigured) {
    return (
      <div className="space-y-6">
        {heading}
        <AccountNav />
        <DemoBanner />
        <section className="card p-5 sm:p-6" aria-label="Find my orders">
          <FindOrdersByPhone />
        </section>
      </div>
    );
  }
  const user = await getSessionUser();
  if (!user) redirect("/account/login?next=/account/orders");
  const orders = await loadCustomerOrders(user.id);
  return (
    <div className="space-y-6">
      {heading}
      <AccountNav />
      <section className="card p-5 sm:p-6" aria-label="Order history">
        {orders.length ? (
          <OrderRows
            orders={orders.map((o) => ({
              orderNumber: o.orderNumber,
              createdAt: o.createdAt,
              status: o.status,
              total: o.total,
              itemsLabel: o.items.map((i) => i.name).join(", ").slice(0, 80),
            }))}
          />
        ) : (
          <p className="text-sm text-muted">
            You haven&apos;t placed any orders yet.{" "}
            <Link href="/shop" className="font-semibold text-violet-300">
              Browse products
            </Link>
          </p>
        )}
      </section>
      <section className="card p-5 sm:p-6" aria-labelledby="other-orders">
        <h2 id="other-orders" className="font-display text-lg font-bold">
          Ordered without signing in?
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Orders placed with your confirmed email appear above automatically. For others, we can send the order numbers to the phone used at checkout.
        </p>
        <FindOrdersByPhone />
      </section>
    </div>
  );
}
