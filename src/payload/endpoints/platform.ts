import type { Endpoint, PayloadRequest, Where } from "payload";
import { storeLocale } from "../../lib/locale";
import { roundMoney } from "../../lib/money";
import { getTenant, storeIdOf } from "../tenancy";
import { logActivity } from "../collections/history";

/**
 * Store switching and the platform overview.
 *   GET  /cms-api/platform/my-stores    the stores this person works in, their role in the current one
 *   POST /cms-api/platform/switch-store   { storeId | null } → work in that store (null = all stores, platform admins only)
 *   GET  /cms-api/platform/overview   ShopEngine-wide numbers (platform admins only)
 */

const bad = (error: string, status = 400) => Response.json({ error }, { status });

type StoreRow = { id: number; name?: string; slug?: string; status?: string; subscriptionStatus?: string; isDefault?: boolean; country?: string; currency?: string; timezone?: string; defaultLanguage?: string };

const mine: Endpoint = {
  path: "/platform/my-stores",
  method: "get",
  handler: async (req) => {
    if (!req.user) return bad("Sign in first.", 401);
    const t = await getTenant(req);
    const where: Where = t.platformAdmin ? {} : { id: { in: [...t.roles.keys()] } };
    const stores = t.platformAdmin || t.roles.size ? ((await req.payload.find({ collection: "stores", where, limit: 500, depth: 0, sort: "name", overrideAccess: true, req })).docs as unknown as StoreRow[]) : [];
    return Response.json({
      platformAdmin: t.platformAdmin,
      activeStoreId: t.activeStoreId,
      storeRole: t.platformAdmin ? "platform_admin" : (t.roles.get(t.activeStoreId ?? -1) ?? null),
      readOnly: t.activeStoreId != null && t.readOnly.has(t.activeStoreId),
      stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug, status: s.status, subscriptionStatus: s.subscriptionStatus, isDefault: Boolean(s.isDefault), ...storeLocale(s), role: t.platformAdmin ? "platform_admin" : (t.roles.get(Number(s.id)) ?? null) })),
    });
  },
};

const switchStore: Endpoint = {
  path: "/platform/switch-store",
  method: "post",
  handler: async (req) => {
    if (!req.user) return bad("Sign in first.", 401);
    const body = (await req.json?.().catch(() => null)) as { storeId?: unknown } | null;
    const target = storeIdOf(body?.storeId);
    const t = await getTenant(req);
    if (target == null && !t.platformAdmin) return bad("Choose a store.");
    if (target != null && !t.platformAdmin && !t.roles.has(target)) return bad("You don't work in that store.", 403);
    await req.payload.update({ collection: "users", id: req.user.id, data: { currentStore: target } as never, overrideAccess: true, req, context: { storeSwitch: true } });
    // support access: a platform admin opening a store they aren't on the team of is recorded in that store's log
    if (target != null && t.platformAdmin && !t.roles.has(target)) {
      const store = (await req.payload.findByID({ collection: "stores", id: target, depth: 0, overrideAccess: true, req }).catch(() => null)) as StoreRow | null;
      await logActivity(req, { action: "update", entity: "stores", entityLabel: "Store", docId: String(target), title: store?.name ?? `#${target}`, changes: [{ field: "support access", from: "", to: "ShopEngine support opened this store" }], storeId: target });
    }
    return Response.json({ ok: true, activeStoreId: target });
  },
};

/** Monthly value of a subscription (annual plans count one twelfth). */
const monthly = (s: { amount?: number; billingCycle?: string }) => (Number(s.amount) || 0) / (s.billingCycle === "annual" ? 12 : 1);

