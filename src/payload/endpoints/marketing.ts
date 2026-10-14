import type { Endpoint } from "payload";
import { storeGate } from "./guard";
import { logActivity } from "../collections/history";

/**
 * GET /cms-api/marketing/subscribers.csv – the store's customers who agreed to its marketing emails (ticked at
 * checkout), ready to import into an email tool (Mailchimp, Klaviyo, Brevo…). Managers only; every download is logged.
 * Only this store's consent counts – a customer who agreed to another store's emails is never included.
 */

type Doc = Record<string, unknown>;
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // spreadsheet formula injection: a leading = + - @ is made plain text
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const subscribers: Endpoint = {
  path: "/marketing/subscribers.csv",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager");
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const people = (await req.payload.find({ collection: "users", where: { and: [{ marketingConsent: { in: [store] } }, { role: { equals: "customer" } }, { blocked: { not_equals: true } }] }, limit: 0, pagination: false, depth: 0, overrideAccess: true, req })).docs as unknown as Doc[];
    // when they agreed: their latest order at this store with the box ticked
    const latest = new Map<string, string>();
    if (people.length) {
      const orders = (await req.payload.find({ collection: "orders", where: { and: [{ store: { equals: store } }, { marketingConsent: { equals: true } }] }, limit: 0, pagination: false, depth: 0, overrideAccess: true, req, select: { customer: true, placedAt: true } as never })).docs as unknown as Doc[];
      for (const o of orders) {
        const email = String((o.customer as Doc | undefined)?.email ?? "").toLowerCase();
        if (email && (!latest.has(email) || String(o.placedAt) > latest.get(email)!)) latest.set(email, String(o.placedAt));
      }
    }
    const rows = [["email", "name", "phone", "agreed_at"], ...people.map((p) => [p.email, p.name ?? "", p.phone ?? "", latest.get(String(p.email).toLowerCase()) ?? ""])];
    await logActivity(req, { action: "update", entity: "users", entityLabel: "Customers", docId: "export", title: "Marketing subscribers", changes: [{ field: "export", from: "", to: `${people.length} subscribers downloaded` }], storeId: store });
    return new Response(rows.map((r) => r.map(cell).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  },
};

export const marketingEndpoints: Endpoint[] = [subscribers];
