import type { Payload, PayloadRequest } from "payload";
import type { ShipmentRow } from "@/payload/collections/content";
import { connectionsOf, getConnection, rememberForConnection, type Connection } from "./server";
import { providerImpl } from "./providers";
import { IntegrationError, type CourierImpl, type Ctx, type ParcelInput, type TrackingStatus } from "./types";
import { log } from "@/lib/log";

/**
 * Courier integrations at work: booking a parcel from an order (the courier gives the tracking number and label),
 * printing the label, cancelling, and the background sync that follows each booked parcel (delivered / returned) and
 * the cash the courier collected (paid to the store or not).
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : Number(v));

export async function courierOf(payload: Payload, storeId: number, provider: string): Promise<{ ctx: Ctx; courier: CourierImpl; connection: Connection }> {
  const connection = await getConnection(payload, storeId, provider, { fresh: true });
  if (!connection) throw new IntegrationError("This courier isn’t connected (or is switched off) – see Integrations.");
  const courier = (await providerImpl(provider))?.courier;
  if (!courier) throw new IntegrationError("Unknown courier.");
  return { ctx: { payload, connection }, courier, connection };
}

/** The store's connected couriers (for the order panel). */
export async function storeCouriers(payload: Payload, storeId: number) {
  const list = (await connectionsOf(payload, storeId, { category: "shipping", fresh: true })).filter((c) => c.status === "connected");
  const out: { provider: string; name: string }[] = [];
  for (const c of list) {
    const courier = (await providerImpl(c.provider))?.courier;
    if (courier) out.push({ provider: c.provider, name: courier.name });
  }
  return out;
}

/** "Lahore" vs "LAHORE" vs "Lahore Cantt": the courier's city that best matches the customer's. */
export function matchCity<T extends { name: string }>(cities: T[], city: string): T | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
  const c = norm(city);
  if (!c) return null;
  return cities.find((x) => norm(x.name) === c) ?? cities.find((x) => norm(x.name).startsWith(c) || c.startsWith(norm(x.name))) ?? null;
}

/** A Pakistani mobile as couriers want it: 03XXXXXXXXX (other numbers: as typed, digits only). */
export function pkMobile(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) return `0${d.slice(2)}`;
  if (d.startsWith("0092")) return `0${d.slice(4)}`;
  return d;
}

