"use server";
import { saveCheckoutDraft, type DraftItem } from "@/lib/cms/engagement";
import { isCmsConfigured } from "@/lib/db/config";
import { log } from "@/lib/log";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { priceCart } from "@/lib/cart-pricing";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";
import { normalizePkPhone } from "@/lib/utils";

/**
 * Checkout started: remember the cart against the phone / email so a reminder can bring the shopper back.
 * Only product ids and quantities are taken from the browser – names, prices, links and photos come from the
 * catalogue, so nobody can make the shop send their own text to someone else. One contact can't be filled
 * again and again either.
 */
export async function saveDraft(d: { name: string; phone: string; email: string; items: { productId: string; qty: number; upgradeIds?: string[] }[] }): Promise<void> {
  if (!isCmsConfigured) return;
  const phone = normalizePkPhone(d.phone ?? "");
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email ?? "") && d.email.length <= 120 ? d.email.trim().toLowerCase() : null;
  if (!phone && !email) return;
  const lines = (Array.isArray(d.items) ? d.items : [])
    .slice(0, 30)
    .filter((i) => i && typeof i.productId === "string" && i.productId.length <= 120 && Number(i.qty) > 0)
    .map((i) => ({ productId: i.productId, qty: Math.min(MAX_QTY_PER_ITEM, Math.trunc(Number(i.qty))), upgradeIds: (Array.isArray(i.upgradeIds) ? i.upgradeIds : []).filter((u) => typeof u === "string").slice(0, 10) }));
  if (!lines.length) return;
  if (!(await rateLimit("checkout-draft", 30, 10 * 60_000))) return;
  if (!rateLimitKey(`checkout-draft:${phone ?? email}`, 6, 60 * 60_000)) return;
  try {
    const priced = await priceCart(lines);
    const items: DraftItem[] = priced.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice, slug: i.slug, url: i.url, image: i.image }));
    if (!items.length) return;
    // a name, not a message: letters, spaces and a few marks only
    const name = String(d.name ?? "").replace(/[^\p{L}\p{M}\s.'-]/gu, "").trim().slice(0, 60);
    await saveCheckoutDraft({ name, phone, email, items });
  } catch (e) {
    log.error("cart.draft_save_failed", e);
  }
}
