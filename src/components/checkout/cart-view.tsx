"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { ArrowRight, Lock, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck, Wallet } from "lucide-react";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { useHydrated } from "@/hooks/use-hydrated";
import { deliveryEstimate, freeDeliveryAbove } from "@/lib/cities";
import { orderTotals } from "@/lib/order-totals";
import { waLink } from "@/lib/site";
import { useSiteInfo } from "@/components/providers/site-info";
import { primaryPhone } from "@/lib/site-info";
import type { StoreSettings } from "@/lib/types";
import { formatPKR } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { CityCombobox } from "./city-combobox";
import { CouponBox } from "./coupon-box";
import { useCartCoupon, useCartSync } from "./use-coupon";
import { FreeDeliveryBar } from "./free-delivery-bar";

export function CartView({ settings }: { settings: StoreSettings }) {
  const hydrated = useHydrated();
  const { lines, setQty, remove } = useCart();
  const coupon = useCartCoupon(hydrated);
  const syncNotice = useCartSync(hydrated);
  const [city, setCity] = useState("");
  const site = useSiteInfo(); // live business profile (/cms → Settings → Store details)

  if (!hydrated) return <CartSkeleton />;

  if (lines.length === 0) {
    return (
      <div className="card mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="grid size-24 place-items-center rounded-full bg-surface-strong ring-1 ring-violet-500/30">
          <ShoppingBag className="size-10 text-violet-300" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold">Your cart is empty</h2>
        <p className="max-w-sm text-sm text-muted">
          Explore new, used & refurbished laptops and accessories – Cash on Delivery all over Pakistan.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/shop" className="btn btn-primary">
            Start shopping <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/account/wishlist" className="btn btn-secondary">
            View wishlist
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = cartSubtotal(lines);
  const totals = orderTotals({ subtotal, discount: coupon.discount, city, method: "", settings, freeShipping: coupon.freeShipping });
  const { discount, delivery } = totals;
  // free-delivery amount for the chosen city's zone (0 = that zone never ships free)
  const freeAbove = city ? freeDeliveryAbove(city, settings) : settings.freeDeliveryThreshold;
  const total = totals.total;
  const eta = city ? deliveryEstimate(city, settings) : null;

  const waText = [
    `Hi ${site.name}, I'd like to order:`,
    ...lines.map(
      (l, i) =>
        `${i + 1}. ${l.name}${l.upgrades.length ? ` (+ ${l.upgrades.map((u) => u.label).join(", ")})` : ""} × ${l.qty} – ${formatPKR(l.unitPrice * l.qty)}\n   ${site.url}${l.url}`
    ),
    `Subtotal: ${formatPKR(subtotal)}`,
    discount && coupon.code ? `Coupon ${coupon.code}: −${formatPKR(discount)}` : "",
    city ? `City: ${city} (delivery ${delivery ? formatPKR(delivery) : "FREE"})` : "",
    `Total: ${formatPKR(total)}${city ? "" : " + delivery"}`,
    "Name:",
    "Address:",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start xl:gap-8">
      <section aria-labelledby="cart-items-heading" className="space-y-4">
        <h2 id="cart-items-heading" className="sr-only">
          Items in your cart
        </h2>
        {syncNotice && (
          <p role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {syncNotice}
          </p>
        )}
        {freeAbove > 0 && <FreeDeliveryBar subtotal={subtotal} threshold={freeAbove} where={city || null} className="card p-4" />}
        <ul className="card divide-y divide-border">
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.li
                key={l.key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40, height: 0, paddingTop: 0, paddingBottom: 0 }}
                className="flex gap-3 overflow-hidden p-4 sm:gap-5 sm:p-5"
              >
                <Link href={l.url} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-surface-strong sm:size-28">
                  {l.image ? (
                    <Image src={l.image} alt={l.name} fill sizes="112px" className="object-contain p-2" />
                  ) : (
                    <ShoppingBag className="absolute inset-0 m-auto size-8 text-subtle" aria-hidden="true" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-subtle">{l.brandName}</p>
                      <Link href={l.url} className="line-clamp-2 font-semibold leading-snug hover:underline">
                        {l.name}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(l.key)}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label={`Remove ${l.name} from cart`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  {l.upgrades.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Selected upgrades">
                      {l.upgrades.map((u) => (
                        <li key={u.id} className="chip border-violet-500/30 bg-violet-500/10 text-[11px] text-violet-200">
                          {u.label} <span className="text-violet-300/80">+{formatPKR(u.price)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <QtyStepper name={l.name} qty={l.qty} max={Math.max(l.stock, 1)} onChange={(q) => setQty(l.key, q)} />
                    <div className="text-right">
                      <p className="font-display text-lg font-bold tabular-nums">{formatPKR(l.unitPrice * l.qty)}</p>
                      {l.qty > 1 && <p className="text-xs text-muted tabular-nums">{formatPKR(l.unitPrice)} each</p>}
                    </div>
                  </div>
                  {l.stock > 0 && l.stock <= 3 && <p className="mt-1 text-xs font-medium text-amber-400">Only {l.stock} left in stock</p>}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
          ← Continue shopping
        </Link>
      </section>

      <aside aria-labelledby="cart-summary-heading" className="lg:sticky lg:top-24">
        <div className="card space-y-5 p-5 sm:p-6">
          <h2 id="cart-summary-heading" className="font-display text-lg font-bold">
            Order summary
          </h2>
          <CouponBox coupon={coupon} />
          <div>
            <CityCombobox value={city} onChange={setCity} name="estimate-city" label="Estimate delivery to" placeholder="Choose your city" />
            {eta && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted" aria-live="polite">
                <Truck className="size-4 text-emerald-400" aria-hidden="true" />
                Delivery to {city}: <strong className="text-fg">{eta.label}</strong>
              </p>
            )}
          </div>
          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal ({cartCount(lines)} items)</dt>
              <dd className="tabular-nums">{formatPKR(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <dt>Coupon ({coupon.code})</dt>
                <dd className="tabular-nums">− {formatPKR(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular-nums">
                {delivery === null ? <span className="text-muted">Select city</span> : delivery === 0 ? <span className="font-semibold text-emerald-400">FREE</span> : formatPKR(delivery)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{formatPKR(total)}</dd>
            </div>
          </dl>
          <div className="space-y-2.5">
            <Link href="/checkout" className="btn btn-primary btn-lg w-full">
              <Lock className="size-4" aria-hidden="true" /> Proceed to checkout
            </Link>
            <a href={waLink(primaryPhone(site).wa, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
              <WhatsAppIcon className="size-5" /> Order on WhatsApp instead
            </a>
          </div>
          <ul className="grid gap-2 text-xs text-muted">
            <li className="flex items-center gap-2">
              <Wallet className="size-4 text-violet-300" aria-hidden="true" /> Cash on Delivery all over Pakistan
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-violet-300" aria-hidden="true" /> Checked & tested · warranty on every product
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-violet-300" aria-hidden="true" />{" "}
              {settings.freeDeliveryThreshold > 0 ? `Free delivery above ${formatPKR(settings.freeDeliveryThreshold)}${settings.zones?.length ? " (most cities)" : ""}` : "Fast delivery all over Pakistan"}
            </li>
          </ul>
        </div>
      </aside>

      {/* Mobile sticky checkout bar – sits above the 64px bottom nav */}
      <div className="glass fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-x-0 px-4 py-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Total</p>
          <p className="font-display text-lg font-bold tabular-nums">{formatPKR(total)}</p>
        </div>
        <Link href="/checkout" className="btn btn-primary">
          Checkout <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  );
}

export function QtyStepper({ name, qty, max, onChange }: { name: string; qty: number; max: number; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center rounded-full border border-border-strong bg-surface" role="group" aria-label={`Quantity of ${name}`}>
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        disabled={qty <= 1}
        className="grid size-10 place-items-center rounded-full disabled:opacity-40"
        aria-label={`Decrease quantity of ${name}`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= max}
        className="grid size-10 place-items-center rounded-full disabled:opacity-40"
        aria-label={`Increase quantity of ${name}`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]" aria-busy="true" aria-label="Loading cart">
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-3xl" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="card flex gap-4 p-5">
            <Skeleton className="size-24 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}
