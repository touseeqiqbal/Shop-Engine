import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, LogOut, MapPin, Package, Truck } from "lucide-react";
import { AccountNav, DemoBanner, FindOrdersByPhone, OrderRows } from "@/components/account/account-ui";
import { ConfirmEmailNotice } from "@/components/account/auth-forms";
import { getSessionUser, getUserProfile } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { loadCustomerOrders } from "./orders/load";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "My Account | Urko Tech Store",
  description: "Your Urko Tech Store account – orders, saved addresses and wishlist.",
  path: "/account",
  noindex: true,
});

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  if (!isDatabaseConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          My <span className="gradient-text">account</span>
        </h1>
        <AccountNav />
        <DemoBanner />
        <section className="card p-5 sm:p-6" aria-labelledby="find-orders">
          <h2 id="find-orders" className="font-display text-lg font-bold">
            Find my orders
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">Enter the mobile number you used at checkout.</p>
          <FindOrdersByPhone />
        </section>
        <QuickLinks />
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/account/login?next=/account");
  const [profile, orders] = await Promise.all([getUserProfile(user.id).catch(() => null), loadCustomerOrders(user.id)]);
  const name = profile?.name || user.name || user.email.split("@")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Hi, <span className="gradient-text">{name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-secondary btn-sm">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>
      <AccountNav />
      {reset && (
        <p role="status" className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Your new password is saved and you&apos;re signed in.
        </p>
      )}
      {profile?.emailVerified === false && profile.role === "customer" && <ConfirmEmailNotice email={profile.email} />}
      <section className="card p-5 sm:p-6" aria-labelledby="recent-orders">
        <div className="flex items-center justify-between">
          <h2 id="recent-orders" className="font-display text-lg font-bold">
            Recent orders
          </h2>
          {orders.length > 3 && (
            <Link href="/account/orders" className="text-sm font-semibold text-violet-300 hover:text-violet-200">
              View all
            </Link>
          )}
        </div>
        {orders.length ? (
          <OrderRows
            orders={orders.slice(0, 3).map((o) => ({
              orderNumber: o.orderNumber,
              createdAt: o.createdAt,
              status: o.status,
              total: o.total,
              itemsLabel: `${o.items.reduce((n, i) => n + i.qty, 0)} item(s)`,
            }))}
          />
        ) : (
          <p className="mt-3 text-sm text-muted">
            No orders yet.{" "}
            <Link href="/shop" className="font-semibold text-violet-300">
              Start shopping
            </Link>
          </p>
        )}
      </section>
      <QuickLinks />
    </div>
  );
}

function QuickLinks() {
  const items = [
    { href: "/account/orders", icon: Package, title: "Orders", desc: "History & status" },
    { href: "/account/addresses", icon: MapPin, title: "Addresses", desc: "Faster checkout" },
    { href: "/account/wishlist", icon: Heart, title: "Wishlist", desc: "Saved products" },
    { href: "/track-order", icon: Truck, title: "Track order", desc: "Live courier status" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ href, icon: Icon, title, desc }) => (
        <li key={href}>
          <Link href={href} className="card glow-hover flex h-full flex-col gap-2 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold">{title}</span>
            <span className="text-xs text-muted">{desc}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