export async function overviewFor(req: PayloadRequest) {
  const p = req.payload;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const count = (collection: "stores" | "orders" | "store-subscriptions" | "outbox-events" | "users", where: object = {}) =>
    p.count({ collection, where: where as never, overrideAccess: true, req }).then((r) => r.totalDocs).catch(() => 0);
  const [stores, active, draft, suspended, closed, newStores, merchants, deadDeliveries] = await Promise.all([
    count("stores"),
    count("stores", { status: { equals: "active" } }),
    count("stores", { status: { equals: "draft" } }),
    count("stores", { status: { equals: "suspended" } }),
    count("stores", { status: { equals: "closed" } }),
    count("stores", { createdAt: { greater_than: since } }),
    count("users", { platformRole: { equals: "merchant_owner" } }),
    count("outbox-events", { status: { equals: "dead" } }),
  ]);
  const subs = (await p.find({ collection: "store-subscriptions", limit: 0, pagination: false, depth: 0, overrideAccess: true, req })).docs as unknown as { status?: string; amount?: number; billingCycle?: string; currency?: string; store?: unknown; failedPayments?: number }[];
  const byStatus: Record<string, number> = {};
  for (const s of subs) byStatus[String(s.status)] = (byStatus[String(s.status)] ?? 0) + 1;
  // money in different currencies is never added together: one total per currency
  const mrr: Record<string, number> = {};
  for (const s of subs.filter((x) => x.status === "active" || x.status === "past_due")) {
    const cur = String(s.currency || "PKR").toUpperCase();
    mrr[cur] = (mrr[cur] ?? 0) + monthly(s);
  }
  const failing = subs.filter((s) => s.status === "past_due" || (Number(s.failedPayments) || 0) > 0).map((s) => storeIdOf(s.store));

  // gross order value per store over the last 30 days (orders that weren't cancelled / refused / returned)
  const orders = (await p.find({ collection: "orders", where: { and: [{ placedAt: { greater_than: since } }, { status: { not_in: ["cancelled", "refused", "returned"] } }] }, limit: 0, pagination: false, depth: 0, select: { store: true, total: true, currency: true }, overrideAccess: true, req })).docs as unknown as { store?: unknown; total?: number; currency?: string }[];
  const gmv = new Map<number, { orders: number; total: number; currency: string }>();
  const gmvByCurrency: Record<string, number> = {};
  for (const o of orders) {
    const cur = String(o.currency || "PKR").toUpperCase();
    gmvByCurrency[cur] = (gmvByCurrency[cur] ?? 0) + (Number(o.total) || 0);
    const s = storeIdOf(o.store);
    if (s == null) continue;
    const row = gmv.get(s) ?? { orders: 0, total: 0, currency: cur };
    row.orders++;
    row.total += Number(o.total) || 0;
    gmv.set(s, row);
  }
  const top = [...gmv.entries()].sort((a, b) => (a[1].currency === b[1].currency ? b[1].total - a[1].total : b[1].orders - a[1].orders)).slice(0, 10);
  const names = new Map(
    ((await p.find({ collection: "stores", where: { id: { in: [...new Set([...top.map(([id]) => id), ...failing.filter((x): x is number => x != null)])] } }, limit: 50, depth: 0, overrideAccess: true, req })).docs as unknown as StoreRow[]).map((s) => [Number(s.id), s.name ?? s.slug ?? `#${s.id}`]),
  );
  return {
    stores: { total: stores, active, draft, suspended, closed, newLast30Days: newStores },
    merchants,
    // per currency, e.g. { PKR: 45000, USD: 120 }
    subscriptions: { byStatus, mrr: Object.fromEntries(Object.entries(mrr).map(([c, v]) => [c, roundMoney(v, c)])) },
    failingPayments: failing.filter((x): x is number => x != null).map((id) => ({ id, name: names.get(id) ?? `#${id}` })),
    gmvLast30Days: { orders: orders.length, byCurrency: Object.fromEntries(Object.entries(gmvByCurrency).map(([c, v]) => [c, roundMoney(v, c)])) },
    // a store's orders are in its currency (ranked by order count when currencies differ)
    topStores: top.map(([id, v]) => ({ id, name: names.get(id) ?? `#${id}`, orders: v.orders, total: roundMoney(v.total, v.currency), currency: v.currency })),
    deadDeliveries,
  };
}

export type MonthRow = { month: string; storesCreated: number; orders: number; orderValue: Record<string, number>; planRevenue: Record<string, number> };

/**
 * The last `months` months, oldest first: new stores, orders and their value, plan payments collected – money per
 * currency (never added across currencies). Grouped in the database, so it stays quick with many orders.
 */
