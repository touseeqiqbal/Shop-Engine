import "server-only";
import { payloadClient } from "@/lib/cms/catalog-source";
import { getConversionSettings } from "@/lib/cms/engagement";
import { canReach, queueNotification } from "@/lib/notify";
import { storeDirectory, storeOrigin } from "@/lib/tenant";
import { log } from "@/lib/log";
import { isOptedOut } from "@/payload/optouts";

/**
 * Housekeeping tasks: back-in-stock / price-drop alerts and abandoned-cart reminders – each store with its own settings
 * (Settings → Conversion), its own links and its own sender details. Messages are queued (the outbox delivers and retries);
 * the record is marked in the same step, so a reminder is never queued twice.
 */

type Doc = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : v == null ? null : Number(v));

/** Settings of each store that has waiting records (the setting is read once per store per run). */
function settingsCache() {
  const m = new Map<number | null, ReturnType<typeof getConversionSettings>>();
  return (storeId: number | null) => {
    if (!m.has(storeId)) m.set(storeId, getConversionSettings(storeId));
    return m.get(storeId)!;
  };
}

/** At most this many pages of candidates per run (each job's own page size). */
const MAX_PAGES = 10;

export async function sendStockAndPriceAlerts(): Promise<number> {
  const payload = await payloadClient();
  const settingsOf = settingsCache();
  // Only alerts that can be due (product back in stock, or price alerts), oldest first – so alerts for products
  // that stay sold out can't fill every run and hide the ones that are due.
  // page on through the candidates (a cursor on createdAt): alerts that aren't due (price not low enough, the store
  // has alerts off, no way to reach the person) are skipped, not changed – with one batch only, 200 of them would
  // hide every due alert behind them for good
  const docs: Doc[] = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await payload.find({
      collection: "stock-alerts",
      where: { and: [{ status: { equals: "waiting" } }, { or: [{ kind: { equals: "price" } }, { "product.stock": { greater_than: 0 } }] }, ...(after ? [{ createdAt: { greater_than: after } }] : [])] },
      sort: "createdAt",
      limit: 200,
      depth: 2,
      populate: { products: { title: true, slug: true, status: true, price: true, stock: true, category: true, store: true }, categories: { slug: true } } as never,
      overrideAccess: true,
    });
    docs.push(...(res.docs as unknown as Doc[]));
    if (!res.hasNextPage || !res.docs.length) break;
    after = str((res.docs[res.docs.length - 1] as unknown as Doc).createdAt);
  }
  let sent = 0;
  for (const a of docs) {
    const p = a.product as Doc | null;
    if (!p || p.status !== "active") continue;
    const storeId = relId(a.store) ?? relId(p.store);
    const s = await settingsOf(storeId);
    if (!s.alertsEnabled) continue;
    const price = num(p.price);
    const due = a.kind === "stock" ? num(p.stock) > 0 : num(a.priceAtSignup) > 0 && price <= num(a.priceAtSignup) * (1 - s.priceDropPercent / 100);
    if (!due) continue;
    // keep waiting until there's a way to reach them (email / WhatsApp not set up yet)
    if (!(await canReach(str(a.contact), a.kind === "price" ? "WHATSAPP_TEMPLATE_PRICE_DROP" : "WHATSAPP_TEMPLATE_BACK_IN_STOCK", storeId))) continue;
    const cat = p.category as Doc | null;
    const url = cat?.slug ? `/${str(cat.slug)}/${str(p.slug)}` : "/";
    try {
      await queueNotification(payload, "stock-or-price", storeId, { contact: str(a.contact), kind: a.kind === "price" ? "price" : "stock", title: str(p.title), url, price, was: a.kind === "price" ? num(a.priceAtSignup) : undefined }, { dedupeKey: `alert:${String(a.id)}` });
      await payload.update({ collection: "stock-alerts", id: Number(a.id), data: { status: "sent", sentAt: new Date().toISOString() } as never, overrideAccess: true, context: { system: true } });
      sent++;
    } catch (e) {
      log.error("alerts.send_failed", e, { alert: a.id });
    }
  }
  return sent;
}

