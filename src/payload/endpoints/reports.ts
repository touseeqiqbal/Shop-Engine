import type { Endpoint, PayloadRequest } from "payload";
import { storeGate } from "./guard";
import { getStoreSettings } from "../store-settings";
import { isEmailConfigured } from "@/lib/mailer";
import { configWarnings } from "@/lib/config-warnings";

/**
 * GET /cms-api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD  (the store's team; a platform admin with no store chosen: all stores)
 * Everything the dashboard shows, computed from /cms data (incl. new vs returning customers and checkout completion). Sales = website orders that went ahead (confirmed, shipped,
 * out for delivery, delivered) + shop-counter sales – the same rule as Reports → Sales & profit. Pending / unconfirmed,
 * cancelled, refused (RTO) and returned orders are never sales.
 * Days are counted in Pakistan time (UTC+5).
 */

type Doc = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const PKT = 5 * 3600e3;
const SALE_STATUSES = new Set(["confirmed", "dispatched", "out-for-delivery", "delivered"]);
const isSale = (o: Doc) => SALE_STATUSES.has(str(o.status));

/** yyyy-mm-dd of a timestamp in Pakistan time */
const pktDay = (t: number) => new Date(t + PKT).toISOString().slice(0, 10);
/** Start (UTC ms) of a Pakistan-time day */
const pktStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - PKT;

function summarize(orders: Doc[]) {
  const counted = orders.filter(isSale);
  const revenue = counted.reduce((s, o) => s + num(o.total), 0);
  return { orders: orders.length, paidOrders: counted.length, revenue, aov: counted.length ? Math.round(revenue / counted.length) : 0 };
}

