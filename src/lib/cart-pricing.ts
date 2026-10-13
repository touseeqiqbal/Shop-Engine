import "server-only";
import { getProductsByIds } from "@/lib/repo/catalog";
import { getOne } from "@/lib/repo/db";
import { isCmsConfigured } from "@/lib/db/config";
import { freshStock } from "@/lib/cms/catalog-source";
import type { CatalogProduct, OrderItem } from "@/lib/types";
import { effectivePrice } from "@/lib/utils";

/** What the client is allowed to send: ids and quantities only – never prices. */
export interface CartRequestLine {
  productId: string;
  qty: number;
  upgradeIds: string[];
}

export interface PricedCart {
  items: OrderItem[];
  products: CatalogProduct[];
  subtotal: number;
  problems: string[];
}

/**
 * Re-prices a cart from the live catalog: sale price + upgrade prices (matched by id against product.upgrades).
 * Stock is checked against a fresh (uncached) product row.
 */
export async function priceCart(lines: CartRequestLine[], opts: { checkStock?: boolean } = {}): Promise<PricedCart> {
  const problems: string[] = [];
  const merged = new Map<string, CartRequestLine>();
  for (const l of lines) {
    const ids = [...new Set(l.upgradeIds)].sort();
    const key = [l.productId, ...ids].join("|");
    const prev = merged.get(key);
    merged.set(key, { productId: l.productId, upgradeIds: ids, qty: (prev?.qty ?? 0) + Math.max(1, Math.floor(l.qty)) });
  }

  const products = await getProductsByIds([...new Set([...merged.values()].map((l) => l.productId))]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const qtyByProduct = new Map<string, number>();
  const items: OrderItem[] = [];

  for (const l of merged.values()) {
    const p = byId.get(l.productId);
    if (!p) {
      problems.push("An item in your cart is no longer available – please remove it.");
      continue;
    }
    if (p.variants?.length) {
      problems.push(`Choose an option (e.g. colour / size) for “${p.name}” on its page, then add it again.`);
      continue;
    }
    if (p.priceOnRequest) {
      // Wholesale lots are quote-only: never priced or sold through the cart.
      problems.push(`“${p.name}” is sold by quote only – please remove it and request a wholesale quote.`);
      continue;
    }
    const upgrades = l.upgradeIds.map((id) => p.upgrades.find((u) => u.id === id));
    if (upgrades.some((u) => !u)) {
      problems.push(`An upgrade option for “${p.name}” is no longer available – please re-add the product.`);
      continue;
    }
    const valid = upgrades.filter((u): u is NonNullable<typeof u> => Boolean(u));
    if (new Set(valid.map((u) => u.group.toLowerCase())).size !== valid.length || valid.some((u) => !(u.price >= 0))) {
      problems.push(`Choose one option per group for “${p.name}” – please re-add the product.`);
      continue;
    }
    const unitPrice = effectivePrice(p) + valid.reduce((s, u) => s + u.price, 0);
    qtyByProduct.set(p.id, (qtyByProduct.get(p.id) ?? 0) + l.qty);
    items.push({ productId: p.id, slug: p.slug, name: p.name, image: p.images[0] ?? "", url: p.url, unitPrice, qty: l.qty, upgrades: valid });
  }

  if (opts.checkStock) {
    for (const [id, qty] of qtyByProduct) {
      // Live stock straight from the catalog (bypasses caches)
      const fresh = isCmsConfigured ? await freshStock(id).catch(() => null) : ((await getOne("products", "id", id).catch(() => null))?.stock ?? null);
      const stock = fresh ?? byId.get(id)?.stock ?? 0;
      const name = byId.get(id)?.name ?? "An item";
      if (stock <= 0) problems.push(`“${name}” just went out of stock.`);
      else if (qty > stock) problems.push(`Only ${stock} unit${stock === 1 ? "" : "s"} of “${name}” left – please reduce the quantity.`);
    }
  }

  return { items, products, subtotal: items.reduce((s, i) => s + i.unitPrice * i.qty, 0), problems };
}
