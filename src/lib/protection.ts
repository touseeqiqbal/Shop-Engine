import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { unstable_cache } from "next/cache";
import { inStore, payloadClient } from "@/lib/cms/catalog-source";
import { currentStoreId } from "@/lib/tenant";
import { isCmsConfigured } from "@/lib/db/config";
import type { OrderConfirmation, OrderRisk } from "@/lib/types";

/**
 * Fake-order protection (settings: /cms → Settings → Fake order protection).
 * - Risk score per phone number from its past orders (cancelled, refused / RTO, delivered) and the blocked list.
 * - Who must pay an advance instead of plain cash on delivery.
 * - Which COD orders the customer must confirm (link / code) before they are packed, and by when.
 */

export type ProtectionSettings = {
  confirmEnabled: boolean;
  confirmAbove: number;
  autoCancelHours: number;
  confirmZones: string[];
  skipWithAdvance: boolean;
  pointsCancelled: number;
  pointsRefused: number;
  pointsDelivered: number;
  mediumAt: number;
  highAt: number;
  advanceForHighRisk: boolean;
  advanceForMediumRisk: boolean;
  advanceCities: string[];
};

export const DEFAULT_PROTECTION: ProtectionSettings = {
  confirmEnabled: true,
  confirmAbove: 0,
  autoCancelHours: 24,
  confirmZones: [],
  skipWithAdvance: true,
  pointsCancelled: 15,
  pointsRefused: 35,
  pointsDelivered: 10,
  mediumAt: 30,
  highAt: 60,
  advanceForHighRisk: true,
  advanceForMediumRisk: false,
  advanceCities: [],
};

type Doc = Record<string, unknown>;
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const lower = (s: string) => s.trim().toLowerCase();

const protectionCached = unstable_cache(
  async (storeId: number | null): Promise<ProtectionSettings> => {
    if (!isCmsConfigured) return DEFAULT_PROTECTION;
    try {
      const payload = await payloadClient();
      const { getStoreSettings } = await import("@/payload/store-settings");
      const g = await getStoreSettings<Doc>(payload, "order-protection", storeId);
      if (!g.updatedAt) return DEFAULT_PROTECTION;
      const d = DEFAULT_PROTECTION;
      return {
        confirmEnabled: g.confirmEnabled !== false,
        confirmAbove: num(g.confirmAbove, d.confirmAbove),
        autoCancelHours: num(g.autoCancelHours, d.autoCancelHours),
        confirmZones: list(g.confirmZones),
        skipWithAdvance: g.skipWithAdvance !== false,
        pointsCancelled: num(g.pointsCancelled, d.pointsCancelled),
        pointsRefused: num(g.pointsRefused, d.pointsRefused),
        pointsDelivered: num(g.pointsDelivered, d.pointsDelivered),
        mediumAt: num(g.mediumAt, d.mediumAt),
        highAt: num(g.highAt, d.highAt),
        advanceForHighRisk: g.advanceForHighRisk !== false,
        advanceForMediumRisk: g.advanceForMediumRisk === true,
        advanceCities: list(g.advanceCities),
      };
    } catch (e) {
      console.error("[protection] settings:", e);
      return DEFAULT_PROTECTION;
    }
  },
  ["order-protection-v2"],
  { tags: ["settings"], revalidate: 60 }
);
/** A store's fake-order protection settings (the current store's when not given). */
export const getProtectionSettings = async (storeId?: number | null) => protectionCached(storeId === undefined ? await currentStoreId() : storeId);

/** 03001234567 form, whatever the input looked like */
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").replace(/^92/, "0");

/** Is this number on the blocked list (block completely)? A small lookup used when the full risk check fails. */
export async function isBlockedPhone(phone: string, storeId: number | null): Promise<boolean> {
  const payload = await payloadClient();
  const r = await payload.find({ collection: "blocked-phones", where: { and: [{ phone: { equals: phoneKey(phone) } }, { action: { not_equals: "advance" } }, inStore(storeId)] }, limit: 1, depth: 0, overrideAccess: true });
  return r.docs.length > 0;
}

