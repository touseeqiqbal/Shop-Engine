import type { Endpoint } from "payload";
import { sameStoreAs, storeGate } from "./guard";
import { getStoreSettings } from "../store-settings";
import { storeIdOf } from "../tenancy";
import { storeLocaleOf } from "../store-locale";
import { addDays, dayIn, dayStart } from "../../lib/time";

/**
 * Order tools – the store's team, for the store being worked in.
 *   POST /cms-api/order-tools/resend-confirmation  { orderId }   re-send the confirm link / code
 *   GET  /cms-api/order-tools/rto?from=…&to=…                    refused-parcel (RTO) report by city, zone, courier, customer
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

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

/**
 * POST /cms-api/order-tools/ship { orderId, lines: [{ line, qty }], courier, trackingNumber }
 * Sends some (or all remaining) items: a shipment with its own courier / tracking. When everything is shipped the order
 * moves to "Dispatched"; until then it shows "Partly shipped" and the customer gets a message for each parcel.
 * (Booking with a connected courier: /cms-api/integration-tools/courier/book – same rules, src/payload/shipments.ts.)
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
    const { checkShippable, recordShipment } = await import("../shipments");
    const check = await checkShippable(d, body?.lines);
    if (!check.ok) return Response.json({ error: check.error }, { status: check.status });
    const courier = str(body?.courier).trim().slice(0, 60) || null;
    const trackingNumber = str(body?.trackingNumber).trim().slice(0, 80) || null;
    const r = await recordShipment(req.payload, req, d, check.want, { courier, trackingNumber });
    return Response.json({ ok: true, complete: r.complete });
  },
};

/** POST /cms-api/order-tools/shipment { orderId, index, status: "delivered" | "returned" | "cancelled" } – a parcel arrived / came back / was cancelled. */
const shipmentStatus: Endpoint = {
  path: "/order-tools/shipment",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff", { write: true });
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; index?: number; status?: string } | null;
    const d = (await req.payload.findByID({ collection: "orders", id: num(body?.orderId), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!d || !sameStoreAs(gate, d)) return Response.json({ error: "Order not found" }, { status: 404 });
    const status = str(body?.status);
    if (status !== "delivered" && status !== "cancelled" && status !== "returned") return Response.json({ error: "Only a parcel that is on its way can be marked delivered, returned or cancelled." }, { status: 400 });
    const { setShipmentStatus } = await import("../shipments");
    const r = await setShipmentStatus(req.payload, req, d, Number(body?.index), status);
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json({ ok: true, orderStatus: r.orderStatus });
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
    // days in the store's time zone (all stores: the default store's)
    const { timezone: tz, currency } = await storeLocaleOf(req.payload, gate.store, req);
    const today = dayIn(Date.now(), tz);
    const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null);
    const to = valid(url.searchParams.get("to")) ?? today;
    const from = valid(url.searchParams.get("from")) ?? addDays(to, -89);
    const [orders, shipping] = await Promise.all([
      req.payload.find({
        collection: "orders",
        where: {
          and: [
            { placedAt: { greater_than_equal: new Date(dayStart(from, tz)).toISOString() } },
            { placedAt: { less_than: new Date(dayStart(addDays(to, 1), tz)).toISOString() } },
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
    // a parcel sent free still cost a delivery: about Rs 250 for the original shop, elsewhere the store's standard charge
    const usualCharge = currency === "PKR" ? 250 : num((shipping as unknown as Doc | null)?.defaultCharge);
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
      const lost = st === "refused" ? Math.max(num(o.deliveryCharge), usualCharge) * 2 : 0;
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
