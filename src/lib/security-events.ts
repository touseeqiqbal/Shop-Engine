import type { Payload } from "payload";
import type { SecurityEventKind } from "@/payload/collections/security-events";
import { log } from "@/lib/log";

/**
 * Records one security event (Platform → Security events). Never throws – a sign-in must never fail because its
 * record couldn't be written. Not "server-only": the Payload endpoints (part of the config) call it.
 */

/** 203.0.113.42 → 203.0.113.x · 2001:db8:1:2:… → 2001:db8:1:… – a pattern is visible, a household isn't. */
export function shortIp(ip: string | null | undefined): string {
  const v = String(ip ?? "").trim();
  if (!v) return "";
  if (v.includes(".")) return v.split(".").slice(0, 3).concat("x").join(".");
  return `${v.split(":").slice(0, 3).join(":")}:…`;
}

export async function recordSecurityEvent(payload: Payload, e: { kind: SecurityEventKind; area?: "admin" | "shop"; email?: string | null; userId?: number | string | null; ip?: string | null; detail?: string | null }): Promise<void> {
  try {
    await payload.create({
      collection: "security-events" as never,
      data: {
        kind: e.kind,
        area: e.area ?? "admin",
        email: e.email ? String(e.email).toLowerCase().slice(0, 200) : null,
        userId: e.userId != null && Number(e.userId) > 0 ? Number(e.userId) : null,
        ip: shortIp(e.ip),
        detail: e.detail ? String(e.detail).slice(0, 300) : null,
      } as never,
      overrideAccess: true,
      depth: 0,
    });
  } catch (err) {
    log.error("security.event_write_failed", err, { kind: e.kind });
  }
}

/** Housekeeping: events older than 180 days are removed. */
export async function pruneSecurityEvents(payload: Payload, days = 180): Promise<number> {
  const before = new Date(Date.now() - days * 86_400_000).toISOString();
  const r = await payload.delete({ collection: "security-events" as never, where: { createdAt: { less_than: before } }, overrideAccess: true }).catch(() => null);
  return r?.docs?.length ?? 0;
}
