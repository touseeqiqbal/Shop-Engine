import type { Endpoint } from "payload";
import { sameStoreAs, storeGate } from "./guard";
import { getStoreSettings } from "../store-settings";
import { storeIdOf } from "../tenancy";
import { shippedPerLine, type ShipmentRow } from "../collections/content";

/**
 * Order tools – the store's team, for the store being worked in.
 *   POST /cms-api/order-tools/resend-confirmation  { orderId }   re-send the confirm link / code
 *   GET  /cms-api/order-tools/rto?from=…&to=…                    refused-parcel (RTO) report by city, zone, courier, customer
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const PKT = 5 * 3600e3;
const pktDay = (t: number) => new Date(t + PKT).toISOString().slice(0, 10);
const pktStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - PKT;

const resend: Endpoint = {
  path: "/order-tools/resend-confirmation",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { write: true });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { orderId?: number } | null;
    const d = (await req.payload.findByID({ collection: "orders", id: num(body?.orderId), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!d || !sameStoreAs(gate, d)) return Response.json({ error: "Order not found" }, { status: 404 });
    // a customer is never messaged over and over: 3 reminders an hour per order
    const { rateLimitKey } = await import("@/lib/rate-limit");
    if (!rateLimitKey(`resend-confirmation:${String(d.id)}`, 3, 60 * 60_000)) return Response.json({ error: "Already sent 3 times in the last hour – please wait before sending again." }, { status: 429 });
    if (d.status !== "awaiting-confirmation") return Response.json({ error: "This order isn't waiting for the customer." }, { status: 400 });
    const { queueNotification } = await import("../../lib/notify");
    await queueNotification(req.payload, "confirm-reminder", gate.store ?? storeIdOf(d.store), { orderId: d.id }, { dedupeKey: `confirm-reminder:${String(d.id)}:${Date.now()}` });
    return Response.json({ ok: true });
  },
};

const SHIPPABLE = new Set(["confirmed", "dispatched", "out-for-delivery"]);

/**
 * POST /cms-api/order-tools/ship { orderId, lines: [{ line, qty }], courier, trackingNumber }
 * Sends some (or all remaining) items: a shipment with its own courier / tracking. When everything is shipped the order
 * moves to "Dispatched"; until then it shows "Partly shipped" and the customer gets a message for each parcel.
 */
const ship: Endpoint = {
  path: "/order-tools/ship",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { write: true });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; lines?: { line?: number; qty?: number }[]; courier?: string; trackingNumber?: string } | null;
    const d = (await req.payload.findByID({ collection: "orders", id: num(body?.orderId), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!d || !sameStoreAs(gate, d)) return Response.json({ error: "Order not found" }, { status: 404 });
    if (!SHIPPABLE.has(str(d.status))) return Response.json({ error: "Confirm the order before shipping it." }, { status: 400 });
    const { paymentBlocksShipping } = await import("../../lib/order-money");
    if (paymentBlocksShipping({ paymentMethod: str(d.paymentMethod), paymentStatus: str(d.paymentStatus) })) return Response.json({ error: "Approve the online payment before shipping." }, { status: 400 });
    const items = (Array.isArray(d.items) ? d.items : []) as Doc[];
    const shipments = (Array.isArray(d.shipments) ? d.shipments : []) as ShipmentRow[];
    const shipped = shippedPerLine(shipments);
    const want = new Map<number, number>();
    for (const l of body?.lines ?? []) {
      const line = Number(l.line);
      const qty = Math.floor(Number(l.qty));
      if (!Number.isInteger(line) || !items[line] || !(qty > 0)) return Response.json({ error: "Choose the items and how many to send." }, { status: 400 });
      want.set(line, (want.get(line) ?? 0) + qty);
    }
    if (!want.size) return Response.json({ error: "Choose the items to send." }, { status: 400 });
    for (const [line, qty] of want) {
      const left = num(items[line].qty) - (shipped.get(line) ?? 0);
      if (qty > left) return Response.json({ error: `Only ${left} of “${str(items[line].title)}” left to send.` }, { status: 400 });
    }
    const courier = str(body?.courier).trim().slice(0, 60) || null;
    const trackingNumber = str(body?.trackingNumber).trim().slice(0, 80) || null;
    const shipment: ShipmentRow = { items: [...want].map(([line, qty]) => ({ line, qty, title: str(items[line].title) })), courier, trackingNumber, status: "shipped", shippedAt: new Date().toISOString(), deliveredAt: null };
    for (const [line, qty] of want) shipped.set(line, (shipped.get(line) ?? 0) + qty);
    const everything = items.every((it, i) => (shipped.get(i) ?? 0) >= num(it.qty));
    const nextStatus = everything && str(d.status) === "confirmed" ? "dispatched" : str(d.status);
    await req.payload.update({
      collection: "orders",
      id: Number(d.id),
      data: { shipments: [...shipments, shipment], ...(courier ? { courier } : {}), ...(trackingNumber ? { trackingNumber } : {}), status: nextStatus } as never,
      overrideAccess: true,
      req,
      context: { expectStatus: str(d.status) },
    });
    // a parcel of a partly shipped order: its own message (the last one is announced by "Dispatched")
    if (nextStatus === str(d.status)) {
      const { queueNotification } = await import("../../lib/notify");
      await queueNotification(req.payload, "shipment", gate.store ?? storeIdOf(d.store), { orderId: d.id, shipment }, { dedupeKey: `shipment:${String(d.id)}:${shipments.length}` });
    }
    return Response.json({ ok: true, complete: everything });
  },
};