export async function historyFor(req: PayloadRequest, months = 12): Promise<MonthRow[]> {
  const [{ conn }, { sql }] = await Promise.all([import("../stock"), import("@payloadcms/db-postgres")]);
  const db = await conn(req.payload, req);
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  const from = start.toISOString();
  const [orders, invoices, stores] = await Promise.all([
    db.execute(sql`SELECT to_char(date_trunc('month', "placed_at"), 'YYYY-MM') AS m, upper(COALESCE("currency", 'PKR')) AS c, count(*)::int AS n, COALESCE(sum("total"), 0)::float AS v
      FROM "payload"."cms_orders" WHERE "placed_at" >= ${from} AND "status" NOT IN ('cancelled', 'refused', 'returned', 'awaiting-payment') GROUP BY 1, 2`),
    db.execute(sql`SELECT to_char(date_trunc('month', "paid_at"), 'YYYY-MM') AS m, upper(COALESCE("currency", 'PKR')) AS c, COALESCE(sum("amount"), 0)::float AS v
      FROM "payload"."cms_store_invoices" WHERE "status" = 'paid' AND "paid_at" >= ${from} GROUP BY 1, 2`),
    db.execute(sql`SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS m, count(*)::int AS n FROM "payload"."cms_stores" WHERE "created_at" >= ${from} GROUP BY 1`),
  ]);
  const rows: MonthRow[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setUTCMonth(start.getUTCMonth() + i);
    rows.push({ month: d.toISOString().slice(0, 7), storesCreated: 0, orders: 0, orderValue: {}, planRevenue: {} });
  }
  const at = (m: unknown) => rows.find((r) => r.month === String(m));
  for (const r of orders.rows as { m: string; c: string; n: number; v: number }[]) {
    const row = at(r.m);
    if (!row) continue;
    row.orders += Number(r.n);
    row.orderValue[r.c] = roundMoney((row.orderValue[r.c] ?? 0) + Number(r.v), r.c);
  }
  for (const r of invoices.rows as { m: string; c: string; v: number }[]) {
    const row = at(r.m);
    if (row) row.planRevenue[r.c] = roundMoney((row.planRevenue[r.c] ?? 0) + Number(r.v), r.c);
  }
  for (const r of stores.rows as { m: string; n: number }[]) {
    const row = at(r.m);
    if (row) row.storesCreated = Number(r.n);
  }
  return rows;
}

/**
 * Integrations across all stores: how many stores use each one, and the connections whose last check or sync failed
 * (store, integration, the error) – so support can help before a store notices. Never shows keys.
 */
export async function integrationsOverview(req: PayloadRequest) {
  const docs = (await req.payload.find({ collection: "integrations" as never, limit: 5000, pagination: false, depth: 0, select: { store: true, provider: true, category: true, enabled: true, status: true, lastError: true, updatedAt: true } as never, overrideAccess: true, req })).docs as unknown as { store?: unknown; provider: string; category?: string; enabled?: boolean; status?: string; lastError?: string | null; updatedAt?: string }[];
  const { integrationInfo } = await import("../../lib/integrations/catalog");
  const byProvider = new Map<string, { name: string; category: string; stores: number; on: number; failing: number }>();
  for (const d of docs) {
    const info = integrationInfo(d.provider);
    const row = byProvider.get(d.provider) ?? { name: info?.name ?? d.provider, category: info?.category ?? String(d.category ?? ""), stores: 0, on: 0, failing: 0 };
    row.stores++;
    if (d.enabled !== false) row.on++;
    if (d.status === "error") row.failing++;
    byProvider.set(d.provider, row);
  }
  const failing = docs.filter((d) => d.status === "error" && d.enabled !== false).slice(0, 50);
  const ids = [...new Set(failing.map((d) => storeIdOf(d.store)).filter((x): x is number => x != null))];
  const names = new Map(((await req.payload.find({ collection: "stores", where: { id: { in: ids } }, limit: 50, depth: 0, overrideAccess: true, req })).docs as unknown as StoreRow[]).map((st) => [Number(st.id), st.name ?? st.slug ?? `#${st.id}`]));
  return {
    connections: docs.length,
    providers: [...byProvider.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.stores - a.stores),
    needsAttention: failing.map((d) => ({ storeId: storeIdOf(d.store), store: names.get(storeIdOf(d.store) ?? -1) ?? `#${String(storeIdOf(d.store))}`, provider: integrationInfo(d.provider)?.name ?? d.provider, error: String(d.lastError ?? "").slice(0, 200), at: d.updatedAt ?? null })),
  };
}

const VIEW_AS_MINUTES = 30;
const VIEW_ROLES = new Set(["store_staff", "store_manager", "store_owner"]);
const ROLE_NAME: Record<string, string> = { store_staff: "Staff", store_manager: "Manager", store_owner: "Owner" };

/**
 * Support: a platform admin sees one store exactly as one of its roles for 30 minutes (to reproduce what a member of
 * that store's team sees) – POST { storeId, role, reason }. Nobody's sign-in is used; the admin's own rights are set
 * aside meanwhile. Recorded in the store's activity log and in Platform → Security events.
 */
