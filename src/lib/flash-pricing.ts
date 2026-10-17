/**
 * Flash sales with a discount (/cms → Sales → Flash sales → "% off"): while a sale runs, its products (and their
 * options) cost that much less – applied to the catalog snapshot, so the pages, the cart and checkout's own pricing
 * all use the same price. Client-safe.
 */

export type FlashDiscount = { productIds: string[]; percent: number; endsAt: string };

/** The regular price less `percent` – whole amounts stay whole (Rs 1,499 → Rs 1,349), cents to the cent. */
export function flashPrice(regular: number, percent: number): number {
  const v = regular * (1 - Math.min(90, Math.max(0, percent)) / 100);
  return Number.isInteger(regular) ? Math.round(v) : Math.round(v * 100) / 100;
}

type Priced = { id: string; price: number; salePrice?: number | null; variantOf?: string | null; flashEndsAt?: string | null };

/** The products with the running sales' prices – a sale never makes a product dearer than its own sale price. */
export function applyFlashSales<T extends Priced & { variants?: T[] }>(products: T[], sales: FlashDiscount[]): T[] {
  if (!sales.length) return products;
  const best = new Map<string, FlashDiscount>();
  for (const s of sales) for (const id of s.productIds) if (!best.has(id) || best.get(id)!.percent < s.percent) best.set(id, s);
  const one = (p: T): T => {
    const sale = best.get(p.id) ?? (p.variantOf ? best.get(p.variantOf) : undefined);
    const variants = p.variants?.map(one);
    if (!sale || !(p.price > 0)) return variants ? { ...p, variants } : p;
    const now = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
    const off = flashPrice(p.price, sale.percent);
    return { ...p, ...(variants ? { variants } : {}), ...(off < now ? { salePrice: off, flashEndsAt: sale.endsAt } : {}) };
  };
  return products.map(one);
}
