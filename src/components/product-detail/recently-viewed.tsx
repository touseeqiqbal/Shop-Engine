"use client";
import { useEffect, useState } from "react";
import type { CatalogProduct } from "@/lib/types";
import { effectivePrice } from "@/lib/utils";
import { useLists } from "@/store/lists";
import { trackEvent } from "@/components/analytics";
import { shopStat } from "@/lib/shop-stats";
import { useStoreLocale } from "@/components/providers/locale";
import { ProductCarousel } from "@/components/product/product-carousel";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Records the product view (recently-viewed list + analytics `view_item`) and shows
 * the shopper's previously viewed products, fetched from /api/products.
 */
export function RecentlyViewed({ product }: { product: Pick<CatalogProduct, "id" | "sku" | "name" | "brandName" | "categoryName" | "price" | "salePrice"> }) {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const { currency } = useStoreLocale();

  useEffect(() => {
    // the shop's own count (Reports → Shop funnel)
    shopStat("view", product.id);
    trackEvent("view_item", {
      currency,
      value: effectivePrice(product),
      items: [{ item_id: product.sku, item_name: product.name, item_brand: product.brandName, item_category: product.categoryName, price: effectivePrice(product) }],
    });

    const run = () => {
      const lists = useLists.getState();
      const ids = lists.recent.filter((id) => id !== product.id).slice(0, 10);
      lists.pushRecent(product.id);
      if (!ids.length) return setItems([]);
      const ctrl = new AbortController();
      fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: unknown) => setItems(Array.isArray(data) ? (data as CatalogProduct[]) : []))
        .catch(() => {});
    };

    // Wait for the persisted store to rehydrate from localStorage before reading it.
    if (useLists.persist.hasHydrated()) run();
    else return useLists.persist.onFinishHydration(run);
  }, [product, currency]);

  if (!items.length) return null;
  return (
    <section className="container-x" aria-labelledby="recent-heading">
      <SectionHeading eyebrow="Your history" title={<span id="recent-heading">Recently viewed</span>} />
      <ProductCarousel products={items} label="Recently viewed products" />
    </section>
  );
}
