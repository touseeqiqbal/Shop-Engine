import type { Payload, PayloadRequest } from "payload";
import { shippedPerLine, type ShipmentRow } from "./collections/content";
import { storeIdOf } from "./tenancy";

/**
 * Parcels of an order (the `shipments` array): sending some or all items, and a parcel arriving, coming back or being
 * cancelled. Used by the order panel (/cms-api/order-tools/…), courier bookings and courier tracking
 * (lib/integrations/couriers.ts) – the same rules for all of them.
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const SHIPPABLE = new Set(["confirmed", "dispatched", "out-for-delivery"]);

type Fail = { ok: false; error: string; status: number };

/** Checks a request to send these lines of the order; returns what can go, or why not. */
export async function checkShippable(order: Doc, lines: { line?: number; qty?: number }[] | undefined): Promise<{ ok: true; want: Map<number, number> } | Fail> {
  if (!SHIPPABLE.has(str(order.status))) return { ok: false, error: "Confirm the order before shipping it.", status: 400 };
  const { paymentBlocksShipping } = await import("../lib/order-money");
  if (paymentBlocksShipping({ paymentMethod: str(order.paymentMethod), paymentStatus: str(order.paymentStatus) })) return { ok: false, error: "Approve the online payment before shipping.", status: 400 };
  const items = (Array.isArray(order.items) ? order.items : []) as Doc[];
  const shipped = shippedPerLine((Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[]);
  const want = new Map<number, number>();
  for (const l of lines ?? []) {
    const line = Number(l.line);
    const qty = Math.floor(Number(l.qty));
    if (!Number.isInteger(line) || !items[line] || !(qty > 0)) return { ok: false, error: "Choose the items and how many to send.", status: 400 };
    want.set(line, (want.get(line) ?? 0) + qty);
  }
  if (!want.size) return { ok: false, error: "Choose the items to send.", status: 400 };
  for (const [line, qty] of want) {
    const left = num(items[line].qty) - (shipped.get(line) ?? 0);
    if (qty > left) return { ok: false, error: `Only ${left} of “${str(items[line].title)}” left to send.`, status: 400 };
  }
  return { ok: true, want };
}

/**
 * Records a parcel: the order moves to "Dispatched" once everything has been sent; until then the customer gets a
 * message for each parcel.
 */
export async function recordShipment(payload: Payload, req: PayloadRequest | undefined, order: Doc, want: Map<number, number>, parcel: Omit<ShipmentRow, "items" | "status" | "shippedAt" | "deliveredAt">): Promise<{ ok: true; complete: boolean; shipment: ShipmentRow }> {
  const items = (Array.isArray(order.items) ? order.items : []) as Doc[];
  const shipments = (Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[];
  const shipped = shippedPerLine(shipments);
  const shipment: ShipmentRow = { items: [...want].map(([line, qty]) => ({ line, qty, title: str(items[line].title) })), status: "shipped", shippedAt: new Date().toISOString(), deliveredAt: null, ...parcel };
  for (const [line, qty] of want) shipped.set(line, (shipped.get(line) ?? 0) + qty);
  const everything = items.every((it, i) => (shipped.get(i) ?? 0) >= num(it.qty));
  const nextStatus = everything && str(order.status) === "confirmed" ? "dispatched" : str(order.status);
  await payload.update({
    collection: "orders",
    id: Number(order.id),
    data: { shipments: [...shipments, shipment], ...(parcel.courier ? { courier: parcel.courier } : {}), ...(parcel.trackingNumber ? { trackingNumber: parcel.trackingNumber } : {}), status: nextStatus } as never,
    overrideAccess: true,
    ...(req ? { req } : {}),
    context: { expectStatus: str(order.status) },
  });
  // a parcel of a partly shipped order: its own message (the last one is announced by "Dispatched")
  if (nextStatus === str(order.status)) {
    const { queueNotification } = await import("../lib/notify");
    await queueNotification(payload, "shipment", storeIdOf(order.store), { orderId: order.id, shipment }, { dedupeKey: `shipment:${String(order.id)}:${shipments.length}` });
  }
  return { ok: true, complete: everything, shipment };
}

/**
 * A parcel arrived, came back or was cancelled (by staff, or reported by the courier). When every parcel has arrived the
 * order is "Delivered"; when every parcel came back (none delivered) it is "Refused" (RTO).
 */
export async function setShipmentStatus(
  payload: Payload,
  req: PayloadRequest | undefined,
  order: Doc,
  index: number,
  status: "delivered" | "cancelled" | "returned",
  extra: Partial<ShipmentRow> = {},
  note?: string,
): Promise<{ ok: true; orderStatus: string } | Fail> {
  const shipments = (Array.isArray(order.shipments) ? order.shipments : []) as ShipmentRow[];
  if (!shipments[index] || shipments[index].status !== "shipped") return { ok: false, error: "Only a parcel that is on its way can be marked delivered, returned or cancelled.", status: 400 };
  const next = shipments.map((s, k) => (k === index ? { ...s, ...extra, status, deliveredAt: status === "delivered" ? new Date().toISOString() : (s.deliveredAt ?? null) } : s));
  const items = (Array.isArray(order.items) ? order.items : []) as Doc[];
  const shipped = shippedPerLine(next);
  const allShipped = items.every((it, k) => (shipped.get(k) ?? 0) >= num(it.qty));
  const open = next.some((s) => s.status === "shipped");
  const anyDelivered = next.some((s) => s.status === "delivered");
  const anyReturned = next.some((s) => s.status === "returned");
  const orderStatus = str(order.status);
  let nextStatus = orderStatus;
  if (allShipped && !open && SHIPPABLE.has(orderStatus)) {
    if (anyDelivered) nextStatus = "delivered";
    else if (anyReturned && orderStatus !== "confirmed") nextStatus = "refused";
  }
  await payload.update({
    collection: "orders",
    id: Number(order.id),
    data: { shipments: next, status: nextStatus, ...(nextStatus !== orderStatus && note ? { history: [{ status: nextStatus, at: new Date().toISOString(), note }] } : {}) } as never,
    overrideAccess: true,
    ...(req ? { req } : {}),
    context: { expectStatus: orderStatus, ...(req ? {} : { system: true }) },
  });
  return { ok: true, orderStatus: nextStatus };
}
