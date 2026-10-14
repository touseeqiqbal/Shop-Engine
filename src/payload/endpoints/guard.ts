import type { PayloadRequest, Where } from "payload";
import { getTenant, hasStoreRole, type StoreRole, type Tenant } from "../tenancy";
import { storeHasFeature, upgradeMessage, type PlanFeature } from "../entitlements";

export type StoreGate = { t: Tenant; store: number | null; inStore: Where[] };

/**
 * For custom endpoints (which read with overrideAccess): who may call it, and which store's records it works on.
 * Returns a Response to send back when not allowed.
 *  - `allowAll`: a platform admin with no store chosen works on every store (reports); otherwise a store must be chosen.
 *  - `write`: refused while the store is read-only (suspended, plan ended).
 */
export async function storeGate(req: PayloadRequest, min: StoreRole, opts: { allowAll?: boolean; write?: boolean; feature?: PlanFeature } = {}): Promise<StoreGate | Response> {
  if (!req.user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const t = await getTenant(req);
  const store = t.activeStoreId;
  if (store == null) {
    if (t.platformAdmin && opts.allowAll && !opts.write) return { t, store: null, inStore: [] };
    return Response.json({ error: t.platformAdmin ? "Choose a store first (switcher at the top of the menu)." : "You don't work in a store yet." }, { status: t.platformAdmin ? 400 : 403 });
  }
  if (!hasStoreRole(t, store, min)) return Response.json({ error: "You don't have access to this in this store." }, { status: 403 });
  if (opts.write && !t.platformAdmin && t.readOnly.has(store)) return Response.json({ error: "This store is read-only (suspended or its plan ended)." }, { status: 403 });
  if (opts.feature && !t.platformAdmin && !(await storeHasFeature(req.payload, store, opts.feature))) return Response.json({ error: upgradeMessage(opts.feature) }, { status: 403 });
  return { t, store, inStore: [{ store: { equals: store } }] };
}

/** A record belongs to the store being worked in (or the caller is a platform admin looking at all stores). */
export const sameStoreAs = (gate: StoreGate, doc: { store?: unknown } | null | undefined) => {
  if (!doc) return false;
  if (gate.store == null) return gate.t.platformAdmin;
  const s = doc.store && typeof doc.store === "object" ? (doc.store as { id?: unknown }).id : doc.store;
  return Number(s) === gate.store;
};
