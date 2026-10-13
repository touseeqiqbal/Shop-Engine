import type { Endpoint } from "payload";
import { isStaffUser } from "../access";

/**
 * Order tools – staff only.
 *   POST /cms-api/order-tools/resend-confirmation  { orderId }   re-send the confirm link / code
 *   GET  /cms-api/order-tools/rto?from=…&to=…                    refused-parcel (RTO) report by city, zone, courier, customer
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const PKT = 5 * 3600e3;
const pktDay = (t: number) => new Date(t + PKT).toISOString().slice(0, 10);
const pktStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - PKT;
const deny = () => Response.json({ error: "Please sign in as staff." }, { status: 401 });

const resend: Endpoint = {
  path: "/order-tools/resend-confirmation",
  method: "post",
  handler: async (req) => {
    if (!isStaffUser(req.user as never)) return deny();
    const body = (await req.json?.().catch(() => null)) as { orderId?: number } | null;
    const d = (await req.payload.findByID({ collection: "orders", id: num(body?.orderId), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    if (!d) return Response.json({ error: "Order not found" }, { status: 404 });
    if (d.status !== "awaiting-confirmation") return Response.json({ error: "This order isn't waiting for the customer." }, { status: 400 });
    const [{ notifyConfirmationReminder }, { toOrder }] = await Promise.all([import("../../lib/notify"), import("../../lib/cms/sales")]);
    await notifyConfirmationReminder(toOrder(d));
    return Response.json({ ok: true });
  },
};

type Row = { key: string; label: string; delivered: number; refused: number; returned: number; lost: number };

const rto: Endpoint = {
  path: "/order-tools/rto",
  method: "get",
  handler: async (req) => {
    if (!isStaffUser(req.user as never)) return deny();
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
          ],
        },
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: { status: true, customer: true, courier: true, total: true, deliveryCharge: true } as never,
      }),
      req.payload.findGlobal({ slug: "shipping", depth: 0, overrideAccess: true }).catch(() => null),
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

export const orderToolEndpoints: Endpoint[] = [resend, rto];
