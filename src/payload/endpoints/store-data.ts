import type { Endpoint, PayloadRequest } from "payload";
import { getTenant, hasStoreRole } from "../tenancy";
import { logActivity } from "../collections/history";

/**
 * A store owner's own data (the store being worked in):
 *   GET  /cms-api/store-data/status   what this person may do here (the Home card asks)
 *   GET  /cms-api/store-data/export   EVERYTHING of the store in one JSON file – products, orders, customers, content,
 *                                     stock history, team, integrations … Keys, password data and hidden fields are
 *                                     never included.
 *   POST /cms-api/store-data/close    { confirm: "<the store's name>" } – the shop goes offline and /cms becomes
 *                                     read-only; every record is kept. Only ShopEngine reopens or deletes a store.
 */

type Doc = Record<string, unknown>;

/** Store-scoped collections in the export (each document as the API shows it – hidden fields are left out). */
const COLLECTIONS = [
  "products", "categories", "brands", "laptop-models", "product-collections", "media",
  "orders", "return-requests", "warranty-claims", "payment-transactions",
  "pos-sales", "cash-ups", "units", "purchases", "suppliers", "stock-counts", "stock-movements",
  "discounts", "flash-sales", "reviews", "product-questions", "stock-alerts", "abandoned-carts",
  "pages", "posts", "menus", "contact-messages", "wholesale-inquiries", "trade-ins", "blocked-phones",
  "store-memberships", "integrations", "api-keys", "webhook-endpoints",
] as const;

/** Never exported, whatever a collection holds. */
const DROP = new Set(["secrets", "hash", "password", "salt", "hash_", "resetPasswordToken", "resetPasswordExpiration", "loginAttempts", "lockUntil", "twoFactor", "sessions", "secret", "webhookKey", "token"]);
const clean = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(clean);
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v as Doc).filter(([k]) => !DROP.has(k)).map(([k, x]) => [k, clean(x)]));
};

async function ownerOf(req: PayloadRequest): Promise<{ store: number; platformAdmin: boolean } | Response> {
  if (!req.user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const t = await getTenant(req);
  const store = t.activeStoreId;
  if (store == null) return Response.json({ error: t.platformAdmin ? "Choose a store first (switcher at the top of the menu)." : "You don't work in a store yet." }, { status: 400 });
  if (!t.platformAdmin && !hasStoreRole(t, store, "store_owner")) return Response.json({ error: "Only the store's owner can do this." }, { status: 403 });
  return { store, platformAdmin: t.platformAdmin };
}

const status: Endpoint = {
  path: "/store-data/status",
  method: "get",
  handler: async (req) => {
    const o = await ownerOf(req);
    if (o instanceof Response) return Response.json({ owner: false });
    const store = (await req.payload.findByID({ collection: "stores", id: o.store, depth: 0, overrideAccess: true })) as unknown as Doc;
    return Response.json({ owner: true, storeName: String(store.name ?? ""), status: String(store.status ?? ""), canClose: store.isDefault !== true && !["closed", "suspended"].includes(String(store.status)) });
  },
};

const exportAll: Endpoint = {
  path: "/store-data/export",
  method: "get",
  handler: async (req) => {
    const o = await ownerOf(req);
    if (o instanceof Response) return o;
    const { payload } = req;
    const store = clean(await payload.findByID({ collection: "stores", id: o.store, depth: 0, overrideAccess: true }));
    const collections: Record<string, unknown[]> = {};
    for (const slug of COLLECTIONS) {
      const docs: unknown[] = [];
      // a page at a time, so a big store doesn't need everything in memory twice
      for (let page = 1; page < 1000; page++) {
        const r = await payload.find({ collection: slug as never, where: { store: { equals: o.store } }, limit: 500, page, depth: 0, overrideAccess: true }).catch(() => null);
        if (!r) break;
        docs.push(...r.docs.map(clean));
        if (!r.hasNextPage) break;
      }
      collections[slug] = docs;
    }
    // the store's customers (accounts that bought here or signed up here) – their details, nothing about other stores
    const customers = (await payload.find({ collection: "users", where: { customerOf: { in: [o.store] } } as never, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { email: true, name: true, phone: true, addresses: true, createdAt: true } as never }).catch(() => ({ docs: [] }))).docs.map(clean);
    const settings: Record<string, unknown> = {};
    const { STORE_SETTING_ROLES, storeSettingsSlug } = await import("../store-settings");
    for (const key of Object.keys(STORE_SETTING_ROLES)) {
      const doc = (await payload.find({ collection: storeSettingsSlug(key), where: { store: { equals: o.store } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] }))).docs[0];
      if (doc) settings[key] = clean(doc);
    }
    await logActivity(req, { action: "update", entity: "stores", entityLabel: "Store", docId: String(o.store), title: String((store as Doc).name ?? o.store), changes: [{ field: "data export", from: "", to: "all store data downloaded" }], storeId: o.store });
    const body = JSON.stringify({ format: "shopengine-store-data/1", exportedAt: new Date().toISOString(), store, settings, customers, collections }, null, 1);
    const slug = String((store as Doc).slug ?? o.store).replace(/[^a-z0-9-]/gi, "");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-store-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  },
};

const close: Endpoint = {
  path: "/store-data/close",
  method: "post",
  handler: async (req) => {
    const o = await ownerOf(req);
    if (o instanceof Response) return o;
    const { payload } = req;
    const store = (await payload.findByID({ collection: "stores", id: o.store, depth: 0, overrideAccess: true })) as unknown as Doc;
    if (store.isDefault === true) return Response.json({ error: "The original shop can't be closed here." }, { status: 400 });
    if (["closed", "suspended"].includes(String(store.status))) return Response.json({ error: "This store is already offline." }, { status: 400 });
    const body = (await req.json?.().catch(() => null)) as { confirm?: unknown } | null;
    if (String(body?.confirm ?? "").trim() !== String(store.name ?? "").trim()) return Response.json({ error: "Type the store's name exactly to confirm." }, { status: 400 });
    await payload.update({ collection: "stores", id: o.store, data: { status: "closed" } as never, overrideAccess: true, context: { system: true } });
    await logActivity(req, { action: "update", entity: "stores", entityLabel: "Store", docId: String(o.store), title: String(store.name ?? o.store), changes: [{ field: "status", from: String(store.status), to: "closed – by its owner" }], storeId: o.store });
    const { queueNotification } = await import("../../lib/notify");
    await queueNotification(payload, "platform", null, { subject: `${String(store.name)} was closed by its owner`, lines: [`${String(store.name)} (store #${o.store}) is now offline – its data is kept. Reopen it or delete it from its page in /cms.`], link: { href: `/cms/collections/stores/${o.store}`, label: "Open the store" } }, { dedupeKey: `store-closed:${o.store}:${new Date().toISOString().slice(0, 10)}` }).catch(() => undefined);
    return Response.json({ ok: true });
  },
};

export const storeDataEndpoints: Endpoint[] = [status, exportAll, close];
