import "server-only";
import { payloadClient } from "@/lib/cms/catalog-source";
import { getConversionSettings } from "@/lib/cms/engagement";
import { canReach, notifyAbandonedCart, notifyStockOrPrice } from "@/lib/notify";
import { log } from "@/lib/log";

/** Housekeeping tasks: back-in-stock / price-drop alerts and abandoned-cart reminders. */

type Doc = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function sendStockAndPriceAlerts(): Promise<number> {
  const s = await getConversionSettings();
  if (!s.alertsEnabled) return 0;
  const payload = await payloadClient();
  // Only alerts that can be due (product back in stock, or price alerts), oldest first – so alerts for products
  // that stay sold out can't fill every run and hide the ones that are due.
  const res = await payload.find({
    collection: "stock-alerts",
    where: { and: [{ status: { equals: "waiting" } }, { or: [{ kind: { equals: "price" } }, { "product.stock": { greater_than: 0 } }] }] },
    sort: "createdAt",
    limit: 200,
    depth: 2,
    populate: { products: { title: true, slug: true, status: true, price: true, stock: true, category: true }, categories: { slug: true } } as never,
    overrideAccess: true,
  });
  let sent = 0;
  for (const a of res.docs as unknown as Doc[]) {
    const p = a.product as Doc | null;
    if (!p || p.status !== "active") continue;
    const price = num(p.price);
    const due = a.kind === "stock" ? num(p.stock) > 0 : num(a.priceAtSignup) > 0 && price <= num(a.priceAtSignup) * (1 - s.priceDropPercent / 100);
    if (!due) continue;
    // keep waiting until there's a way to reach them (email / WhatsApp not set up yet)
    if (!canReach(str(a.contact), a.kind === "price" ? "WHATSAPP_TEMPLATE_PRICE_DROP" : "WHATSAPP_TEMPLATE_BACK_IN_STOCK")) continue;
    const cat = p.category as Doc | null;
    const url = cat?.slug ? `/${str(cat.slug)}/${str(p.slug)}` : "/";
    try {
      await notifyStockOrPrice({ contact: str(a.contact), kind: a.kind === "price" ? "price" : "stock", title: str(p.title), url, price, was: a.kind === "price" ? num(a.priceAtSignup) : undefined });
      await payload.update({ collection: "stock-alerts", id: Number(a.id), data: { status: "sent", sentAt: new Date().toISOString() } as never, overrideAccess: true });
      sent++;
    } catch (e) {
      log.error("alerts.send_failed", e, { alert: a.id });
    }
  }
  return sent;
}

export async function sendCartReminders(siteUrl: string): Promise<number> {
  const s = await getConversionSettings();
  if (!s.cartEnabled) return 0;
  const payload = await payloadClient();
  const now = Date.now();
  const first = new Date(now - s.cartFirstHours * 3600e3).toISOString();
  const res = await payload.find({
    collection: "abandoned-carts",
    // carts that already got both reminders are done – they must not use up the batch
    where: { and: [{ status: { in: ["open", "reminded"] } }, { lastActivityAt: { less_than: first } }, { or: [{ remindersSent: { less_than: 2 } }, { remindersSent: { exists: false } }] }] },
    sort: "lastActivityAt",
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  let sent = 0;
  for (const c of res.docs as unknown as Doc[]) {
    const count = num(c.remindersSent);
    const idleH = (now - Date.parse(str(c.lastActivityAt))) / 3600e3;
    const due = count === 0 || (count === 1 && s.cartSecondHours > 0 && idleH >= s.cartSecondHours);
    if (!due || !canReach(str(c.contact), "WHATSAPP_TEMPLATE_CART")) continue;
    const items = (Array.isArray(c.items) ? c.items : []) as { name?: string; qty?: number }[];
    try {
      await notifyAbandonedCart({
        contact: str(c.contact),
        name: str(c.name),
        items: items.map((i) => ({ name: str(i.name), qty: num(i.qty) || 1 })),
        total: num(c.total),
        restoreUrl: `${siteUrl}/cart/restore/${str(c.token)}`,
        subject: s.cartSubject,
        message: s.cartMessage,
        coupon: s.cartCoupon || undefined,
      });
      await payload.update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "reminded", remindersSent: count + 1, lastReminderAt: new Date().toISOString() } as never, overrideAccess: true });
      sent++;
    } catch (e) {
      log.error("cart.reminder_failed", e, { cart: c.id });
    }
  }
  return sent;
}

/**
 * Personal data isn't kept for ever: abandoned carts and finished / unanswered stock alerts older than 90 days are
 * removed (they hold phone numbers and emails of people who never ordered).
 */
export async function cleanupOldEngagementData(): Promise<number> {
  const payload = await payloadClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 3600e3).toISOString();
  const carts = await payload.delete({ collection: "abandoned-carts", where: { and: [{ lastActivityAt: { less_than: cutoff } }, { status: { not_equals: "recovered" } }] }, overrideAccess: true }).catch(() => ({ docs: [] }));
  const alerts = await payload.delete({ collection: "stock-alerts", where: { createdAt: { less_than: cutoff } }, overrideAccess: true }).catch(() => ({ docs: [] }));
  // Stock history and Activity log are kept for 2 years (one statement each – they can be large)
  let history = 0;
  try {
    const { sql } = await import("@payloadcms/db-postgres");
    const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rowCount?: number | null }> } }).drizzle;
    for (const table of [sql`"payload"."cms_stock_movements"`, sql`"payload"."cms_activity_log"`])
      history += (await db.execute(sql`DELETE FROM ${table} WHERE "created_at" < now() - interval '730 days'`)).rowCount ?? 0;
  } catch (e) {
    log.error("housekeeping.history_cleanup_failed", e);
  }
  return (carts.docs?.length ?? 0) + (alerts.docs?.length ?? 0) + history;
}
