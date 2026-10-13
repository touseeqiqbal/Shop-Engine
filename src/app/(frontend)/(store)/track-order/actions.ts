"use server";
import { z } from "zod";
import { courierInfo, courierTrackingUrl } from "@/lib/couriers";
import { ORDER_NUMBER_EXAMPLE, ORDER_NUMBER_RE } from "@/lib/order-number";
import { rateLimit } from "@/lib/rate-limit";
import { findOrderForTracking } from "@/lib/repo/orders";
import type { OrderEvent, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";
import { normalizePkPhone } from "@/lib/utils";

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
  paymentStatus: PaymentStatus;
  courier: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

export type TrackState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: { order?: string; phone?: string }; ts: number }
  | { status: "found"; order: TrackedOrder; ts: number };

const schema = z.object({
  order: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ORDER_NUMBER_RE, `Order number looks like ${ORDER_NUMBER_EXAMPLE}`),
  phone: z.string().refine((v) => !!normalizePkPhone(v), "Enter the mobile number used at checkout"),
});

export async function trackOrder(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const ts = Date.now();
  const parsed = schema.safeParse({ order: String(fd.get("order") ?? ""), phone: String(fd.get("phone") ?? "") });
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

  const order = await findOrderForTracking(parsed.data.order, normalizePkPhone(parsed.data.phone)!).catch(() => null);
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
      paymentStatus: order.paymentStatus,
      courier: order.courier ?? null,
      courierName: courierInfo(order.courier)?.name ?? order.courier ?? null,
      trackingNumber: order.trackingNumber ?? null,
      trackingUrl: courierTrackingUrl(order.courier, order.trackingNumber),
    },
  };
}