/** POST /cms-api/order-tools/shipment { orderId, index, status: "delivered" | "cancelled" } – a parcel arrived / was cancelled. */
const shipmentStatus: Endpoint = {
  path: "/order-tools/shipment",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { write: true });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; index?: number; status?: string } | null;
    const d = (await req.payload.findByID({ collection: "orders", id: num(body?.orderId), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!d || !sameStoreAs(gate, d)) return Response.json({ error: "Order not found" }, { status: 404 });
    const shipments = (Array.isArray(d.shipments) ? d.shipments : []) as ShipmentRow[];
    const i = Number(body?.index);
    const status = str(body?.status);
    if (!shipments[i] || !["delivered", "cancelled"].includes(status) || shipments[i].status !== "shipped") return Response.json({ error: "Only a parcel that is on its way can be marked delivered or cancelled." }, { status: 400 });
    const next = shipments.map((s, k) => (k === i ? { ...s, status, deliveredAt: status === "delivered" ? new Date().toISOString() : s.deliveredAt ?? null } : s));
    const items = (Array.isArray(d.items) ? d.items : []) as Doc[];
    const shipped = shippedPerLine(next);
    const allShipped = items.every((it, k) => (shipped.get(k) ?? 0) >= num(it.qty));
    const allDelivered = allShipped && next.every((s) => s.status !== "shipped");
    const orderStatus = str(d.status);
    const nextStatus = allDelivered && SHIPPABLE.has(orderStatus) ? "delivered" : orderStatus;
    await req.payload.update({ collection: "orders", id: Number(d.id), data: { shipments: next, status: nextStatus } as never, overrideAccess: true, req, context: { expectStatus: orderStatus } });
    return Response.json({ ok: true, orderStatus: nextStatus });
  },
};

type Row = { key: string; label: string; delivered: number; refused: number; returned: number; lost: number };

const rto: Endpoint = {
  path: "/order-tools/rto",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { allowAll: true });
    if (gate instanceof Response) return gate;
    const url = new URL(req.url ?? "", "http://x");
    const today = pktDay(Date.now());
    const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const to = valid(url.searchParams.get("to")) ?? today;
    const from = valid(url.searchParams.get("from")) ?? pktDay(pktStart(to) - 89 * 864e5);
    const [orders, shipping] = await Promise.all([
      req.payload.find({
        collection: "orders",
        where: {
          and: [
            { placedAt: { greater_than_equal: new Date(pktStart(from)).toISOString() } },
            { placedAt: { less_than: new Date(pktStart(to) + 864e5).toISOString() } },
            { status: { in: ["delivered", "refused", "returned"] } },
            ...gate.inStore,
          ],
        },
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: { status: true, customer: true, courier: true, total: true, deliveryCharge: true } as never,
      }),
      getStoreSettings(req.payload, "shipping", gate.store, { req }).catch(() => null),
    ]);
    const zones = ((shipping as unknown as Doc | null)?.zones ?? []) as { name?: string; rest?: boolean; cities?: string[] }[];
    const zoneOf = (city: string) => {
      const c = city.trim().toLowerCase();
      return zones.find((z) => !z.rest && (z.cities ?? []).some((x) => x.toLowerCase() === c))?.name ?? zones.find((z) => z.rest)?.name ?? "No zone";
    };

    const groups: Record<string, Map<string, Row>> = { city: new Map(), zone: new Map(), courier: new Map(), customer: new Map() };
    const totals = { delivered: 0, refused: 0, returned: 0, lost: 0 };
    for (const o of orders.docs as unknown as Doc[]) {
      const c = (o.customer ?? {}) as Doc;
      const st = str(o.status) as "delivered" | "refused" | "returned";
      // what a refused parcel costs you: delivery both ways is roughly the delivery charge twice (or your average if it was free)
      const lost = st === "refused" ? Math.max(num(o.deliveryCharge), 250) * 2 : 0;
      totals[st]++;
      totals.lost += lost;
      const keys: [string, string, string][] = [
        ["city", str(c.city) || "Unknown", str(c.city) || "Unknown"],
        ["zone", zoneOf(str(c.city)), zoneOf(str(c.city))],
        ["courier", str(o.courier) || "Not set", str(o.courier) || "Not set"],
        ["customer", str(c.phone).replace(/\D/g, ""), `${str(c.name)} · ${str(c.phone)}`],
      ];
      for (const [g, key, label] of keys) {
        const m = groups[g];
        const r = m.get(key) ?? { key, label, delivered: 0, refused: 0, returned: 0, lost: 0 };
        r[st]++;
        r.lost += lost;
        m.set(key, r);
      }
    }
    const rate = (r: { delivered: number; refused: number }) => (r.delivered + r.refused ? Math.round((r.refused / (r.delivered + r.refused)) * 1000) / 10 : 0);
    const out = (g: string, onlyWithRefusals = false) =>
      [...groups[g].values()]
        .filter((r) => !onlyWithRefusals || r.refused > 0)
        .map((r) => ({ ...r, rate: rate(r) }))
        .sort((a, b) => b.refused - a.refused || b.rate - a.rate)
        .slice(0, 50);
    return Response.json({ from, to, totals: { ...totals, rate: rate(totals) }, byCity: out("city"), byZone: out("zone"), byCourier: out("courier"), byCustomer: out("customer", true) });
  },
};

export const orderToolEndpoints: Endpoint[] = [resend, rto, ship, shipmentStatus];