/** The parcel for these lines of an order, with sensible defaults (weight from the products, cash to collect). */
export async function parcelFor(payload: Payload, order: Doc, want: Map<number, number>, input: { weightKg?: number; pieces?: number; codAmount?: number; options?: Record<string, string>; note?: string }): Promise<ParcelInput> {
  const items = (Array.isArray(order.items) ? order.items : []) as Doc[];
  const c = (order.customer ?? {}) as Doc;
  const lines = [...want].map(([line, qty]) => ({ it: items[line], qty }));
  let weight = num(input.weightKg);
  if (!(weight > 0)) {
    const ids = [...new Set(lines.map((l) => relId(l.it.product)).filter((x) => Number.isFinite(x) && x > 0))];
    const products = ids.length ? ((await payload.find({ collection: "products", where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true, select: { weight: true } as never })).docs as unknown as Doc[]) : [];
    weight = lines.reduce((sum, l) => sum + num(products.find((p) => Number(p.id) === relId(l.it.product))?.weight) * l.qty, 0) || 0.5;
  }
  const { amountToCollect } = await import("@/lib/order-money");
  const everythingLeft = num(order.total);
  const cod = input.codAmount != null && Number.isFinite(input.codAmount) ? Math.max(0, input.codAmount) : amountToCollect({ paymentMethod: str(order.paymentMethod), paymentDue: str(order.paymentDue), paymentStatus: str(order.paymentStatus), total: everythingLeft, advancePaid: num(order.advancePaid), giftCardAmount: num(order.giftCardAmount) });
  const store = (await payload.findByID({ collection: "stores", id: relId(order.store), depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
  return {
    orderId: Number(order.id),
    orderNumber: str(order.orderNumber),
    codAmount: Math.round(cod * 100) / 100,
    currency: (str(order.currency) || str(store?.currency) || "PKR").toUpperCase(),
    weightKg: Math.round(Math.max(0.1, weight) * 1000) / 1000,
    pieces: Math.max(1, Math.floor(num(input.pieces) || 1)),
    description: lines.map((l) => `${l.qty}× ${str(l.it.title)}`).join(", ").slice(0, 180) || `Order ${str(order.orderNumber)}`,
    items: lines.map((l) => ({ title: str(l.it.title), qty: l.qty, unitPrice: num(l.it.unitPrice), sku: str(l.it.sku) || null })),
    customer: { name: str(c.name), phone: str(c.phone), email: str(c.email) || null, address: str(c.address), city: str(c.city), area: str(c.area) || null, postalCode: str(c.postalCode) || null, country: (str(c.country) || str(store?.country) || "PK").toUpperCase() },
    note: input.note ?? (str(order.customerNote) || null),
    options: input.options ?? {},
  };
}

/** Books a parcel with a connected courier and records it on the order (same rules as sending it by hand). */
export async function bookWithCourier(payload: Payload, req: PayloadRequest | undefined, order: Doc, input: { provider: string; lines: { line?: number; qty?: number }[]; weightKg?: number; pieces?: number; codAmount?: number; options?: Record<string, string>; note?: string }) {
  const { checkShippable, recordShipment } = await import("@/payload/shipments");
  const check = await checkShippable(order, input.lines);
  if (!check.ok) throw new IntegrationError(check.error, check.status);
  const { ctx, courier } = await courierOf(payload, relId(order.store), input.provider);
  const parcel = await parcelFor(payload, order, check.want, input);
  const booking = await courier.book(ctx, parcel);
  log.info("courier.booked", { provider: input.provider, order: parcel.orderNumber, tracking: booking.trackingNumber });
  return recordShipment(payload, req, order, check.want, {
    courier: booking.courierName,
    trackingNumber: booking.trackingNumber,
    provider: input.provider,
    labelUrl: booking.labelUrl ?? null,
    courierRef: booking.courierRef ?? null,
    courierStatus: "Booked",
    lastTrackedAt: new Date().toISOString(),
    codAmount: parcel.codAmount,
    codStatus: parcel.codAmount > 0 ? "pending" : null,
  });
}

/** The parcel's label: a link to open, or the PDF itself. */
export async function courierLabel(payload: Payload, order: Doc, index: number): Promise<{ url: string } | { pdf: Buffer }> {
  const s = ((Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[])[index];
  if (!s?.trackingNumber) throw new IntegrationError("This parcel has no tracking number.");
  if (s.labelUrl?.startsWith("labels/")) {
    const { getObject } = await import("@/lib/storage");
    const obj = await getObject(s.labelUrl);
    if (!obj) throw new IntegrationError("The saved label is missing.");
    return { pdf: Buffer.from(await new Response(obj.body).arrayBuffer()) };
  }
  if (s.labelUrl) return { url: s.labelUrl };
  if (!s.provider) throw new IntegrationError("This parcel wasn’t booked through a courier integration.");
  const { ctx, courier } = await courierOf(payload, relId(order.store), s.provider);
  if (!courier.label) throw new IntegrationError(`${courier.name} doesn’t provide labels through its API – print it from your ${courier.name} account.`);
  return courier.label(ctx, s.trackingNumber);
}

/** Cancels the booking with the courier, then the parcel (its items can be sent again). */
export async function cancelCourierBooking(payload: Payload, req: PayloadRequest | undefined, order: Doc, index: number) {
  const s = ((Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[])[index];
  if (!s || s.status !== "shipped") throw new IntegrationError("Only a parcel that is on its way can be cancelled.");
  if (s.provider && s.trackingNumber) {
    const { ctx, courier } = await courierOf(payload, relId(order.store), s.provider);
    if (courier.cancel) await courier.cancel(ctx, s.courierRef || s.trackingNumber);
  }
  const { setShipmentStatus } = await import("@/payload/shipments");
  return setShipmentStatus(payload, req, order, index, "cancelled", { courierStatus: "Cancelled" });
}

const TRACK_EVERY = 90 * 60_000;
const REMITTANCE_EVERY = 12 * 3600_000;

/**
 * Housekeeping: asks each courier about its parcels that are still on the way (about every 90 minutes each), and about
 * the cash of delivered cash-on-delivery parcels (twice a day) until it is paid to the store.
 */
export async function syncCourierTracking(payload: Payload, limit = 40): Promise<{ checked: number; delivered: number; returned: number; remitted: number }> {
  const out = { checked: 0, delivered: 0, returned: 0, remitted: 0 };
  const orders = (
    await payload.find({
      collection: "orders",
      where: { and: [{ "shipments.provider": { exists: true } }, { status: { in: ["confirmed", "dispatched", "out-for-delivery", "delivered", "refused"] } }] },
      sort: "updatedAt",
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as Doc[];
  const now = Date.now();
  for (const order of orders) {
    if (out.checked >= limit) break;
    const shipments = (Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[];
    for (let i = 0; i < shipments.length && out.checked < limit; i++) {
      const s = shipments[i];
      if (!s.provider || !s.trackingNumber) continue;
      const tracked = s.lastTrackedAt ? Date.parse(s.lastTrackedAt) : 0;
      const wantsTracking = s.status === "shipped" && now - tracked > TRACK_EVERY;
      const wantsCash = (s.status === "delivered" || s.status === "returned") && s.codStatus === "pending" && now - tracked > REMITTANCE_EVERY;
      if (!wantsTracking && !wantsCash) continue;
      out.checked++;
      try {
        const r = await syncOne(payload, Number(order.id), i);
        if (r === "delivered") out.delivered++;
        if (r === "returned") out.returned++;
        if (r === "remitted") out.remitted++;
      } catch (e) {
        log.warn("courier.sync_failed", { order: str(order.orderNumber), provider: s.provider, error: (e as Error)?.message });
      }
    }
  }
  return out;
}

const STATUS_TEXT: Record<TrackingStatus, string> = {
  booked: "Booked – waiting for pickup",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  returned: "Returned to you",
  cancelled: "Cancelled by the courier",
  failed: "Delivery attempt failed",
  unknown: "No update yet",
};

/** One parcel: its latest courier status (and cash collected), applied to the order. */
export async function syncOne(payload: Payload, orderId: number, index: number): Promise<"delivered" | "returned" | "remitted" | "updated" | "unchanged"> {
  const order = (await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as unknown as Doc;
  const shipments = (Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[];
  const s = shipments[index];
  if (!s?.provider || !s.trackingNumber) return "unchanged";
  const { ctx, courier } = await courierOf(payload, relId(order.store), s.provider);
  const t = await courier.track(ctx, s.courierRef || s.trackingNumber);
  const statusText = t.detail ? `${STATUS_TEXT[t.status]} – ${t.detail}`.slice(0, 200) : STATUS_TEXT[t.status];
  const patch: Partial<ShipmentRow> = { courierStatus: statusText, lastTrackedAt: new Date().toISOString() };
  let result: "delivered" | "returned" | "remitted" | "updated" | "unchanged" = "updated";
  if (s.codStatus === "pending" && (t.codRemitted || (s.status !== "shipped" && courier.remittance))) {
    const cash = t.codRemitted ?? (courier.remittance ? await courier.remittance(ctx, s.trackingNumber) : null);
    if (cash) {
      Object.assign(patch, { codStatus: "remitted", codRemittedAt: cash.at ? new Date(cash.at).toISOString() : new Date().toISOString(), codRemittanceRef: cash.ref ?? null });
      result = "remitted";
    }
  }
  const { setShipmentStatus } = await import("@/payload/shipments");
  if (s.status === "shipped" && (t.status === "delivered" || t.status === "returned")) {
    const r = await setShipmentStatus(payload, undefined, order, index, t.status, patch, t.status === "delivered" ? `Delivered (reported by ${courier.name})` : `Returned by ${courier.name} (RTO)`);
    if (r.ok && patch.codStatus === "remitted") await markCodPaid(payload, orderId, courier.name);
    return r.ok ? t.status : "unchanged";
  }
  const next = shipments.map((x, k) => (k === index ? { ...x, ...patch } : x));
  // out for delivery: the order says so too
  const moveOut = t.status === "out_for_delivery" && str(order.status) === "dispatched";
  await payload.update({ collection: "orders", id: orderId, data: { shipments: next, ...(moveOut ? { status: "out-for-delivery" } : {}) } as never, overrideAccess: true, context: { system: true, expectStatus: str(order.status), skipActivity: true } });
  if (result === "remitted") await markCodPaid(payload, orderId, courier.name);
  return result;
}

/**
 * The courier has paid out the cash it collected: once every cash-on-delivery parcel of a delivered order is paid out,
 * the order is "Paid" (with a note) – no more checking courier statements by hand.
 */
export async function markCodPaid(payload: Payload, orderId: number, courierName: string): Promise<boolean> {
  const order = (await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })) as unknown as Doc;
  if (str(order.paymentDue) !== "on-delivery" || ["paid", "refunded", "partially-refunded"].includes(str(order.paymentStatus)) || str(order.status) !== "delivered") return false;
  const cod = ((Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[]).filter((x) => x.status === "delivered" && Number(x.codAmount) > 0);
  if (!cod.length || cod.some((x) => x.codStatus !== "remitted")) return false;
  const refs = cod.map((x) => x.codRemittanceRef).filter(Boolean).join(", ");
  await payload.update({
    collection: "orders",
    id: orderId,
    data: { paymentStatus: "paid", history: [{ status: "delivered", at: new Date().toISOString(), note: `Cash received from ${courierName}${refs ? ` (${refs})` : ""}` }] } as never,
    overrideAccess: true,
    context: { system: true, skipNotify: true, skipActivity: true },
  });
  return true;
}

/** Caches a courier's city list in its connection (refreshed daily). */
export async function cachedCities<T>(ctx: Ctx, key: string, load: () => Promise<T[]>): Promise<T[]> {
  const st = ctx.connection.state[key] as { at?: number; list?: T[] } | undefined;
  if (st?.list?.length && st.at && Date.now() - st.at < 24 * 3600_000) return st.list;
  const list = await load();
  if (list.length) await rememberForConnection(ctx.payload, ctx.connection, { state: { [key]: { at: Date.now(), list } } }).catch(() => undefined);
  return list;
}
