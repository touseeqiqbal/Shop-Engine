"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m as motion } from "framer-motion";
import {
  Banknote, Check, GitCompareArrows, Heart, MapPin, Minus, Plus, Share2, ShieldCheck, ShoppingBag, Truck, Zap,
} from "lucide-react";
import type { CatalogProduct, UpgradeOption } from "@/lib/types";
import { cn, effectivePrice, stockLabel } from "@/lib/utils";
import { waLink } from "@/lib/site";
import { primaryPhone } from "@/lib/site-info";
import { useSiteInfo } from "@/components/providers/site-info";
import { useMoney } from "@/components/providers/locale";
import { CITY_KEY, PAKISTAN_CITIES, deliveryEstimate, freeDeliveryAbove, type DeliveryInfo } from "@/lib/cities";
import { Price } from "@/components/ui/price";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { trackEvent } from "@/components/analytics";
import { useCart } from "@/store/cart";
import { useLists } from "@/store/lists";
import { useUi } from "@/store/ui";
import { useHydrated } from "@/hooks/use-hydrated";
import { AnimatedPrice } from "./animated-price";
import { UpgradeConfigurator } from "./upgrade-configurator";
import { VariantPicker, initialPick, matchVariant } from "./variant-picker";

export function BuyBox({ product: main, delivery }: { product: CatalogProduct; delivery: DeliveryInfo }) {
  const site = useSiteInfo(); // live business profile (/cms → Settings → Store details)
  const phone = primaryPhone(site);
  const money = useMoney();
  const router = useRouter();
  const idPrefix = useId();
  const add = useCart((s) => s.add);
  const { wishlist, compare, toggleWishlist, toggleCompare } = useLists();
  const toast = useUi((s) => s.toast);
  const hydrated = useHydrated();

  // options (colour / size …): the chosen variant is what's shown and bought; ?variant=… keeps the choice in the address
  const variants = useMemo(() => main.variants ?? [], [main.variants]);
  const options = useMemo(() => main.variantOptions ?? [], [main.variantOptions]);
  const [pick, setPick] = useState<Record<string, string>>(() => initialPick(variants));
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("variant");
    if (slug && variants.some((v) => v.slug === slug)) setPick(initialPick(variants, slug));
  }, [variants]);
  const variant = variants.length ? matchVariant(variants, options, pick) : null;
  const p: CatalogProduct = variant ? { ...variant, upgrades: main.upgrades, warranty: variant.warranty || main.warranty } : main;
  const unavailable = variants.length > 0 && !variant;
  const choose = (name: string, value: string) => {
    const next = { ...pick, [name]: value };
    setPick(next);
    const v = matchVariant(variants, options, next);
    if (v) window.history.replaceState(null, "", `?variant=${encodeURIComponent(v.slug)}`);
  };

  const [selected, setSelected] = useState<Record<string, string | null>>({});
  const [qty, setQty] = useState(1);
  // Pakistani stores pick from the city list (Karachi first); elsewhere the shopper types their city
  const pk = (delivery.country ?? "PK") === "PK";
  const [city, setCity] = useState(pk ? "Karachi" : "");
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CITY_KEY);
      if (saved && (!pk || PAKISTAN_CITIES.includes(saved))) setCity(saved);
    } catch {}
  }, [pk]);

  const chosen: UpgradeOption[] = useMemo(
    () => p.upgrades.filter((u) => Object.values(selected).includes(u.id)),
    [p.upgrades, selected]
  );
  const base = effectivePrice(p);
  // to the currency's smallest unit (cents add up to float noise: 19.99 × 3)
  const unit = money.round(base + chosen.reduce((s, u) => s + u.price, 0));
  const total = money.round(unit * qty);
  const outOfStock = unavailable || p.stock <= 0;
  const maxQty = Math.max(1, Math.min(p.stock, 10));
  const stock = stockLabel(p.stock);
  // wishlist / compare keep the main product (not one colour or size)
  const wished = hydrated && wishlist.includes(main.id);
  const comparing = hydrated && compare.includes(main.id);
  const eta = deliveryEstimate(city, delivery);
  const freeAbove = freeDeliveryAbove(city, delivery); // 0 = no free delivery
  const codMax = delivery.cod.maxOrder;

  const analyticsItem = { item_id: p.sku, item_name: p.name, item_brand: p.brandName, item_category: p.categoryName, price: unit, quantity: qty };

  const addToCart = (openDrawer = true) => {
    if (outOfStock) return;
    add(p, { qty, upgrades: chosen, openDrawer });
    trackEvent("add_to_cart", { currency: money.currency, value: total, items: [analyticsItem] });
  };

  const buyNow = () => {
    if (outOfStock) return;
    addToCart(false);
    trackEvent("begin_checkout", { currency: money.currency, value: total, items: [analyticsItem] });
    router.push("/checkout");
  };

  // links on the current store's own address (not the main site's)
  const productUrl = `${site.url}${p.url}`;
  const waText = [
    `Hi ${site.name}! I'd like to order:`,
    ``,
    `*${p.name}*`,
    `SKU: ${p.sku}`,
    chosen.length ? `Upgrades: ${chosen.map((u) => `${u.group} – ${u.label}`).join(", ")}` : null,
    `Quantity: ${qty}`,
    `Price: ${money(total)}${qty > 1 ? ` (${money(unit)} each)` : ""}`,
    `Delivery city: ${city}`,
    ``,
    productUrl,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const share = async () => {
    const url = productUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, text: `${p.name} – ${money(base)} at ${site.name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard", "info");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") toast("Couldn't share – copy the link from the address bar", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Price + stock */}
      <div className="space-y-3">
        <Price price={p.price} salePrice={p.salePrice} showSave size="xl" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-semibold",
              stock.tone === "rose" ? "text-rose-400" : stock.tone === "amber" ? "text-amber-400" : "text-emerald-400"
            )}
          >
            <span className="relative flex size-2.5" aria-hidden="true">
              {!outOfStock && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
              <span className="relative inline-flex size-2.5 rounded-full bg-current" />
            </span>
            {stock.label}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <ShieldCheck className="size-4 text-violet-400" aria-hidden="true" /> {p.warranty}
          </span>
        </div>
      </div>

      {variants.length > 0 && options.length > 0 && (
        <div className="card p-4 sm:p-5">
          <VariantPicker options={options} variants={variants} pick={pick} onPick={choose} />
          <p className="mt-3 text-xs text-muted" aria-live="polite">
            {unavailable ? "This combination isn't available – choose another option." : `SKU ${p.sku}`}
          </p>
        </div>
      )}

      {p.upgrades.length > 0 && (
        <div className="card p-4 sm:p-5">
          <UpgradeConfigurator
            upgrades={p.upgrades}
            selected={selected}
            idPrefix={idPrefix}
            onChange={(group, id) => setSelected((s) => ({ ...s, [group]: id }))}
          />
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted">Your configuration</p>
              <p className="text-sm text-fg">
                {chosen.length ? chosen.map((u) => u.label).join(" + ") : "Standard specs"}
              </p>
            </div>
            <p className="text-right" aria-live="polite">
              <span className="block text-xs text-muted">Unit price</span>
              <AnimatedPrice value={unit} className="font-display text-xl font-bold text-fg" />
            </p>
          </div>
        </div>
      )}

      {/* Quantity + CTAs */}
      <div ref={ctaRef} className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-13 items-center rounded-full border border-border-strong bg-surface" role="group" aria-label="Quantity">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              className="grid size-12 place-items-center rounded-full text-fg transition hover:bg-surface-strong disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <output className="w-8 text-center font-semibold tabular-nums text-fg" aria-live="polite" aria-label={`Quantity ${qty}`}>
              {qty}
            </output>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty || outOfStock}
              aria-label="Increase quantity"
              className="grid size-12 place-items-center rounded-full text-fg transition hover:bg-surface-strong disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-muted">Total</p>
            <AnimatedPrice value={total} className="font-display text-2xl font-bold text-fg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => addToCart()} disabled={outOfStock} className="btn btn-secondary btn-lg w-full">
            <ShoppingBag className="size-5" aria-hidden="true" />
            {outOfStock ? "Sold out" : "Add to Cart"}
          </button>
          <button type="button" onClick={buyNow} disabled={outOfStock} className="btn btn-primary btn-lg w-full">
            <Zap className="size-5" aria-hidden="true" />
            Buy Now
          </button>
        </div>

        <a
          href={waLink(phone.wa, waText)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("whatsapp_order", { item_id: p.sku, value: total })}
          className="btn btn-whatsapp btn-lg w-full"
        >
          <WhatsAppIcon className="size-5" />
          {outOfStock ? "Ask on WhatsApp for restock" : "Order on WhatsApp"}
        </a>
        {site.phones[1] && (
        <p className="text-center text-xs text-muted">
          Busy line?{" "}
          <a
            href={waLink(site.phones[1].wa, waText)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-fg underline decoration-emerald-500/60 underline-offset-4 hover:decoration-emerald-400"
          >
            Order via {site.phones[1].display}
          </a>
        </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-1 pt-1 sm:justify-start">
          <button
            type="button"
            onClick={() => {
              toggleWishlist(main.id);
              if (!wished) trackEvent("add_to_wishlist", { currency: money.currency, value: unit, items: [analyticsItem] });
              toast(wished ? "Removed from wishlist" : "Saved to wishlist", "info");
            }}
            aria-pressed={wished}
            className="btn btn-ghost btn-sm"
          >
            <Heart className={cn("size-4", wished && "fill-rose-500 text-rose-500")} aria-hidden="true" />
            {wished ? "Saved" : "Wishlist"}
          </button>
          <button
            type="button"
            onClick={() => {
              const r = toggleCompare(main.id);
              if (!r.ok) toast(r.reason ?? "Compare list full", "error");
              else toast(comparing ? "Removed from compare" : "Added to compare", "info");
            }}
            aria-pressed={comparing}
            className={cn("btn btn-ghost btn-sm", comparing && "text-violet-400")}
          >
            <GitCompareArrows className="size-4" aria-hidden="true" />
            {comparing ? "Comparing" : "Compare"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${p.name} – ${money(base)}\n${productUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("share", { method: "whatsapp", item_id: p.id })}
            className="btn btn-ghost btn-sm"
            aria-label={`Share on WhatsApp: ${p.name}`}
          >
            <WhatsAppIcon className="size-4" /> Share on WhatsApp
          </a>
          <button type="button" onClick={share} className="btn btn-ghost btn-sm">
            <Share2 className="size-4" aria-hidden="true" /> Share
          </button>
        </div>
      </div>

      {/* Delivery estimate */}
      <div className="glass rounded-3xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-500/15 text-sky-400">
            <Truck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor={`${idPrefix}-city`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <MapPin className="size-3.5" aria-hidden="true" /> Deliver to
            </label>
            {pk ? (
              <select
                id={`${idPrefix}-city`}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  try {
                    localStorage.setItem(CITY_KEY, e.target.value);
                  } catch {}
                }}
                className="input mt-1.5 h-11 py-0"
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${idPrefix}-city`}
                value={city}
                placeholder="Your city"
                autoComplete="address-level2"
                maxLength={80}
                onChange={(e) => {
                  setCity(e.target.value);
                  try {
                    localStorage.setItem(CITY_KEY, e.target.value);
                  } catch {}
                }}
                className="input mt-1.5 h-11"
              />
            )}
            <p className="mt-2.5 text-sm text-fg" aria-live="polite">
              Delivery to <strong>{!city.trim() || city.startsWith("Other") ? "your city" : city}</strong>:{" "}
              <span className="font-semibold text-emerald-400">{eta.label}</span>
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {delivery.cod.enabled && (
                <li className="flex items-center gap-1.5">
                  <Banknote className="size-3.5 text-emerald-400" aria-hidden="true" />
                  {codMax && total > codMax ? `Cash on Delivery up to ${money(codMax)} – pay online for this order` : "Cash on Delivery available"}
                </li>
              )}
              {freeAbove > 0 && (
                <li className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                  {total >= freeAbove ? "Free delivery on this order" : `Free delivery on orders over ${money(freeAbove)}`}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <StickyBuyBar
        targetRef={ctaRef}
        name={p.name}
        total={total}
        outOfStock={outOfStock}
        onAdd={() => addToCart()}
        waHref={waLink(phone.wa, waText)}
      />
    </div>
  );
}

