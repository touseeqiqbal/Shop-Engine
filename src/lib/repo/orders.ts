import "server-only";
import { randomInt } from "node:crypto";
import { isCmsConfigured, isDatabaseConfigured } from "@/lib/db/config";
import { byStorefrontId, getOrderCms, listOrdersCms } from "@/lib/cms/sales";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Order, OrderStatus } from "@/lib/types";
import { fromDb, memoryDb, toDb } from "./db";

const toOrder = (r: object) => fromDb<Order>(r as Record<string, unknown>);
const orderData = (o: object) => toDb("orders", o) as Prisma.OrderUncheckedCreateInput;

/** Order data access (server-only). Orders live in Payload (/cms → Sales → Orders) since Phase 6. */

export const ORDER_STATUSES: OrderStatus[] = ["awaiting-payment", "awaiting-confirmation", "pending", "confirmed", "dispatched", "out-for-delivery", "delivered", "cancelled", "refused", "returned"];

/**
 * <PREFIX>-YYMMDD-NNNNNN – the prefix is the store's own (Settings → order prefix; the original shop: UTS).
 * Orders placed before Oct 2026 have 4 digits. Random part from a secure generator.
 */
export function generateOrderNumber(date = new Date(), prefix = "UTS") {
  const pkt = new Date(date.getTime() + 5 * 3600e3);
  const ymd = pkt.toISOString().slice(2, 10).replace(/-/g, "");
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "UTS";
  return `${p}-${ymd}-${randomInt(100000, 1000000)}`;
}

const digits = (s: string) => s.replace(/\D/g, "").replace(/^92/, "0");

/** Demo mode (in memory) and the legacy database only – with /cms orders are placed by placeOrderCms (one transaction). */
export async function insertOrder(order: Order): Promise<Order> {
  if (!isDatabaseConfigured) {
    memoryDb().orders.unshift(structuredClone(order));
    return order;
  }
  if (isCmsConfigured) throw new Error("insertOrder: use placeOrderCms with /cms");
  return toOrder(await prisma.order.create({ data: orderData(order) }));
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!isDatabaseConfigured) return structuredClone(memoryDb().orders.find((o) => o.id === id) ?? null);
  if (isCmsConfigured) return getOrderCms(byStorefrontId(id));
  const row = await prisma.order.findUnique({ where: { id } });
  return row ? toOrder(row) : null;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const n = orderNumber.trim().toUpperCase();
  if (!isDatabaseConfigured) return structuredClone(memoryDb().orders.find((o) => o.orderNumber === n) ?? null);
  if (isCmsConfigured) return getOrderCms({ orderNumber: { equals: n } });
  const row = await prisma.order.findUnique({ where: { orderNumber: n } });
  return row ? toOrder(row) : null;
}

/** Public tracking lookup – requires order number AND the phone used at checkout. */
export async function findOrderForTracking(orderNumber: string, phone: string): Promise<Order | null> {
  const order = await getOrderByNumber(orderNumber);
  if (!order || digits(order.customer.phone) !== digits(phone)) return null;
  return order;
}

export interface OrderListQuery {
  status?: OrderStatus | "all";
  q?: string; // order number, name, phone, city
  from?: string; // ISO date
  to?: string;
  page?: number;
  perPage?: number;
}

/** All orders (for exports & dashboard stats). */
export async function listAllOrders(): Promise<Order[]> {
  if (!isDatabaseConfigured) return structuredClone(memoryDb().orders);
  if (isCmsConfigured) return (await listOrdersCms({})).items;
  return (await prisma.order.findMany({ orderBy: { createdAt: "desc" } })).map(toOrder);
}

/** Orders placed with this phone (newest 50) – an indexed lookup, not a scan of every order. */
export async function listOrdersByPhone(phone: string): Promise<Order[]> {
  const d = digits(phone);
  if (isCmsConfigured) {
    const formatted = d.length === 11 ? `${d.slice(0, 4)}-${d.slice(4)}` : phone;
    return (await listOrdersCms({ or: [{ "customer.phone": { equals: formatted } }, { "customer.phone": { equals: d } }] }, { perPage: 50 })).items;
  }
  return (await listAllOrders()).filter((o) => digits(o.customer.phone) === d);
}

/** Orders whose checkout email is this address (emails are saved in lower case at checkout). */
export async function listOrdersByEmail(email: string): Promise<Order[]> {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  if (isCmsConfigured) return (await listOrdersCms({ "customer.email": { equals: e } }, { perPage: 100 })).items;
  return (await listAllOrders()).filter((o) => o.customer.email?.toLowerCase() === e);
}

export async function listOrdersByUser(userId: string): Promise<Order[]> {
  if (!isDatabaseConfigured) return structuredClone(memoryDb().orders.filter((o) => o.userId === userId));
  if (isCmsConfigured) {
    const { getUserCms } = await import("@/lib/cms/sales");
    const u = await getUserCms(userId);
    return u ? (await listOrdersCms({ user: { equals: u.docId } }, { perPage: 100 })).items : [];
  }
  return (await prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })).map(toOrder);
}
