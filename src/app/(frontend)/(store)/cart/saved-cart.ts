"use server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isCmsConfigured } from "@/lib/db/config";
import { priceCart } from "@/lib/cart-pricing";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";
import { rateLimit } from "@/lib/rate-limit";
import { currentStoreId } from "@/lib/tenant";
import { log } from "@/lib/log";
import type { UpgradeOption } from "@/lib/types";

/**
 * The signed-in shopper's cart on the server (one per store), so it follows them across devices.
 * Guests keep using the browser's cart only.
 */

const lineSchema = z.object({ productId: z.string().min(1).max(120), qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM), upgradeIds: z.array(z.string().max(120)).max(10) });
const linesSchema = z.array(lineSchema).max(30);

export type SavedCartLine = { productId: string; slug: string; name: string; image: string; url: string; brandName: string; unitPrice: number; qty: number; stock: number; upgrades: UpgradeOption[] };

async function owner() {
  if (!isCmsConfigured) return null;
  const user = await getSessionUser().catch(() => null);
  if (!user || user.role !== "customer") return null;
  const store = await currentStoreId();
  if (store == null) return null;
  const { payloadClient } = await import("@/lib/cms/catalog-source");
  const { byStorefrontId } = await import("@/lib/cms/sales");
  const payload = await payloadClient();
  const doc = (await payload.find({ collection: "users", where: byStorefrontId(user.id), limit: 1, depth: 0, overrideAccess: true })).docs[0] as { id: number } | undefined;
  return doc ? { payload, userId: Number(doc.id), store } : null;
}

/** Saves the cart (ids and quantities only). Returns false for guests (nothing to do). */
export async function saveCart(lines: unknown): Promise<boolean> {
  const parsed = linesSchema.safeParse(lines);
  if (!parsed.success) return false;
  if (!(await rateLimit("saved-cart", 120, 10 * 60_000))) return false;
  const o = await owner();
  if (!o) return false;
  try {
    const existing = (await o.payload.find({ collection: "customer-carts", where: { and: [{ user: { equals: o.userId } }, { store: { equals: o.store } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as { id: number } | undefined;
    if (existing) await o.payload.update({ collection: "customer-carts", id: existing.id, data: { lines: parsed.data } as never, overrideAccess: true, context: { system: true } });
    else await o.payload.create({ collection: "customer-carts", data: { store: o.store, user: o.userId, lines: parsed.data } as never, overrideAccess: true, context: { system: true, storefront: true, storeId: o.store } });
    return true;
  } catch (e) {
    log.error("cart.save_failed", e);
    return false;
  }
}

/** The saved cart, priced from the live catalogue (lines that can't be bought any more are left out). null = a guest. */
export async function loadCart(): Promise<SavedCartLine[] | null> {
  const o = await owner();
  if (!o) return null;
  const doc = (await o.payload.find({ collection: "customer-carts", where: { and: [{ user: { equals: o.userId } }, { store: { equals: o.store } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as { lines?: unknown } | undefined;
  const parsed = linesSchema.safeParse(doc?.lines ?? []);
  if (!parsed.success || !parsed.data.length) return [];
  const priced = await priceCart(parsed.data).catch(() => null);
  if (!priced) return [];
  const byId = new Map(priced.products.map((p) => [p.id, p]));
  return priced.items.map((i) => {
    const p = byId.get(i.productId);
    return { productId: i.productId, slug: i.slug, name: i.name, image: i.image, url: i.url, brandName: p?.brandName ?? "", unitPrice: i.unitPrice, qty: i.qty, stock: p?.stock ?? 0, upgrades: i.upgrades };
  });
}
