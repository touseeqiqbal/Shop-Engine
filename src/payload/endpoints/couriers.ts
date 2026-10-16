import type { Endpoint, PayloadRequest } from "payload";
import { sameStoreAs, storeGate } from "./guard";

/**
 * Courier bookings from the order panel (the store's connected couriers, /cms → Integrations):
 *   GET  /cms-api/integration-tools/couriers                                  connected couriers
 *   GET  /cms-api/integration-tools/courier/options?provider=&orderId=&lines= booking choices (city, service …) + defaults
 *   POST /cms-api/integration-tools/courier/book    { orderId, provider, lines, weightKg, pieces, codAmount, options }
 *   GET  /cms-api/integration-tools/courier/label?orderId=&index=             the parcel's label (link or PDF)
 *   POST /cms-api/integration-tools/courier/cancel  { orderId, index }
 *   POST /cms-api/integration-tools/courier/track   { orderId, index }        ask the courier now
 */

type Doc = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

async function message(e: unknown) {
  const { IntegrationError } = await import("../../lib/integrations/types");
  return e instanceof IntegrationError ? { error: e.message, status: e.status >= 500 ? 502 : e.status } : { error: `Something went wrong: ${(e as Error)?.message ?? "unknown error"}`, status: 500 };
}

async function orderFor(req: PayloadRequest, id: unknown, write = false) {
  const gate = await storeGate(req, "store_staff", { write });
  if (gate instanceof Response) return gate;
  const order = (await req.payload.findByID({ collection: "orders", id: num(id), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
  if (!order || !sameStoreAs(gate, order)) return Response.json({ error: "Order not found" }, { status: 404 });
  return { gate, order };
}

const list: Endpoint = {
  path: "/integration-tools/couriers",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_staff");
    if (gate instanceof Response) return gate;
    const { storeCouriers } = await import("../../lib/integrations/couriers");
    return Response.json({ couriers: await storeCouriers(req.payload, gate.store!) });
  },
};

const options: Endpoint = {
  path: "/integration-tools/courier/options",
  method: "get",
  handler: async (req) => {
    const url = new URL(req.url ?? "", "http://x");
    const r = await orderFor(req, url.searchParams.get("orderId"));
    if (r instanceof Response) return r;
    try {
      const { courierOf, parcelFor, matchCity } = await import("../../lib/integrations/couriers");
      const { checkShippable } = await import("../shipments");
      const lines = (JSON.parse(url.searchParams.get("lines") || "[]") as { line?: number; qty?: number }[]) ?? [];
      const check = await checkShippable(r.order, lines);
      if (!check.ok) return Response.json({ error: check.error }, { status: check.status });
      const { ctx, courier } = await courierOf(req.payload, r.gate.store!, url.searchParams.get("provider") ?? "");
      const parcel = await parcelFor(req.payload, r.order, check.want, {});
      const fields = courier.bookingOptions ? await courier.bookingOptions(ctx) : [];
      // the courier's city that matches the customer's, picked for the team
      for (const f of fields) if (f.key === "city" && !f.default) f.default = matchCity(f.options.map((o) => ({ name: o.label, value: o.value })), parcel.customer.city)?.value;
      return Response.json({ courier: courier.name, fields, parcel: { weightKg: parcel.weightKg, pieces: parcel.pieces, codAmount: parcel.codAmount, currency: parcel.currency, city: parcel.customer.city } });
    } catch (e) {
      const m = await message(e);
      return Response.json({ error: m.error }, { status: m.status });
    }
  },
};

const book: Endpoint = {
  path: "/integration-tools/courier/book",
  method: "post",
  handler: async (req) => {
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; provider?: string; lines?: { line?: number; qty?: number }[]; weightKg?: number; pieces?: number; codAmount?: number; options?: Record<string, string> } | null;
    const r = await orderFor(req, body?.orderId, true);
    if (r instanceof Response) return r;
    try {
      const { bookWithCourier } = await import("../../lib/integrations/couriers");
      const out = await bookWithCourier(req.payload, req, r.order, {
        provider: String(body?.provider ?? ""),
        lines: body?.lines ?? [],
        weightKg: body?.weightKg != null ? num(body.weightKg) : undefined,
        pieces: body?.pieces != null ? num(body.pieces) : undefined,
        codAmount: body?.codAmount != null ? num(body.codAmount) : undefined,
        options: Object.fromEntries(Object.entries(body?.options ?? {}).map(([k, v]) => [k, String(v).slice(0, 200)])),
      });
      return Response.json({ ok: true, complete: out.complete, trackingNumber: out.shipment.trackingNumber, courier: out.shipment.courier });
    } catch (e) {
      const m = await message(e);
      return Response.json({ error: m.error }, { status: m.status });
    }
  },
};

const label: Endpoint = {
  path: "/integration-tools/courier/label",
  method: "get",
  handler: async (req) => {
    const url = new URL(req.url ?? "", "http://x");
    const r = await orderFor(req, url.searchParams.get("orderId"));
    if (r instanceof Response) return r;
    try {
      const { courierLabel } = await import("../../lib/integrations/couriers");
      const out = await courierLabel(req.payload, r.order, num(url.searchParams.get("index")));
      if ("url" in out) return Response.redirect(out.url, 302);
      return new Response(new Uint8Array(out.pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="label-${String(r.order.orderNumber ?? "order")}.pdf"`, "cache-control": "private, no-store" } });
    } catch (e) {
      const m = await message(e);
      return Response.json({ error: m.error }, { status: m.status });
    }
  },
};

const cancel: Endpoint = {
  path: "/integration-tools/courier/cancel",
  method: "post",
  handler: async (req) => {
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; index?: number } | null;
    const r = await orderFor(req, body?.orderId, true);
    if (r instanceof Response) return r;
    try {
      const { cancelCourierBooking } = await import("../../lib/integrations/couriers");
      const out = await cancelCourierBooking(req.payload, req, r.order, num(body?.index));
      if (!out.ok) return Response.json({ error: out.error }, { status: out.status });
      return Response.json({ ok: true });
    } catch (e) {
      const m = await message(e);
      return Response.json({ error: m.error }, { status: m.status });
    }
  },
};

const track: Endpoint = {
  path: "/integration-tools/courier/track",
  method: "post",
  handler: async (req) => {
    const body = (await req.json?.().catch(() => null)) as { orderId?: number; index?: number } | null;
    const r = await orderFor(req, body?.orderId, true);
    if (r instanceof Response) return r;
    try {
      const { syncOne } = await import("../../lib/integrations/couriers");
      return Response.json({ ok: true, result: await syncOne(req.payload, Number(r.order.id), num(body?.index)) });
    } catch (e) {
      const m = await message(e);
      return Response.json({ error: m.error }, { status: m.status });
    }
  },
};

export const courierEndpoints: Endpoint[] = [list, options, book, label, cancel, track];
