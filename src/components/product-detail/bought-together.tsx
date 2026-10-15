"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Plus, ShoppingBag } from "lucide-react";
import type { CatalogProduct } from "@/lib/types";
import { cn, effectivePrice } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { useUi } from "@/store/ui";
import { trackEvent } from "@/components/analytics";
import { useMoney } from "@/components/providers/locale";
import { AnimatedPrice } from "./animated-price";

/**
 * "Frequently bought together". The cart stores catalog prices per item, so the bundle discount is shown here
 * and applied by our team when the order is confirmed (keeps the useCart API unchanged).
 */
export function BoughtTogether({
  product,
  addons,
  discountPercent = 0,
}: {
  product: CatalogProduct;
  addons: CatalogProduct[];
  discountPercent?: number;
}) {
  const items = [product, ...addons];
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((p) => [p.id, p.stock > 0]))
  );
  const add = useCart((s) => s.add);
  const toast = useUi((s) => s.toast);
  const money = useMoney();

  const selected = items.filter((p) => picked[p.id] && p.stock > 0);
  const subtotal = selected.reduce((s, p) => s + effectivePrice(p), 0);
  const qualifies = discountPercent > 0 && selected.length >= 2 && selected.some((p) => p.id === product.id);
  const total = qualifies ? money.round(subtotal * (1 - discountPercent / 100)) : subtotal;

  const addSelected = () => {
    if (!selected.length) return;
    selected.forEach((p, i) => add(p, { qty: 1, openDrawer: i === selected.length - 1 }));
    trackEvent("add_to_cart", {
      currency: money.currency,
      value: total,
      bundle: true,
      items: selected.map((p) => ({ item_id: p.sku, item_name: p.name, price: effectivePrice(p), quantity: 1 })),
    });
    if (qualifies) toast(`Bundle added – ${discountPercent}% off applied when we confirm your order`, "success");
  };

  return (
    <div className="card relative overflow-hidden p-4 sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-600/15 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-center">
        <ul className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
          {items.map((p, i) => {
            const on = !!picked[p.id] && p.stock > 0;
            const isMain = p.id === product.id;
            return (
              <li key={p.id} className="flex flex-col items-stretch sm:flex-1 sm:flex-row sm:items-stretch">
                {i > 0 && (
                  <span className="mx-auto my-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-strong text-muted sm:mx-2 sm:my-0 sm:self-center" aria-hidden="true">
                    <Plus className="size-4" />
                  </span>
                )}
                <label
                  className={cn(
                    "relative flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border p-2.5 transition sm:flex-col sm:items-stretch sm:p-3",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500",
                    on ? "border-violet-500/50 bg-violet-500/[0.07]" : "border-border opacity-60 hover:opacity-90",
                    p.stock <= 0 && "cursor-not-allowed"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={p.stock <= 0}
                    onChange={(e) => setPicked((s) => ({ ...s, [p.id]: e.target.checked }))}
                    aria-label={`${isMain ? "This item: " : ""}${p.name} – ${money(effectivePrice(p))}`}
                  />
                  <span
                    className={cn(
                      "absolute left-2 top-2 z-[1] grid size-6 place-items-center rounded-full border transition",
                      on ? "border-transparent bg-brand-gradient text-white" : "border-border-strong bg-bg"
                    )}
                    aria-hidden="true"
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-white/[0.06] to-transparent sm:w-full light:from-slate-100">
                    <Image src={p.images[0]} alt={p.name} fill sizes="(min-width: 640px) 160px, 80px" className="object-contain p-2" />
                  </span>
                  <span className="min-w-0 sm:mt-2">
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-fg">
                      {isMain ? <span className="text-violet-300 light:text-violet-700">This item: </span> : null}
                      {p.name}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold tabular-nums text-fg">{money(effectivePrice(p))}</span>
                    {!isMain && (
                      <Link href={p.url} className="relative z-[2] text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
                        View details
                      </Link>
                    )}
                    {p.stock <= 0 && <span className="block text-xs text-rose-400">Out of stock</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="rounded-3xl border border-border bg-bg-elevated/70 p-5">
          <p className="text-sm text-muted">
            Total for {selected.length} item{selected.length === 1 ? "" : "s"}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2" aria-live="polite">
            <AnimatedPrice value={total} className="font-display text-3xl font-bold text-fg" />
            {qualifies && <s className="text-sm tabular-nums text-subtle">{money(subtotal)}</s>}
          </div>
          {discountPercent > 0 && (
            <p className={cn("chip mt-3", qualifies ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "text-muted")}>
              Save {discountPercent}% when bought together
            </p>
          )}
          <button type="button" onClick={addSelected} disabled={!selected.length} className="btn btn-primary btn-lg mt-4 w-full">
            <ShoppingBag className="size-5" aria-hidden="true" />
            Add selected to cart
          </button>
          {discountPercent > 0 && (
            <p className="mt-2.5 text-xs leading-relaxed text-subtle">
              Bundle discount is applied at order confirmation – our team adjusts your invoice when we call to confirm.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