const viewAs: Endpoint = {
  path: "/platform/view-as",
  method: "post",
  handler: async (req) => {
    const { isPlatformAdminUser } = await import("../tenancy");
    const u = req.user as (TenantUserLike & { id: number; email?: string }) | null;
    if (!u || !isPlatformAdminUser(u as never)) return bad("Platform admins only (with 2-step verification on).", 403);
    const body = (await req.json?.().catch(() => null)) as { storeId?: unknown; role?: unknown; reason?: unknown } | null;
    const storeId = Number(body?.storeId);
    const role = String(body?.role ?? "");
    const reason = String(body?.reason ?? "").trim().slice(0, 200);
    if (!VIEW_ROLES.has(role)) return bad("Choose Staff, Manager or Owner.");
    if (reason.length < 5) return bad("Say why (e.g. the support request) – it is written to the store's activity log.");
    const store = (await req.payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as StoreRow | null;
    if (!store) return bad("No such store.", 404);
    const until = new Date(Date.now() + VIEW_AS_MINUTES * 60_000).toISOString();
    await req.payload.update({ collection: "users", id: u.id, data: { supportView: { store: storeId, role, until, reason } } as never, overrideAccess: true, depth: 0 });
    await logActivity(req, { action: "update", entity: "stores", entityLabel: "Store", docId: String(storeId), title: store.name ?? `#${storeId}`, changes: [{ field: "support access", from: "", to: `ShopEngine support views this store as ${ROLE_NAME[role]} for ${VIEW_AS_MINUTES} minutes – ${reason}` }], storeId });
    const [{ recordSecurityEvent }, { ipFromHeaders }] = await Promise.all([import("../../lib/security-events"), import("../../lib/client-ip")]);
    await recordSecurityEvent(req.payload, { kind: "support-view", email: u.email, userId: u.id, ip: ipFromHeaders(req.headers), detail: `${store.name ?? `#${storeId}`} as ${ROLE_NAME[role]} – ${reason}` });
    return Response.json({ ok: true, until });
  },
};

const viewAsStop: Endpoint = {
  path: "/platform/view-as/stop",
  method: "post",
  handler: async (req) => {
    const { isPlatformAdminUser } = await import("../tenancy");
    const u = req.user as (TenantUserLike & { id: number }) | null;
    if (!u || !isPlatformAdminUser(u as never)) return bad("Platform admins only.", 403);
    await req.payload.update({ collection: "users", id: u.id, data: { supportView: null } as never, overrideAccess: true, depth: 0 });
    return Response.json({ ok: true });
  },
};

type TenantUserLike = { collection?: string; role?: string; platformRole?: string; twoFactor?: { enabled?: boolean } };

/** GET /cms-api/platform/history?months=12 – month by month (platform admins). */
const history: Endpoint = {
  path: "/platform/history",
  method: "get",
  handler: async (req) => {
    if (!(await getTenant(req)).platformAdmin) return bad("Platform admins only.", 403);
    const months = Math.min(36, Math.max(1, Number(new URL(req.url ?? "", "http://x").searchParams.get("months")) || 12));
    return Response.json({ months: await historyFor(req, months) });
  },
};

const overview: Endpoint = {
  path: "/platform/overview",
  method: "get",
  handler: async (req) => {
    if (!(await getTenant(req)).platformAdmin) return bad("Platform admins only.", 403);
    return Response.json(await overviewFor(req));
  },
};

/** Suspend / reactivate / close a store (platform admins), with a reason in the activity log. */
const setStatus: Endpoint = {
  path: "/platform/stores/:id/status",
  method: "post",
  handler: async (req) => {
    if (!(await getTenant(req)).platformAdmin) return bad("Platform admins only.", 403);
    const id = storeIdOf(req.routeParams?.id);
    const body = (await req.json?.().catch(() => null)) as { status?: string; reason?: string } | null;
    const status = String(body?.status ?? "");
    if (id == null || !["active", "suspended", "closed"].includes(status)) return bad("Choose active, suspended or closed.");
    const before = (await req.payload.findByID({ collection: "stores", id, depth: 0, overrideAccess: true, req }).catch(() => null)) as StoreRow | null;
    if (!before) return bad("Store not found.", 404);
    if (before.isDefault && status !== "active") return bad("The default store can't be suspended or closed.");
    await req.payload.update({ collection: "stores", id, data: { status } as never, overrideAccess: true, req, context: { skipActivity: true } });
    await logActivity(req, { action: "update", entity: "stores", entityLabel: "Store", docId: String(id), title: before.name ?? `#${id}`, changes: [{ field: "status", from: String(before.status), to: `${status}${body?.reason ? ` – ${String(body.reason).slice(0, 200)}` : ""}` }], storeId: id });
    return Response.json({ ok: true });
  },
};

export const platformEndpoints: Endpoint[] = [mine, switchStore, overview, history, setStatus, viewAs, viewAsStop];
