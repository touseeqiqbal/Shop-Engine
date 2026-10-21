"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { Tr } from "@/components/providers/preferences";
import { useMoney, useStoreLocale } from "@/components/providers/locale";
import { CITY_KEY, freeDeliveryAbove, type DeliveryInfo } from "@/lib/cities";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";

export function CartDrawer({ delivery }: { delivery: DeliveryInfo }) {
  const { lines, drawerOpen, closeDrawer, setQty, remove } = useCart();
  const money = useMoney();
  const pk = useStoreLocale().country === "PK"; // "all over Pakistan" only for Pakistani stores
  const cod = delivery.cod.enabled; // Cash on Delivery is only promised while the store offers it
  const panel = useRef<HTMLElement>(null);
  useFocusTrap(panel, drawerOpen);
  // the city picked on a product page (shipping zones can have their own free-delivery amount)
  const [city, setCity] = useState("");
  useEffect(() => {
    if (!drawerOpen) return;
    try {
      setCity(localStorage.getItem(CITY_KEY) ?? "");
    } catch {}
  }, [drawerOpen]);
  const subtotal = cartSubtotal(lines);
  const freeAbove = freeDeliveryAbove(city, delivery); // 0 = no free delivery
  const remaining = Math.max(0, freeAbove - subtotal);
  const progress = freeAbove > 0 ? Math.min(100, (subtotal / freeAbove) * 100) : 0;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[56] flex w-full max-w-md flex-col border-l border-border bg-bg-elevated shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ShoppingBag className="size-5 text-violet-400" aria-hidden="true" />
                <Tr k="cart" /> <span className="text-sm font-medium text-muted">({cartCount(lines)})</span>
              </h2>
              <button type="button" onClick={closeDrawer} className="btn btn-ghost btn-icon" aria-label="Close cart">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="grid size-20 place-items-center rounded-full bg-surface-strong">
                  <ShoppingBag className="size-9 text-muted" aria-hidden="true" />
                </div>
                <p className="text-lg font-semibold"><Tr k="emptyCart" /></p>
                <p className="text-sm text-muted">Browse laptops and accessories – {pk ? (cod ? "Cash on Delivery all over Pakistan" : "delivery all over Pakistan") : "fast delivery nationwide"}.</p>
                <Link href="/shop" onClick={closeDrawer} className="btn btn-primary">
                  <Tr k="continueShopping" />
                </Link>
              </div>
            ) : (
              <>
                {freeAbove > 0 && (
                  <div className="border-b border-border px-5 py-3">
                    <p className="flex items-center gap-2 text-sm">
                      <Truck className="size-4 text-emerald-400" aria-hidden="true" />
                      {remaining > 0 ? (
                        <span>
                          Add <strong>{money(remaining)}</strong> more for <strong className="text-emerald-400">FREE delivery</strong>
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-400">You&apos;ve unlocked FREE delivery!</span>
                      )}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong" role="progressbar" aria-label="Progress to free delivery" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                      <motion.div className="h-full bg-brand-gradient" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
                <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
                  <AnimatePresence initial={false}>
                    {lines.map((l) => (
                      <motion.li
                        key={l.key}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0 }}
                        className="flex gap-3 py-4"
                      >
                        <Link href={l.url} onClick={closeDrawer} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-surface">
                          {l.image ? (
                            <Image src={l.image} alt={l.name} fill sizes="80px" className="object-contain p-1.5" />
                          ) : (
                            <ShoppingBag className="absolute inset-0 m-auto size-7 text-subtle" aria-hidden="true" />
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={l.url} onClick={closeDrawer} className="line-clamp-2 text-sm font-medium hover:underline">
                            {l.name}
                          </Link>
                          {l.upgrades.length > 0 && (
                            <p className="mt-0.5 text-xs text-violet-300">+ {l.upgrades.map((u) => u.label).join(", ")}</p>
                          )}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {/* same limits as the cart page's stepper: not below 1 (the bin removes), not above the stock */}
                            <div className="flex items-center rounded-full border border-border-strong" role="group" aria-label={`Quantity of ${l.name}`}>
                              <button type="button" onClick={() => setQty(l.key, l.qty - 1)} disabled={l.qty <= 1} className="grid size-8 place-items-center rounded-full disabled:opacity-40" aria-label={`Decrease quantity of ${l.name}`}>
                                <Minus className="size-3.5" aria-hidden="true" />
                              </button>
                              <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
                                {l.qty}
                              </span>
                              <button type="button" onClick={() => setQty(l.key, l.qty + 1)} disabled={l.qty >= Math.min(Math.max(l.stock, 1), MAX_QTY_PER_ITEM)} className="grid size-8 place-items-center rounded-full disabled:opacity-40" aria-label={`Increase quantity of ${l.name}`}>
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">{money(l.unitPrice * l.qty)}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => remove(l.key)} className="self-start p-1 text-subtle hover:text-rose-400" aria-label={`Remove ${l.name}`}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="space-y-3 border-t border-border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <div className="flex items-center justify-between text-base">
                    <span className="text-muted"><Tr k="subtotal" /></span>
                    <span className="font-display text-xl font-bold tabular-nums">{money(subtotal)}</span>
                  </div>
                  <p className="text-xs text-muted">Delivery calculated at checkout{cod ? " · Cash on Delivery available" : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/cart" onClick={closeDrawer} className="btn btn-secondary">
                      <Tr k="viewCart" />
                    </Link>
                    <Link href="/checkout" onClick={closeDrawer} className="btn btn-primary">
                      <Tr k="checkout" />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