/** Score a phone number from its order history at this store. `excludeOrderId` leaves the order being scored out. */
export async function riskFor(phone: string, s: ProtectionSettings, storeId: number | null, excludeOrderId?: number | string): Promise<OrderRisk & { blocked: null | { action: "block" | "advance"; reason: string } }> {
  const payload = await payloadClient();
  const key = phoneKey(phone);
  const formatted = key.length === 11 ? `${key.slice(0, 4)}-${key.slice(4)}` : phone;
  const [orders, blockedRes] = await Promise.all([
    payload.find({
      collection: "orders",
      where: { and: [{ or: [{ "customer.phone": { equals: formatted } }, { "customer.phone": { equals: key } }] }, inStore(storeId)] },
      limit: 200,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { status: true } as never,
    }),
    payload.find({ collection: "blocked-phones", where: { and: [{ phone: { equals: key } }, inStore(storeId)] }, limit: 1, depth: 0, overrideAccess: true }),
  ]);
  const docs = (orders.docs as unknown as Doc[]).filter((o) => excludeOrderId == null || String(o.id) !== String(excludeOrderId));
  const count = (st: string) => docs.filter((o) => o.status === st).length;
  const cancelled = count("cancelled");
  const refused = count("refused");
  const delivered = count("delivered");
  const b = blockedRes.docs[0] as unknown as Doc | undefined;
  const blocked = b ? { action: (b.action === "advance" ? "advance" : "block") as "block" | "advance", reason: String(b.reason ?? "") } : null;
  let score = Math.max(0, Math.min(100, cancelled * s.pointsCancelled + refused * s.pointsRefused - delivered * s.pointsDelivered));
  if (blocked) score = 100;
  const level: OrderRisk["level"] = score >= s.highAt ? "high" : score >= s.mediumAt ? "medium" : "low";
  const reasons = [
    blocked ? (blocked.action === "block" ? "On the blocked list" : "On the advance-only list") : "",
    refused ? `${refused} refused` : "",
    cancelled ? `${cancelled} cancelled` : "",
    delivered ? `${delivered} delivered` : "",
  ]
    .filter(Boolean)
    .join(", ") || "New customer";
  return { score, level, reasons, blocked };
}

/** Must this cash-on-delivery customer pay an advance first? Returns the reason, or null. */
export function advanceReason(risk: OrderRisk & { blocked: { action: string } | null }, city: string, s: ProtectionSettings): string | null {
  if (risk.blocked?.action === "advance") return "your number needs an advance payment";
  if (s.advanceCities.some((c) => lower(c) === lower(city))) return `orders to ${city} need an advance payment`;
  if (risk.level === "high" && s.advanceForHighRisk) return "your past orders need an advance payment";
  if (risk.level === "medium" && s.advanceForMediumRisk) return "your past orders need an advance payment";
  return null;
}

/** Paid on delivery (cash, or a store's own "on delivery" method) orders over the limits are confirmed by the customer first. */
export function needsConfirmation(args: { paymentMethod: string; paymentDue?: string | null; total: number; zoneName: string | null; advancePaid: boolean }, s: ProtectionSettings) {
  const onDelivery = args.paymentDue ? args.paymentDue === "on-delivery" : args.paymentMethod === "cod";
  if (!s.confirmEnabled || !onDelivery) return false;
  if (args.advancePaid && s.skipWithAdvance) return false;
  if (args.total < s.confirmAbove) return false;
  if (s.confirmZones.length && !(args.zoneName && s.confirmZones.some((z) => lower(z) === lower(args.zoneName!)))) return false;
  return true;
}

export function newConfirmation(s: ProtectionSettings): OrderConfirmation {
  return {
    token: randomBytes(18).toString("base64url"),
    code: String(randomInt(100000, 1000000)),
    expiresAt: new Date(Date.now() + s.autoCancelHours * 3600e3).toISOString(),
    confirmedAt: null,
    via: null,
  };
}
