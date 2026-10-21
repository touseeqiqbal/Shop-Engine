"use client";
import Image from "next/image";
import Link from "next/link";
import { m as motion } from "framer-motion";
import { GitCompareArrows, Heart, ShoppingBag, Flame, FileText } from "lucide-react";
import type { CatalogProduct } from "@/lib/types";
import { availabilityLabel, canOrder, cn, discountPercent, effectivePrice, formatDate } from "@/lib/utils";
import { trackEvent } from "@/components/analytics";
import { useStoreLocale } from "@/components/providers/locale";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/stars";
import { ConditionBadge } from "@/components/ui/condition-badge";
import { addLimitMessage, useCart } from "@/store/cart";
import { useLists } from "@/store/lists";
import { useUi } from "@/store/ui";
import { useHydrated } from "@/hooks/use-hydrated";
import { quoteHref } from "@/lib/wholesale";

export function ProductCard({
  product: p,
  priority,
  layout = "grid",
  className,
}: {
  product: CatalogProduct;
  priority?: boolean;
  layout?: "grid" | "list";
  className?: string;
}) {
  const add = useCart((s) => s.add);
  const { wishlist, compare, toggleWishlist, toggleCompare } = useLists();
  const toast = useUi((s) => s.toast);
  const hydrated = useHydrated();
  const loc = useStoreLocale();
  const { currency } = loc;
  const wished = hydrated && wishlist.includes(p.id);
  const analyticsItem = { item_id: p.sku, item_name: p.name, item_brand: p.brandName, item_category: p.categoryName, price: effectivePrice(p), quantity: 1 };
  const comparing = hydrated && compare.includes(p.id);
  const off = discountPercent(p);
  // in stock – or a pre-order / keep-selling product (Products → When sold out)
  const outOfStock = !canOrder(p);
  const availability = availabilityLabel(p, (iso) => formatDate(iso, { day: "numeric", month: "short" }, loc));
  const list = layout === "list";
  const quoteOnly = Boolean(p.priceOnRequest);

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={cn(
        "group glow-hover card relative flex overflow-hidden rounded-[1.25rem] transition-shadow duration-300 hover:shadow-[0_20px_60px_-20px_rgba(99,102,241,0.45)]",
        list ? "flex-row gap-4 p-3 sm:p-4" : "flex-col p-2.5 sm:p-3",
        className
      )}
    >
      {/* Media */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] light:from-slate-100 light:to-white",
          list ? "aspect-square w-32 shrink-0 sm:w-48" : "aspect-square w-full"
        )}
      >
        <Link href={p.url} aria-label={p.name} className="absolute inset-0 z-[1]" tabIndex={-1} />
        {p.images[0] ? (
          <Image
            src={p.images[0]}
            alt={p.name}
            fill
            priority={priority}
            sizes={list ? "(min-width: 640px) 192px, 128px" : "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"}
            className={cn("object-contain p-3 transition-all duration-500", p.images[1] && "group-hover:scale-105 group-hover:opacity-0")}
          />
        ) : (
          // no photo yet: the product's initial instead of a broken image
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-muted">
            {p.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        {p.images[1] && (
          <Image
            src={p.images[1]}
            alt=""
            fill
            sizes={list ? "192px" : "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"}
            className="scale-95 object-contain p-3 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100"
            aria-hidden="true"
          />
        )}

        <div className="pointer-events-none absolute left-2 top-2 z-[2] flex flex-col items-start gap-1.5">
          {p.condition && p.condition !== "new" && <ConditionBadge condition={p.condition} />}
          {off > 0 && (
            <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold text-white shadow-lg">-{off}%</span>
          )}
          {p.hotDeal && off === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[11px] font-bold text-white">
              <Flame className="size-3" aria-hidden="true" /> Deal
            </span>
          )}
        </div>

        <div className="absolute right-2 top-2 z-[2] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              toggleWishlist(p.id);
              if (!wished) trackEvent("add_to_wishlist", { currency, value: analyticsItem.price, items: [analyticsItem] });
              toast(wished ? "Removed from wishlist" : "Saved to wishlist", "info");
            }}
            aria-pressed={wished}
            aria-label={wished ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`}
            className="glass grid size-9 place-items-center rounded-full transition hover:scale-110"
          >
            <Heart className={cn("size-4", wished ? "fill-rose-500 text-rose-500" : "text-fg")} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              const r = toggleCompare(p.id);
              if (!r.ok) toast(r.reason ?? "Compare list full", "error");
              else toast(comparing ? "Removed from compare" : "Added to compare", "info");
            }}
            aria-pressed={comparing}
            aria-label={comparing ? `Remove ${p.name} from compare` : `Compare ${p.name}`}
            className={cn(
              "glass hidden size-9 place-items-center rounded-full transition hover:scale-110 sm:grid sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              comparing && "!opacity-100 ring-2 ring-violet-500"
            )}
          >
            <GitCompareArrows className="size-4 text-fg" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex min-w-0 flex-1 flex-col", list ? "py-1" : "px-1 pb-1 pt-3")}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{p.brandName}</p>
        <h3 className={cn("mt-1 font-semibold leading-snug text-fg", list ? "text-base sm:text-lg" : "line-clamp-2 text-sm sm:text-[0.95rem]")}>
          <Link href={p.url} className="hover:underline decoration-violet-500/60 underline-offset-4">
            {p.name}
          </Link>
        </h3>
        {list && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.shortDescription}</p>}
        {p.reviewCount > 0 && p.rating > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Stars rating={p.rating} />
            <span className="text-xs text-muted">({p.reviewCount})</span>
          </div>
        )}
        <div className="mt-auto pt-2.5">
          {quoteOnly ? (
            <>
              <p className="font-display text-base font-bold text-fg">Price on request</p>
              <p className="mt-0.5 text-xs text-sky-400">
                Wholesale lot{p.wholesale?.lotSize ? ` · ${p.wholesale.lotSize} pcs` : ""}
                {p.wholesale?.grades ? <span className="hidden text-muted sm:inline"> · {p.wholesale.grades}</span> : null}
              </p>
              <Link
                href={quoteHref(p.slug)}
                aria-label={`Request quote: ${p.name}`}
                className={cn("btn btn-sm mt-3 w-full", list ? "btn-primary sm:w-auto" : "btn-secondary group-hover:border-transparent group-hover:bg-brand-gradient group-hover:text-white")}
              >
                <FileText className="size-4" aria-hidden="true" />
                Request quote
              </Link>
            </>
          ) : (
          <>
          {p.variantCount ? <span className="text-[11px] font-medium text-muted">From</span> : null}
          <Price price={p.price} salePrice={p.salePrice} size="sm" />
          {/* no "COD available" here: a card can't tell whether the store has Cash on Delivery switched on */}
          <p className={cn("mt-0.5 text-xs", { rose: "text-rose-400 light:text-rose-700", amber: "text-amber-400 light:text-amber-700", violet: "text-violet-300 light:text-violet-700", emerald: "text-emerald-400 light:text-emerald-700" }[availability.tone])}>
            {availability.label}
          </p>
          {p.variantCount ? (
            // options (colour / size …) are chosen on the product page
            <Link
              href={p.url}
              // a list of cards reads "Choose options" many times – say which product (visible text first, for voice control)
              aria-label={`${outOfStock ? "Sold out" : "Choose options"}: ${p.name}`}
              className={cn("btn btn-sm mt-3 w-full", list ? "btn-primary sm:w-auto" : "btn-secondary group-hover:border-transparent group-hover:bg-brand-gradient group-hover:text-white")}
            >
              {outOfStock ? "Sold out" : "Choose options"}
            </Link>
          ) : (
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => {
              const limited = addLimitMessage(add(p));
              if (limited) toast(limited, "error");
              trackEvent("add_to_cart", { currency, value: analyticsItem.price, items: [analyticsItem], source: "product_card" });
            }}
            aria-label={`${outOfStock ? "Sold out" : "Add to Cart"}: ${p.name}`}
            className={cn("btn btn-sm mt-3 w-full", list ? "btn-primary sm:w-auto" : "btn-secondary group-hover:border-transparent group-hover:bg-brand-gradient group-hover:text-white")}
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            {outOfStock ? "Sold out" : "Add to Cart"}
          </button>
          )}
          </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