/** Mobile-only bar pinned above the bottom nav once the main CTAs scroll out of view. */
function StickyBuyBar({
  targetRef,
  name,
  total,
  outOfStock,
  onAdd,
  waHref,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  name: string;
  total: number;
  outOfStock: boolean;
  onAdd: () => void;
  waHref: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [targetRef]);

  // Lift the floating WhatsApp bubble so it doesn't sit on top of the bar.
  useEffect(() => {
    const root = document.documentElement;
    if (show) root.dataset.pdpBar = "1";
    else delete root.dataset.pdpBar;
    return () => {
      delete root.dataset.pdpBar;
    };
  }, [show]);

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "120%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-[var(--mobile-nav)] z-30 px-2 pb-2 lg:hidden"
          >
            <div className="glass flex items-center gap-2 rounded-2xl p-2 pl-3.5 shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.6)]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-muted">{name}</p>
                <AnimatedPrice value={total} className="font-display text-base font-bold text-fg" />
              </div>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Order on WhatsApp"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-[#25D366] text-white"
              >
                <WhatsAppIcon className="size-5" />
              </a>
              <button type="button" onClick={onAdd} disabled={outOfStock} className="btn btn-primary h-11 shrink-0 px-5">
                <ShoppingBag className="size-4" aria-hidden="true" />
                {outOfStock ? "Sold out" : "Add to Cart"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
