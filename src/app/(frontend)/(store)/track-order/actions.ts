"use server";
import { z } from "zod";
import { courierInfo, courierTrackingUrl } from "@/lib/couriers";
import { ORDER_NUMBER_EXAMPLE, ORDER_NUMBER_RE } from "@/lib/order-number";
import { rateLimit } from "@/lib/rate-limit";
import { findOrderForTracking } from "@/lib/repo/orders";
import type { OrderEvent, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";
import { normalizePhone } from "@/lib/phone";
import { getStoreLocale } from "@/lib/store-locale";

/** Public, privacy-safe subset of an order (no address / email). */
export interface TrackedOrder {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  history: OrderEvent[];
  city: string;
  customerFirstName: string;
  items: { name: string; qty: number; image: string; url: string; upgrades: string[] }[];
  total: number;
  paymentMethod: PaymentMethod;
  /** the payment method's name when the order was placed (`paymentLabel(paymentMethod, paymentMethodLabel)`) */
  paymentMethodLabel: string | null;
  paymentStatus: PaymentStatus;
  courier: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  /** each parcel with its latest courier status (followed automatically for connected couriers) */
  parcels: { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; status: string; courierStatus: string | null; checkedAt: string | null }[];
}

/** The order's parcels as a shopper may see them (no amounts, no internal references). */
async function parcelsOf(orderId: string): Promise<TrackedOrder["parcels"]> {
  const { isCmsConfigured } = await import("@/lib/db/config");
  if (!isCmsConfigured || !/^\d+$/.test(orderId)) return [];
  const { payloadClient } = await import("@/lib/cms/catalog-source");
  const doc = (await (await payloadClient()).findByID({ collection: "orders", id: Number(orderId), depth: 0, overrideAccess: true }).catch(() => null)) as { shipments?: Record<string, unknown>[] } | null;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return (doc?.shipments ?? []).map((s) => ({
    courierName: courierInfo(str(s.courier) ?? undefined)?.name ?? str(s.courier),
    trackingNumber: str(s.trackingNumber),
    trackingUrl: courierTrackingUrl(str(s.courier) ?? undefined, str(s.trackingNumber) ?? undefined),
    status: str(s.status) ?? "shipped",
    courierStatus: str(s.courierStatus),
    checkedAt: str(s.lastTrackedAt),
  }));
}

export type TrackState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: { order?: string; phone?: string }; ts: number }
  | { status: "found"; order: TrackedOrder; ts: number };

/** `country` = the store's country (ISO code): phone numbers are checked for it. */
const schema = (country: string) =>
  z.object({
    order: z
      .string()
      .trim()
      .toUpperCase()
      .regex(ORDER_NUMBER_RE, `Order number looks like ${ORDER_NUMBER_EXAMPLE}`),
    phone: z.string().refine((v) => !!normalizePhone(v, country), "Enter the mobile number used at checkout"),
  });

export async function trackOrder(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const ts = Date.now();
  const { country } = await getStoreLocale();
  const parsed = schema(country).safeParse({ order: String(fd.get("order") ?? ""), phone: String(fd.get("phone") ?? "") });
  if (!parsed.success) {
    const fieldErrors: { order?: string; phone?: string } = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0] as "order" | "phone";
      fieldErrors[k] ??= i.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors, ts };
  }
  if (!(await rateLimit("track-order", 15, 10 * 60_000)))
    return { status: "error", message: "Too many lookups – please wait a few minutes and try again.", ts };

  const order = await findOrderForTracking(parsed.data.order, normalizePhone(parsed.data.phone, country)!).catch(() => null);
  if (!order)
    return {
      status: "error",
      message: "We couldn't find an order with that number and phone. Please double-check both, or contact us on WhatsApp.",
      ts,
    };

  return {
    status: "found",
    ts,
    order: {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      // status + time only: notes in the timeline are written for the team, not the customer
      history: order.history.map((h) => ({ status: h.status, at: h.at })),
      city: order.customer.city,
      customerFirstName: order.customer.name.split(" ")[0] ?? "",
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, image: i.image, url: i.url, upgrades: i.upgrades.map((u) => u.label) })),
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentMethodLabel: order.paymentMethodLabel ?? null,
      paymentStatus: order.paymentStatus,
      courier: order.courier ?? null,
      courierName: courierInfo(order.courier)?.name ?? order.courier ?? null,
      trackingNumber: order.trackingNumber ?? null,
      trackingUrl: courierTrackingUrl(order.courier, order.trackingNumber),
      parcels: await parcelsOf(String(order.id ?? "")).catch(() => []),
    },
  };
}