export const reportsEndpoint: Endpoint = {
  path: "/reports",
  method: "get",
  handler: async (req: PayloadRequest) => {
    const gate = await storeGate(req, "store_staff", { allowAll: true });
    if (gate instanceof Response) return gate;
    const { inStore, store, t } = gate;
    const url = new URL(req.url ?? "", "http://x");
    const today = pktDay(Date.now());
    const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") ?? "") ? url.searchParams.get("to")! : today;
    const defaultFrom = pktDay(pktStart(to) - 29 * 864e5);
    let from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") ?? "") ? url.searchParams.get("from")! : defaultFrom;
    // a reversed range is read the right way round; at most about 13 months at a time
    if (from > to) from = to;
    if (pktStart(to) - pktStart(from) > 400 * 864e5) from = pktDay(pktStart(to) - 400 * 864e5);
    const rangeStart = pktStart(from);
    const rangeEnd = pktStart(to) + 864e5;
    const kpiStart = Math.min(rangeStart, pktStart(today) - 29 * 864e5);
    const yesterdayStart = pktStart(today) - 864e5;

    const { payload } = req;
    const [ordersRes, pending, verify, lowStock, outStock, newWholesale, openMessages, toShip, activeProducts, setupDocs] = await Promise.all([
      payload.find({
        collection: "orders",
        where: { and: [{ placedAt: { greater_than_equal: new Date(kpiStart).toISOString() } }, ...inStore] },
        limit: 0,
        pagination: false,
        depth: 0,
        sort: "-placedAt",
        overrideAccess: true,
        select: { orderNumber: true, status: true, total: true, placedAt: true, paymentMethod: true, paymentStatus: true, customer: true, items: true } as never,
      }),
      payload.count({ collection: "orders", where: { and: [{ status: { equals: "pending" } }, ...inStore] }, overrideAccess: true }),
      payload.count({ collection: "orders", where: { and: [{ paymentStatus: { equals: "awaiting-verification" } }, ...inStore] }, overrideAccess: true }),
      payload.find({ collection: "products", where: { and: [{ status: { equals: "active" } }, { stockStatus: { equals: "low" } }, ...inStore] }, limit: 8, depth: 0, sort: "stock", overrideAccess: true, select: { title: true, stock: true, sku: true } as never }),
      payload.find({ collection: "products", where: { and: [{ status: { equals: "active" } }, { stockStatus: { equals: "out" } }, ...inStore] }, limit: 8, depth: 0, overrideAccess: true, select: { title: true, sku: true } as never }),
      payload.count({ collection: "wholesale-inquiries", where: { and: [{ status: { equals: "new" } }, ...inStore] }, overrideAccess: true }),
      payload.count({ collection: "contact-messages", where: { and: [{ handled: { not_equals: true } }, ...inStore] }, overrideAccess: true }),
      payload.count({ collection: "orders", where: { and: [{ status: { equals: "confirmed" } }, ...inStore] }, overrideAccess: true }),
      // products that need photos (fewer than 3) or details (no short description / specs)
      payload.find({ collection: "products", where: { and: [{ status: { equals: "active" } }, ...inStore] }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { images: true, shortDescription: true, specs: true } as never }),
      Promise.all([
        getStoreSettings(payload, "theme-settings", store, { req }),
        getStoreSettings(payload, "shipping", store, { req }),
        getStoreSettings(payload, "payments", store, { req }),
        payload.find({ collection: "pages", where: { and: [{ slug: { equals: "home" } }, ...inStore] }, limit: 1, depth: 0, overrideAccess: true, draft: true }),
        getStoreSettings(payload, "seo-settings", store, { req }),
        payload.count({ collection: "products", where: { and: inStore }, overrideAccess: true }),
      ]),
    ]);
    const missingInfo = (activeProducts.docs as Doc[]).filter(
      (p) => (Array.isArray(p.images) ? p.images.length : 0) < 3 || !str(p.shortDescription) || !(Array.isArray(p.specs) && p.specs.length)
    ).length;
    const [themeG, shipG, payG, homePages, seoG, productCount] = setupDocs as unknown as [Doc, Doc, Doc, { docs: Doc[] }, Doc, { totalDocs: number }];
    const home = homePages.docs[0];
    const settings = (page: string) => (store == null ? `/cms/globals/${page}` : `/cms/settings/${page}`);
    const setup = [
      { key: "logo", label: "Add your logo", done: Boolean(themeG.logoDark), href: settings("theme-settings") },
      { key: "delivery", label: "Set delivery prices", done: Boolean(shipG.updatedAt), href: settings("shipping") },
      { key: "payments", label: "Add payment details", done: Boolean(payG.updatedAt), href: settings("payments") },
      { key: "product", label: "Add your first product", done: productCount.totalDocs > 0, href: "/cms/collections/products/create" },
      { key: "home", label: "Edit your home page", done: Boolean(home && str(home.updatedAt) !== str(home.createdAt)), href: home ? `/cms/collections/pages/${home.id}` : "/cms/collections/pages" },
      { key: "email", label: "Connect your shop email", done: isEmailConfigured(), href: settings("notifications") },
      { key: "analytics", label: "Add Google Analytics", done: Boolean(str(seoG.ga4Id)), href: settings("seo-settings") },
    ];
    // shop-counter sales count as sales too (shown as city "Shop counter", payment "cash / counter")
    const counter = ((await payload.find({ collection: "pos-sales", where: { and: [{ createdAt: { greater_than_equal: new Date(kpiStart).toISOString() } }, { status: { equals: "completed" } }, ...inStore] }, limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as Doc[]).map(
      (s) => ({ status: "delivered", total: s.total, placedAt: s.createdAt, paymentMethod: "counter", customer: { city: "Shop counter" }, items: s.items }) as Doc,
    );
    const all = [...(ordersRes.docs as Doc[]), ...counter];
    const at = (o: Doc) => Date.parse(str(o.placedAt));
    const since = (ms: number) => all.filter((o) => at(o) >= ms);
    const inRange = all.filter((o) => at(o) >= rangeStart && at(o) < rangeEnd);

    // Daily series for the range
    const series: { day: string; revenue: number; orders: number }[] = [];
    for (let t = rangeStart; t < rangeEnd && series.length < 400; t += 864e5) series.push({ day: pktDay(t), revenue: 0, orders: 0 });
    const byDay = new Map(series.map((s) => [s.day, s]));
    for (const o of inRange) {
      const s = byDay.get(pktDay(at(o)));
      if (!s) continue;
      s.orders++;
      if (isSale(o)) s.revenue += num(o.total);
    }

    // Top products, cities, payment methods (range, revenue orders only)
    const products = new Map<string, { title: string; qty: number; revenue: number }>();
    const cities = new Map<string, { orders: number; revenue: number }>();
    const methods = new Map<string, { orders: number; revenue: number }>();
    for (const o of inRange) {
      if (!isSale(o)) continue;
      for (const i of (Array.isArray(o.items) ? o.items : []) as Doc[]) {
        const key = str(i.slug) || str(i.title);
        const p = products.get(key) ?? { title: str(i.title), qty: 0, revenue: 0 };
        p.qty += num(i.qty);
        p.revenue += num(i.qty) * num(i.unitPrice);
        products.set(key, p);
      }
      const city = str((o.customer as Doc | undefined)?.city) || "Unknown";
      const c = cities.get(city) ?? { orders: 0, revenue: 0 };
      c.orders++;
      c.revenue += num(o.total);
      cities.set(city, c);
      const m = methods.get(str(o.paymentMethod)) ?? { orders: 0, revenue: 0 };
      m.orders++;
      m.revenue += num(o.total);
      methods.set(str(o.paymentMethod), m);
    }
    // Customers in the range (website orders that went ahead, by phone): new vs returning – returning = ordered before
    // the range, or more than once in it
    const phoneKey = (o: Doc) => str((o.customer as Doc | undefined)?.phone).replace(/\D/g, "").replace(/^92/, "0");
    const online = inRange.filter((o) => isSale(o) && str(o.paymentMethod) !== "counter" && phoneKey(o));
    const ordersPer = new Map<string, number>();
    for (const o of online) ordersPer.set(phoneKey(o), (ordersPer.get(phoneKey(o)) ?? 0) + 1);
    const phones = [...ordersPer.keys()];
    const before = new Set<string>();
    for (let i = 0; i < phones.length; i += 400) {
      const chunk = phones.slice(i, i + 400);
      const formatted = chunk.flatMap((d) => (d.length === 11 ? [d, `${d.slice(0, 4)}-${d.slice(4)}`] : [d]));
      const earlier = (await payload.find({ collection: "orders", where: { and: [{ placedAt: { less_than: new Date(rangeStart).toISOString() } }, { status: { in: [...SALE_STATUSES] } }, { "customer.phone": { in: formatted } }, ...inStore] }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { customer: true } as never })).docs as Doc[];
      for (const o of earlier) before.add(phoneKey(o));
    }
    const returning = phones.filter((p) => before.has(p) || (ordersPer.get(p) ?? 0) > 1).length;
    const customers = { total: phones.length, returning, new: phones.length - returning, returningRate: phones.length ? Math.round((returning / phones.length) * 1000) / 10 : 0 };

    // Checkout completion: checkouts started in the range (saved when the shopper fills in their details) vs website
    // orders placed. Carts that became orders are closed, so started = orders placed + carts still not ordered.
    const [leftCarts, recoveredCarts] = await Promise.all([
      payload.count({ collection: "abandoned-carts", where: { and: [{ createdAt: { greater_than_equal: new Date(rangeStart).toISOString() } }, { createdAt: { less_than: new Date(rangeEnd).toISOString() } }, { status: { in: ["open", "reminded", "stopped"] } }, ...inStore] }, overrideAccess: true }),
      payload.count({ collection: "abandoned-carts", where: { and: [{ createdAt: { greater_than_equal: new Date(rangeStart).toISOString() } }, { createdAt: { less_than: new Date(rangeEnd).toISOString() } }, { status: { equals: "recovered" } }, ...inStore] }, overrideAccess: true }),
    ]);
    const placedOnline = inRange.filter((o) => str(o.paymentMethod) !== "counter").length;
    const started = placedOnline + leftCarts.totalDocs;
    const checkout = { started, completed: placedOnline, abandoned: leftCarts.totalDocs, recoveredByReminder: recoveredCarts.totalDocs, completionRate: started ? Math.round((placedOnline / started) * 1000) / 10 : 0 };

    const top = <T extends { revenue: number }>(m: Map<string, T>, n: number) =>
      [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, n).map(([key, v]) => ({ key, ...v }));

    return Response.json({
      range: { from, to },
      kpis: {
        today: summarize(since(pktStart(today))),
        yesterday: summarize(all.filter((o) => at(o) >= yesterdayStart && at(o) < pktStart(today))),
        last7: summarize(since(pktStart(today) - 6 * 864e5)),
        last30: summarize(since(pktStart(today) - 29 * 864e5)),
        range: summarize(inRange),
      },
      todo: {
        pendingOrders: pending.totalDocs,
        paymentsToVerify: verify.totalDocs,
        newWholesale: newWholesale.totalDocs,
        openMessages: openMessages.totalDocs,
        toShip: toShip.totalDocs,
        missingInfo,
        lowStock: (lowStock.docs as Doc[]).map((p) => ({ id: p.id, title: str(p.title), stock: num(p.stock), sku: str(p.sku) })),
        lowStockTotal: lowStock.totalDocs,
        outOfStock: (outStock.docs as Doc[]).map((p) => ({ id: p.id, title: str(p.title), sku: str(p.sku) })),
        outOfStockTotal: outStock.totalDocs,
      },
      series,
      customers,
      checkout,
      setup,
      // server set-up problems (site address, email…) are the platform's to fix – shown to platform admins only
      warnings: t.platformAdmin ? configWarnings() : [],
      greetingName: str((req.user as Doc | null)?.name).split(" ")[0] || "",
      topProducts: top(products, 8),
      cities: top(cities, 8),
      paymentMethods: top(methods, 6),
      recent: all.slice(0, 8).map((o) => ({ id: o.id, orderNumber: str(o.orderNumber), status: str(o.status), total: num(o.total), placedAt: str(o.placedAt), customer: str((o.customer as Doc | undefined)?.name), city: str((o.customer as Doc | undefined)?.city) })),
    });
  },
};
