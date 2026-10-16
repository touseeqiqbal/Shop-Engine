import { randomBytes } from "node:crypto";
import type { Payload, PayloadRequest } from "payload";
import { integrationInfo, publicConfig } from "./catalog";
import { hint, openSecrets, sealSecrets } from "./secrets";

/**
 * A store's connections (src/payload/collections/integrations.ts), read and written on the server only. Not
 * "server-only" on purpose: Payload endpoints (part of the config the CLI loads) import it.
 */

type Doc = Record<string, unknown>;

export type Connection = {
  id: number;
  store: number;
  provider: string;
  category: string;
  enabled: boolean;
  mode: "live" | "test";
  config: Record<string, string | boolean>;
  secrets: Record<string, string>;
  state: Record<string, unknown>;
  status: string;
  webhookKey: string;
};

const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : Number(v));

function toConnection(d: Doc): Connection {
  const info = integrationInfo(String(d.provider));
  return {
    id: Number(d.id),
    store: relId(d.store),
    provider: String(d.provider),
    category: String(d.category ?? info?.category ?? ""),
    enabled: d.enabled !== false,
    mode: d.mode === "test" ? "test" : "live",
    config: info ? publicConfig(info, d.config as Doc) : ((d.config as Record<string, string | boolean>) ?? {}),
    secrets: openSecrets(d.secrets as string | undefined),
    state: (d.state as Record<string, unknown>) ?? {},
    status: String(d.status ?? "connected"),
    webhookKey: String(d.webhookKey ?? ""),
  };
}

/* A short cache for the storefront (chat widget, pixels on every page) – cleared on every save in this process. */
const cache = new Map<number, { at: number; list: Connection[] }>();
const TTL = 60_000;
export const forgetConnections = (storeId: number) => cache.delete(storeId);

/** All of a store's connections (switched-on ones unless `all`). */
export async function connectionsOf(payload: Payload, storeId: number | null | undefined, opts: { category?: string; all?: boolean; fresh?: boolean; req?: PayloadRequest } = {}): Promise<Connection[]> {
  if (storeId == null) return [];
  let entry = opts.fresh ? undefined : cache.get(storeId);
  if (!entry || Date.now() - entry.at > TTL) {
    const res = await payload.find({ collection: "integrations" as never, where: { store: { equals: storeId } }, limit: 100, depth: 0, overrideAccess: true, showHiddenFields: true, ...(opts.req ? { req: opts.req } : {}) });
    entry = { at: Date.now(), list: (res.docs as unknown as Doc[]).map(toConnection) };
    cache.set(storeId, entry);
  }
  return entry.list.filter((c) => (opts.all || c.enabled) && (!opts.category || c.category === opts.category));
}

/** One provider's connection for a store (switched-on only unless `all`). */
export async function getConnection(payload: Payload, storeId: number | null | undefined, provider: string, opts: { all?: boolean; fresh?: boolean } = {}): Promise<Connection | null> {
  return (await connectionsOf(payload, storeId, { all: opts.all, fresh: opts.fresh })).find((c) => c.provider === provider) ?? null;
}

/** The connection a provider's update was sent to (/api/integrations/<provider>/<key>). */
export async function connectionByWebhookKey(payload: Payload, provider: string, key: string): Promise<Connection | null> {
  if (!/^[a-f0-9]{32}$/.test(key)) return null;
  const doc = (await payload.find({ collection: "integrations" as never, where: { and: [{ provider: { equals: provider } }, { webhookKey: { equals: key } }] }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0] as unknown as Doc | undefined;
  return doc ? toConnection(doc) : null;
}

/**
 * Creates or updates a store's connection. Secrets are merged: an empty value keeps the saved one (the admin never
 * gets them back), `null` removes it.
 */
export async function saveConnection(
  payload: Payload,
  input: { storeId: number; provider: string; enabled?: boolean; mode?: "live" | "test"; config?: Record<string, unknown>; secrets?: Record<string, string | null>; state?: Record<string, unknown>; status?: string; lastError?: string | null; checked?: boolean },
): Promise<Connection> {
  const info = integrationInfo(input.provider);
  if (!info) throw new Error(`Unknown integration "${input.provider}"`);
  const existing = (await payload.find({ collection: "integrations" as never, where: { and: [{ store: { equals: input.storeId } }, { provider: { equals: input.provider } }] }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0] as unknown as Doc | undefined;
  const secrets = { ...openSecrets(existing?.secrets as string | undefined) };
  for (const [k, v] of Object.entries(input.secrets ?? {})) {
    if (v === null) delete secrets[k];
    else if (typeof v === "string" && v.trim()) secrets[k] = v.trim();
  }
  const secretHints = Object.fromEntries(info.fields.filter((f) => f.type === "secret" && secrets[f.key]).map((f) => [f.key, hint(secrets[f.key])]));
  const data: Doc = {
    store: input.storeId,
    provider: input.provider,
    category: info.category,
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.config ? { config: publicConfig(info, input.config) } : {}),
    secrets: Object.keys(secrets).length ? sealSecrets(secrets) : null,
    secretHints,
    ...(input.state ? { state: { ...((existing?.state as Doc) ?? {}), ...input.state } } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
    ...(input.checked ? { lastCheckedAt: new Date().toISOString() } : {}),
  };
  const saved = existing
    ? await payload.update({ collection: "integrations" as never, id: Number(existing.id), data: data as never, overrideAccess: true, showHiddenFields: true })
    : await payload.create({ collection: "integrations" as never, data: { ...data, enabled: input.enabled ?? true, webhookKey: randomBytes(16).toString("hex") } as never, overrideAccess: true, showHiddenFields: true });
  forgetConnections(input.storeId);
  return toConnection(saved as unknown as Doc);
}

/** Keeps something a provider needs next time (an OAuth token, a sync cursor); secret ones are stored encrypted. */
export async function rememberForConnection(payload: Payload, c: Connection, patch: { state?: Record<string, unknown>; secrets?: Record<string, string | null>; status?: string; lastError?: string | null }) {
  return saveConnection(payload, { storeId: c.store, provider: c.provider, ...patch });
}

export async function removeConnection(payload: Payload, storeId: number, provider: string) {
  await payload.delete({ collection: "integrations" as never, where: { and: [{ store: { equals: storeId } }, { provider: { equals: provider } }] }, overrideAccess: true });
  forgetConnections(storeId);
}

/** The store's own address for a provider's updates (shown in /cms to paste into the provider's dashboard). */
export const webhookUrlFor = (origin: string, c: Pick<Connection, "provider" | "webhookKey">) => `${origin.replace(/\/+$/, "")}/api/integrations/${c.provider}/${c.webhookKey}`;
