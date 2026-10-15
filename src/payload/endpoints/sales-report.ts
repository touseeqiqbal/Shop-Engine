import type { Endpoint, PayloadRequest } from "payload";
import { storeGate } from "./guard";
import { hasStoreRole } from "../tenancy";
import { storeLocaleOf } from "../store-locale";
import { roundMoney } from "../../lib/money";
import { addDays, dayIn, dayStart } from "../../lib/time";

/**
 * GET /cms-api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD&basis=booked|delivered   (owners and managers)
 *
 * One definition of a "sale", used everywhere:
 *  - Booked sales    = website orders that went ahead (confirmed, shipped, out for delivery, delivered) + shop-counter sales
 *  - Delivered sales = delivered website orders + shop-counter sales (money actually collected)
 *  - Never sales: pending / waiting for the customer's confirmation (shown as "open"), cancelled, refused (RTO), returned.
 * Profit (owners only) is counted on delivered sales: items − discount − cost of goods; "after refunds" also takes off
 * refunds paid in the period (by credit-note date) and adds back the cost of returned items put back in stock.
 * Cost = the cost saved on the line
 * when it was sold; for older lines the laptop's own cost (serial numbers) or today's product cost ("estimated").
 * Days are in the store's time zone (all stores: the default store's). Voided counter sales never count.
 */

type Doc = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : v == null ? null : Number(v));
/** A "YYYY-MM-DD" query value, or null. */
const dayParam = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null);

const BOOKED = new Set(["confirmed", "dispatched", "out-for-delivery", "delivered"]);
const OPEN = new Set(["pending", "awaiting-confirmation"]);
const METHOD_LABEL: Record<string, string> = { cod: "Cash on delivery", jazzcash: "JazzCash", easypaisa: "EasyPaisa", bank: "Bank transfer", card: "Card", cash: "Cash (counter)", other: "Wallet / other (counter)" };

type Group = { key: string; label: string; orders: number; qty: number; sales: number; cost: number; profit: number; costKnown: boolean };
type Line = { productId: number | null; title: string; qty: number; revenue: number; cost: number | null; estimated: boolean };
type Sale = { channel: "website" | "counter"; delivered: boolean; day: string; total: number; delivery: number; discount: number; city: string; payments: { method: string; amount: number; label?: string }[]; lines: Line[] };

