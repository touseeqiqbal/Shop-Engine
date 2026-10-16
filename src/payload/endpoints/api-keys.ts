import type { Endpoint } from "payload";
import { storeGate } from "./guard";
import { hasStoreRole, storeIdOf } from "../tenancy";
import { logActivity } from "../collections/history";
import { API_SCOPES } from "../collections/api-keys";

/**
 * /cms → Integrations → Store API (the store being worked in):
 *   GET  /cms-api/integration-tools/api-keys            this store's keys (name, start of the key, permissions, last used)
 *   POST /cms-api/integration-tools/api-keys            { name, scopes }  → { key } – shown this once, only its hash is kept
 *   POST /cms-api/integration-tools/api-keys/revoke     { id }
 * Only the owner makes keys (a key outlives the person who made it); the owner or a manager can see and remove them.
 */

type Doc = Record<string, unknown>;
const MAX_KEYS = 10;
const SCOPES = new Set<string>(API_SCOPES.map((s) => s.value));

const view = (d: Doc) => ({
  id: Number(d.id),
  name: String(d.name ?? ""),
  prefix: String(d.prefix ?? ""),
  scopes: ((d.scopes as string[] | undefined) ?? []).map(String),
  createdBy: (d.createdBy as string) || null,
  createdAt: String(d.createdAt ?? ""),
  lastUsedAt: (d.lastUsedAt as string) || null,
});

const list: Endpoint = {
  path: "/integration-tools/api-keys",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager");
    if (gate instanceof Response) return gate;
    const docs = (await req.payload.find({ collection: "api-keys" as never, where: { store: { equals: gate.store } }, sort: "-createdAt", limit: 50, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
    return Response.json({ keys: docs.map(view), scopes: API_SCOPES, canCreate: gate.t.platformAdmin || hasStoreRole(gate.t, gate.store!, "store_owner") });
  },
};

const create: Endpoint = {
  path: "/integration-tools/api-keys",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_owner", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const body = (await req.json?.().catch(() => null)) as { name?: unknown; scopes?: unknown } | null;
    const name = String(body?.name ?? "").trim().slice(0, 60);
    const scopes = [...new Set((Array.isArray(body?.scopes) ? body.scopes : []).map(String))].filter((s) => SCOPES.has(s));
    if (!name) return Response.json({ error: "Give the key a name – e.g. the system that will use it." }, { status: 400 });
    if (!scopes.length) return Response.json({ error: "Choose at least one permission." }, { status: 400 });
    const { totalDocs } = await req.payload.count({ collection: "api-keys" as never, where: { store: { equals: store } }, overrideAccess: true });
    if (totalDocs >= MAX_KEYS) return Response.json({ error: `A store can have ${MAX_KEYS} API keys – remove one you no longer use first.` }, { status: 400 });
    const { hashKey, newApiKey } = await import("../../lib/store-api");
    const key = newApiKey();
    const doc = (await req.payload.create({
      collection: "api-keys" as never,
      data: { store, name, prefix: `${key.slice(0, 12)}…`, hash: hashKey(key), scopes, createdBy: (req.user as { email?: string } | null)?.email ?? null } as never,
      overrideAccess: true,
      context: { system: true },
    })) as unknown as Doc;
    await logActivity(req, { action: "create", entity: "api-keys", entityLabel: "API key", docId: String(doc.id), title: name, changes: [], storeId: store });
    return Response.json({ key, apiKey: view(doc) });
  },
};

const revoke: Endpoint = {
  path: "/integration-tools/api-keys/revoke",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const body = (await req.json?.().catch(() => null)) as { id?: unknown } | null;
    const id = Number(body?.id);
    const doc = Number.isFinite(id) ? ((await req.payload.findByID({ collection: "api-keys" as never, id, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null) : null;
    if (!doc || storeIdOf(doc.store) !== store) return Response.json({ error: "No such key." }, { status: 404 });
    await req.payload.delete({ collection: "api-keys" as never, id, overrideAccess: true, context: { system: true } });
    await logActivity(req, { action: "delete", entity: "api-keys", entityLabel: "API key", docId: String(id), title: String(doc.name ?? ""), changes: [], storeId: store });
    return Response.json({ ok: true });
  },
};

export const apiKeyEndpoints: Endpoint[] = [list, create, revoke];