export async function sendCartReminders(): Promise<number> {
  const payload = await payloadClient();
  const settingsOf = settingsCache();
  // abandoned-cart recovery is a plan feature
  const { hasFeature, storeLimits } = await import("@/lib/billing");
  const allowed = new Map<number | null, boolean>();
  const cartsAllowed = async (storeId: number | null) => {
    if (!allowed.has(storeId)) allowed.set(storeId, hasFeature(await storeLimits(payload, storeId), "abandoned_carts"));
    return allowed.get(storeId)!;
  };
  const stores = await storeDirectory();
  const originOf = (storeId: number | null) => {
    const store = storeId == null ? stores.find((x) => x.isDefault) : stores.find((x) => x.id === storeId);
    return (store ? storeOrigin(store) : (process.env.NEXT_PUBLIC_SITE_URL ?? "")).replace(/\/+$/, "");
  };
  const now = Date.now();
  // the earliest any store reminds (1 hour); each store's own timing is checked per cart below
  // carts that already got both reminders are done – they must not use up the batch; carts that are skipped (the store
  // has reminders off or not on its plan, no way to reach the person, not due yet) aren't changed, so page on through
  // them (a cursor on lastActivityAt) instead of always looking at the same oldest 100
  const carts: Doc[] = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await payload.find({
      collection: "abandoned-carts",
      where: { and: [{ status: { in: ["open", "reminded"] } }, { lastActivityAt: { less_than: new Date(now - 3600e3).toISOString() } }, { or: [{ remindersSent: { less_than: 2 } }, { remindersSent: { exists: false } }] }, ...(after ? [{ lastActivityAt: { greater_than: after } }] : [])] },
      sort: "lastActivityAt",
      limit: 100,
      depth: 0,
      overrideAccess: true,
    });
    carts.push(...(res.docs as unknown as Doc[]));
    if (!res.hasNextPage || !res.docs.length) break;
    after = str((res.docs[res.docs.length - 1] as unknown as Doc).lastActivityAt);
  }
  let sent = 0;
  for (const c of carts) {
    const storeId = relId(c.store);
    const s = await settingsOf(storeId);
    if (!s.cartEnabled || !(await cartsAllowed(storeId))) continue;
    const count = num(c.remindersSent);
    const idleH = (now - Date.parse(str(c.lastActivityAt))) / 3600e3;
    const due = (count === 0 && idleH >= s.cartFirstHours) || (count === 1 && s.cartSecondHours > 0 && idleH >= s.cartSecondHours);
    if (!due || !(await canReach(str(c.contact), "WHATSAPP_TEMPLATE_CART", storeId))) continue;
    // they asked this store for no more reminders (an earlier cart's link, their email app's Unsubscribe)
    if (await isOptedOut(payload, storeId, [c.email, c.phone, c.contact])) {
      await payload.update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "stopped" } as never, overrideAccess: true, context: { system: true } });
      continue;
    }
    const items = (Array.isArray(c.items) ? c.items : []) as { name?: string; qty?: number }[];
    try {
      await queueNotification(
        payload,
        "abandoned-cart",
        storeId,
        {
          contact: str(c.contact),
          name: str(c.name),
          items: items.map((i) => ({ name: str(i.name), qty: num(i.qty) || 1 })),
          total: num(c.total),
          restoreUrl: `${originOf(storeId)}/cart/restore/${str(c.token)}`,
          // the email app's one-click Unsubscribe (List-Unsubscribe)
          unsubscribeUrl: `${originOf(storeId)}/api/unsubscribe/cart/${str(c.token)}`,
          subject: s.cartSubject,
          message: s.cartMessage,
          coupon: s.cartCoupon || undefined,
        },
        { dedupeKey: `cart:${String(c.id)}:${count + 1}` },
      );
      await payload.update({ collection: "abandoned-carts", id: Number(c.id), data: { status: "reminded", remindersSent: count + 1, lastReminderAt: new Date().toISOString() } as never, overrideAccess: true, context: { system: true } });
      sent++;
    } catch (e) {
      log.error("cart.reminder_failed", e, { cart: c.id });
    }
  }
  return sent;
}

/**
 * Personal data isn't kept for ever: abandoned carts and finished / unanswered stock alerts older than 90 days are
 * removed (they hold phone numbers and emails of people who never ordered). Delivered outbox messages go after 30 days.
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
    // sent messages hold contact details – kept 30 days for support questions; failed ("dead") ones 90 days
    history += (await db.execute(sql`DELETE FROM "payload"."cms_outbox_events" WHERE ("status" = 'sent' AND "created_at" < now() - interval '30 days') OR ("status" = 'dead' AND "created_at" < now() - interval '90 days')`)).rowCount ?? 0;
  } catch (e) {
    log.error("housekeeping.history_cleanup_failed", e);
  }
  return (carts.docs?.length ?? 0) + (alerts.docs?.length ?? 0) + history;
}