export const salesReportEndpoint: Endpoint = {
  path: "/reports/sales",
  method: "get",
  handler: async (req: PayloadRequest) => {
    const gate = await storeGate(req, "store_manager", { allowAll: true, feature: "reports" });
    if (gate instanceof Response) return gate;
    const { inStore } = gate;
    // costs and profit: the store's owner (or a platform admin)
    const owner = gate.t.platformAdmin || hasStoreRole(gate.t, gate.store, "store_owner");
    const { payload } = req;
    const { timezone: tz, currency } = await storeLocaleOf(payload, gate.store, req);
    const url = new URL(req.url ?? "", "http://x");
    const today = dayIn(Date.now(), tz);
    const to = dayParam(url.searchParams.get("to")) ?? today;
    let from = dayParam(url.searchParams.get("from")) ?? addDays(to, -29);
    if (from > to) from = to;
    const basis = url.searchParams.get("basis") === "delivered" ? "delivered" : "booked";
    const start = new Date(dayStart(from, tz)).toISOString();
    const end = new Date(dayStart(addDays(to, 1), tz)).toISOString();

    const [ordersRes, posRes, refundsRes, catsRes, brandsRes] = await Promise.all([
      payload.find({ collection: "orders", where: { and: [{ placedAt: { greater_than_equal: start } }, { placedAt: { less_than: end } }, ...inStore] }, limit: 0, pagination: false, depth: 0, overrideAccess: true }),
      payload.find({ collection: "pos-sales", where: { and: [{ createdAt: { greater_than_equal: start } }, { createdAt: { less_than: end } }, { status: { equals: "completed" } }, ...inStore] }, limit: 0, pagination: false, depth: 0, overrideAccess: true }),
      // refunds belong to the day the credit note was made (not the day the return was last edited)
      payload.find({
        collection: "return-requests",
        where: {
          and: [
            ...inStore,
            { status: { equals: "refunded" } },
            { or: [{ and: [{ creditNoteDate: { greater_than_equal: start } }, { creditNoteDate: { less_than: end } }] }, { and: [{ creditNoteDate: { exists: false } }, { updatedAt: { greater_than_equal: start } }, { updatedAt: { less_than: end } }] }] },
          ],
        },
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: "categories", where: { and: inStore }, limit: 0, pagination: false, depth: 0, overrideAccess: true }),
      payload.find({ collection: "brands", where: { and: inStore }, limit: 0, pagination: false, depth: 0, overrideAccess: true }),
    ]);
    const orders = ordersRes.docs as unknown as Doc[];
    const posSales = posRes.docs as unknown as Doc[];

    // products, their category / brand / cost
    const productIds = new Set<number>();
    for (const o of [...orders, ...posSales]) for (const i of (Array.isArray(o.items) ? o.items : []) as Doc[]) if (relId(i.product)) productIds.add(relId(i.product)!);
    const products = new Map<number, Doc>(
      productIds.size
        ? ((await payload.find({ collection: "products", where: { id: { in: [...productIds] } }, limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as Doc[]).map((p) => [Number(p.id), p])
        : [],
    );
    const cats = new Map((catsRes.docs as unknown as Doc[]).map((c) => [Number(c.id), c]));
    const topCategory = (id: number | null) => {
      let c = id ? cats.get(id) : undefined;
      for (let hops = 0; c && relId(c.parent) && hops < 20; hops++) c = cats.get(relId(c.parent)!) ?? c;
      return c ? str(c.name) : "Uncategorised";
    };
    const brands = new Map((brandsRes.docs as unknown as Doc[]).map((b) => [Number(b.id), str(b.name)]));

    // exact cost of the laptops (serial numbers) that went out with each website order
    const unitCost = new Map<string, { cost: number; n: number }>();
    const goingAhead = orders.filter((o) => BOOKED.has(str(o.status)));
    if (goingAhead.length) {
      const units = (await payload.find({ collection: "units", where: { order: { in: goingAhead.map((o) => o.id) as number[] } }, limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
      for (const u of units) {
        if (u.costPrice == null) continue;
        const k = `${relId(u.order)}:${relId(u.product)}`;
        const e = unitCost.get(k) ?? { cost: 0, n: 0 };
        e.cost += num(u.costPrice);
        e.n++;
        unitCost.set(k, e);
      }
    }
    const lineCost = (saved: unknown, key: string | null, productId: number | null, qty: number): { cost: number | null; estimated: boolean } => {
      if (saved != null && saved !== "") return { cost: num(saved) * qty, estimated: false };
      const u = key ? unitCost.get(key) : undefined;
      if (u && u.n) return { cost: (u.cost / u.n) * qty, estimated: false };
      const p = productId ? products.get(productId) : undefined;
      return p?.costPrice != null ? { cost: num(p.costPrice) * qty, estimated: true } : { cost: null, estimated: false };
    };

    // ── classify ──
    const counts = { booked: 0, delivered: 0, open: 0, cancelled: 0, refused: 0, returned: 0 };
    const values = { booked: 0, delivered: 0, open: 0, cancelled: 0, refused: 0, returned: 0 };
    const all: Sale[] = []; // every sale that went ahead (website booked/delivered + counter)
    for (const o of orders) {
      const status = str(o.status);
      const total = num(o.total);
      const bucket = status === "delivered" ? "delivered" : BOOKED.has(status) ? "booked" : OPEN.has(status) ? "open" : status === "refused" ? "refused" : status === "returned" ? "returned" : "cancelled";
      if (bucket === "delivered") {
        counts.delivered++;
        values.delivered += total;
      }
      if (BOOKED.has(status)) {
        counts.booked++;
        values.booked += total;
      } else {
        counts[bucket as "open" | "cancelled" | "refused" | "returned"]++;
        values[bucket as "open" | "cancelled" | "refused" | "returned"] += total;
      }
      if (!BOOKED.has(status)) continue;
      all.push({
        channel: "website",
        delivered: status === "delivered",
        day: dayIn(Date.parse(str(o.placedAt)), tz),
        total,
        delivery: num(o.deliveryCharge),
        discount: num(o.discount),
        city: str((o.customer as Doc | undefined)?.city) || "Unknown",
        // a store's own method keeps the name it had when the order was placed
        payments: [{ method: str(o.paymentMethod) || "cod", amount: total, label: str(o.paymentMethodLabel) || undefined }],
        lines: ((Array.isArray(o.items) ? o.items : []) as Doc[]).map((i) => {
          const pid = relId(i.product);
          const qty = num(i.qty);
          const c = lineCost(i.unitCost, pid ? `${o.id}:${pid}` : null, pid, qty);
          return { productId: pid, title: str(i.title), qty, revenue: num(i.unitPrice) * qty, ...c };
        }),
      });
    }
    let counterTotal = 0;
    for (const s of posSales) {
      counterTotal += num(s.total);
      all.push({
        channel: "counter",
        delivered: true,
        day: dayIn(Date.parse(str(s.createdAt)), tz),
        total: num(s.total),
        delivery: 0,
        discount: num(s.discount),
        city: "Shop counter",
        payments: ((Array.isArray(s.payments) ? s.payments : []) as Doc[]).map((p) => ({ method: str(p.method), amount: num(p.amount) })),
        lines: ((Array.isArray(s.items) ? s.items : []) as Doc[]).map((i) => {
          const pid = relId(i.product);
          const qty = num(i.qty);
          const unit = relId(i.unit);
          const c = i.unitCost != null ? { cost: num(i.unitCost) * qty, estimated: false } : lineCost(null, null, pid, qty);
          return { productId: pid, title: str(i.title) || (unit ? `Unit #${unit}` : ""), qty, revenue: num(i.unitPrice) * qty, ...c };
        }),
      });
    }

    // breakdowns follow the chosen basis; profit is always on delivered sales (money actually collected)
    const sales = basis === "delivered" ? all.filter((s) => s.delivered) : all;

    // ── totals ──
    const refundDocs = refundsRes.docs as unknown as Doc[];
    const refunds = refundDocs.reduce((s, r) => s + num(r.refundAmount), 0);
    // cost of refunded items that went back on the shelf (the stock is worth its cost again)
    let restockedCost = 0;
    if (owner) {
      const back = refundDocs.filter((r) => r.restocked).flatMap((r) => (Array.isArray(r.items) ? (r.items as Doc[]) : []));
      const serials = back.map((i) => str(i.serial)).filter(Boolean);
      const unitCostBySerial = new Map(
        serials.length ? ((await payload.find({ collection: "units", where: { and: [{ serial: { in: serials } }, ...inStore] }, limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as Doc[]).map((u) => [str(u.serial), u.costPrice]) : [],
      );
      const missing = [...new Set(back.map((i) => relId(i.product)).filter((id): id is number => Boolean(id) && !products.has(id!)))];
      if (missing.length) for (const p of (await payload.find({ collection: "products", where: { id: { in: missing } }, limit: 0, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as Doc[]) products.set(Number(p.id), p);
      for (const i of back) {
        const c = i.serial && unitCostBySerial.get(str(i.serial)) != null ? num(unitCostBySerial.get(str(i.serial))) : num(products.get(relId(i.product) ?? -1)?.costPrice);
        restockedCost += c * (num(i.qty) || 1);
      }
    }
    let itemsRevenue = 0, discounts = 0, deliveryFees = 0, cost = 0, estimatedLines = 0, missingCostLines = 0, lines = 0;
    for (const s of all.filter((x) => x.delivered)) {
      discounts += s.discount;
      deliveryFees += s.delivery;
      for (const l of s.lines) {
        lines++;
        itemsRevenue += l.revenue;
        if (l.cost == null) missingCostLines++;
        else {
          cost += l.cost;
          if (l.estimated) estimatedLines++;
        }
      }
    }

    // ── breakdowns ──
    const groups = (keyOf: (s: Sale, l: Line) => [string, string]) => {
      const m = new Map<string, Group>();
      for (const s of sales) {
        const seen = new Set<string>();
        for (const l of s.lines) {
          const [key, label] = keyOf(s, l);
          const g = m.get(key) ?? { key, label, orders: 0, qty: 0, sales: 0, cost: 0, profit: 0, costKnown: true };
          if (!seen.has(key)) {
            g.orders++;
            seen.add(key);
          }
          g.qty += l.qty;
          g.sales += l.revenue;
          if (l.cost == null) g.costKnown = false;
          else g.cost += l.cost;
          m.set(key, g);
        }
      }
      return [...m.values()]
        .map((g) => ({ ...g, profit: g.sales - g.cost, ...(owner ? {} : { cost: 0, profit: 0, costKnown: false }) }))
        .sort((a, b) => b.sales - a.sales);
    };
    const byProduct = groups((_, l) => [String(l.productId ?? l.title), l.title || "(deleted product)"]);
    const byCategory = groups((_, l) => {
      const p = l.productId ? products.get(l.productId) : undefined;
      const name = topCategory(p ? relId(p.category) : null);
      return [name, name];
    });
    const byBrand = groups((_, l) => {
      const p = l.productId ? products.get(l.productId) : undefined;
      const name = (p && brands.get(relId(p.brand) ?? -1)) || "No brand";
      return [name, name];
    });

    const byCity = new Map<string, { key: string; label: string; orders: number; sales: number }>();
    const byPayment = new Map<string, { key: string; label: string; orders: number; sales: number }>();
    const byChannel = new Map<string, { key: string; label: string; orders: number; sales: number }>();
    const series = new Map<string, { day: string; orders: number; sales: number; counter: number }>();
    for (let d = from; d <= to && series.size < 400; d = addDays(d, 1)) series.set(d, { day: d, orders: 0, sales: 0, counter: 0 });
    const add = (m: Map<string, { key: string; label: string; orders: number; sales: number }>, key: string, label: string, amount: number, count = 1) => {
      const g = m.get(key) ?? { key, label, orders: 0, sales: 0 };
      g.orders += count;
      g.sales += amount;
      m.set(key, g);
    };
    for (const s of sales) {
      add(byCity, s.city, s.city, s.total);
      add(byChannel, s.channel, s.channel === "website" ? "Website" : "Shop counter", s.total);
      s.payments.forEach((p, i) => add(byPayment, p.method, METHOD_LABEL[p.method] ?? p.label ?? p.method, p.amount, i === 0 ? 1 : 0));
      const d = series.get(s.day);
      if (d) {
        d.orders++;
        d.sales += s.total;
        if (s.channel === "counter") d.counter += s.total;
      }
    }
    const sorted = (m: Map<string, { key: string; label: string; orders: number; sales: number }>) => [...m.values()].sort((a, b) => b.sales - a.sales);
    const totalSales = sales.reduce((s, x) => s + x.total, 0);

    return Response.json({
      range: { from, to },
      basis,
      owner,
      totals: {
        sales: totalSales,
        orders: sales.length,
        aov: sales.length ? roundMoney(totalSales / sales.length, currency) : 0,
        bookedSales: values.booked + counterTotal,
        deliveredSales: values.delivered + counterTotal,
        website: { booked: { count: counts.booked, value: values.booked }, delivered: { count: counts.delivered, value: values.delivered } },
        counter: { count: posSales.length, value: counterTotal },
        open: { count: counts.open, value: values.open },
        cancelled: { count: counts.cancelled, value: values.cancelled },
        refused: { count: counts.refused, value: values.refused },
        returned: { count: counts.returned, value: values.returned },
        refusalRate: counts.delivered + counts.refused ? Math.round((counts.refused / (counts.delivered + counts.refused)) * 1000) / 10 : 0,
        refunds,
        ...(owner
          ? {
              profit: {
                itemsRevenue,
                discounts,
                deliveryFees,
                cost,
                grossProfit: itemsRevenue - discounts - cost,
                refunds,
                restockedCost,
                netProfit: itemsRevenue - discounts - cost - refunds + restockedCost,
                margin: itemsRevenue - discounts > 0 ? Math.round(((itemsRevenue - discounts - cost) / (itemsRevenue - discounts)) * 1000) / 10 : 0,
                lines,
                estimatedLines,
                missingCostLines,
              },
            }
          : {}),
      },
      series: [...series.values()],
      byProduct: byProduct.slice(0, 200),
      byCategory,
      byBrand,
      byCity: sorted(byCity),
      byPayment: sorted(byPayment),
      byChannel: sorted(byChannel),
    });
  },
};
