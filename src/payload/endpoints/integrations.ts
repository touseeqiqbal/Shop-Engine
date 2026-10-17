import { createHmac, timingSafeEqual } from "node:crypto";
import type { Endpoint, PayloadRequest } from "payload";
import { storeGate } from "./guard";
import { hasStoreRole, getTenant } from "../tenancy";
import { storeHasFeature, upgradeMessage } from "../entitlements";
import { logActivity } from "../collections/history";
import { availableIn, INTEGRATIONS, integrationInfo, type IntegrationInfo } from "../../lib/integrations/catalog";
import { connectionsOf, getConnection, removeConnection, saveConnection, webhookUrlFor, type Connection } from "../../lib/integrations/server";
import { IntegrationError, type TestResult } from "../../lib/integrations/types";

/**
 * /cms → Integrations (the store being worked in):
 *   GET  /cms-api/integration-tools                the catalog and this store's connections (keys never included)
 *   POST /cms-api/integration-tools/save                { provider, enabled, mode, config, secrets }  save, then test
 *   POST /cms-api/integration-tools/test                { provider }
 *   POST /cms-api/integration-tools/toggle              { provider, enabled }
 *   POST /cms-api/integration-tools/remove              { provider }
 *   GET  /cms-api/integration-tools/oauth/start?provider=…   → the provider's sign-in page
 *   GET  /cms-api/integration-tools/oauth/callback           ← back from it
 * (Not under /cms-api/integrations – that is the collection's own REST route.)
 * Owners connect money and sending identity (payments, messaging, accounting, marketplaces); managers the rest.
 */

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function requestOrigin(req: PayloadRequest): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? `${proto.split(",")[0]}://${host.split(",")[0]}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

/** What the admin may see of a connection: settings and key hints, never the keys. */
function view(c: Connection, doc: Doc | undefined, origin: string) {
  const info = integrationInfo(c.provider);
  return {
    provider: c.provider,
    enabled: c.enabled,
    mode: c.mode,
    config: c.config,
    secretHints: (doc?.secretHints as Record<string, string>) ?? {},
    status: c.status,
    lastCheckedAt: (doc?.lastCheckedAt as string) ?? null,
    lastError: (doc?.lastError as string) ?? null,
    account: typeof c.state.account === "string" ? c.state.account : null,
    webhookUrl: info?.webhook ? webhookUrlFor(origin, c) : null,
    // marketplaces: the last periodic sync (or "Sync now") and what it did
    lastSyncAt: typeof c.state.lastSyncAt === "string" ? c.state.lastSyncAt : null,
    lastSync: typeof c.state.lastSync === "string" ? c.state.lastSync : null,
  };
}

async function canConnect(req: PayloadRequest, store: number, info: IntegrationInfo): Promise<string | null> {
  const t = await getTenant(req);
  if (!t.platformAdmin && !hasStoreRole(t, store, info.minRole)) return info.minRole === "store_owner" ? `Only the store owner can connect ${info.name}.` : `Only the owner or a manager can connect ${info.name}.`;
  if (info.planFeature && !t.platformAdmin && !(await storeHasFeature(req.payload, store, info.planFeature))) return upgradeMessage(info.planFeature);
  return null;
}

async function runTest(req: PayloadRequest, c: Connection): Promise<TestResult> {
  const { providerImpl } = await import("../../lib/integrations/providers");
  const impl = await providerImpl(c.provider);
  if (!impl?.test) return { ok: true, message: "Saved." };
  try {
    return await impl.test({ payload: req.payload, connection: c });
  } catch (e) {
    return { ok: false, message: e instanceof IntegrationError ? e.message : `Couldn’t check the connection: ${(e as Error)?.message ?? "unknown error"}` };
  }
}

async function testAndRecord(req: PayloadRequest, c: Connection) {
  const r = await runTest(req, c);
  await saveConnection(req.payload, { storeId: c.store, provider: c.provider, status: r.ok ? "connected" : "error", lastError: r.ok ? null : r.message.slice(0, 500), checked: true, ...(r.ok && r.state ? { state: r.state } : {}) });
  return r;
}

const audit = (req: PayloadRequest, store: number, info: IntegrationInfo, what: string, action: "create" | "update" | "delete" = "update") =>
  logActivity(req, { action, entity: "integrations", entityLabel: "Integration", docId: info.id, title: info.name, changes: action === "update" ? [{ field: "integration", from: "", to: what }] : [], storeId: store });

const list: Endpoint = {
  path: "/integration-tools",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager");
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const storeDoc = (await req.payload.findByID({ collection: "stores", id: store, depth: 0, overrideAccess: true })) as unknown as Doc;
    const conns = await connectionsOf(req.payload, store, { all: true, fresh: true });
    const docs = (await req.payload.find({ collection: "integrations" as never, where: { store: { equals: store } }, limit: 100, depth: 0, overrideAccess: true })).docs as unknown as Doc[];
    const origin = requestOrigin(req);
    // payment providers send shoppers back to the store's own address (the one checkout uses), so show that one
    const { storeOrigin } = await import("../../lib/tenant-shared");
    const shopOrigin = storeOrigin({ isDefault: storeDoc.isDefault === true, subdomain: str(storeDoc.subdomain) || null, customDomain: str(storeDoc.customDomain) || null, domainVerified: Boolean(storeDoc.domainVerifiedAt) }) || origin;
    const { oauthReady } = await import("../../lib/integrations/oauth");
    return Response.json({
      store: { country: str(storeDoc.country) || "PK", currency: str(storeDoc.currency) || "PKR", name: str(storeDoc.name) },
      isOwner: gate.t.platformAdmin || hasStoreRole(gate.t, store, "store_owner"),
      catalog: INTEGRATIONS.map((i) => ({ ...i, oauthReady: i.oauth ? oauthReady(i.id) : undefined })),
      connections: conns.map((c) => view(c, docs.find((d) => String(d.provider) === c.provider), c.category === "payments" ? shopOrigin : origin)),
    });
  },
};
const save: Endpoint = {
  path: "/integration-tools/save",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const body = (await req.json?.().catch(() => null)) as { provider?: string; enabled?: boolean; mode?: string; config?: Record<string, unknown>; secrets?: Record<string, string> } | null;
    const info = integrationInfo(str(body?.provider));
    if (!info) return Response.json({ error: "Unknown integration." }, { status: 400 });
    const denied = await canConnect(req, store, info);
    if (denied) return Response.json({ error: denied }, { status: 403 });
    const storeDoc = (await req.payload.findByID({ collection: "stores", id: store, depth: 0, overrideAccess: true })) as unknown as Doc;
    if (!gate.t.platformAdmin && !availableIn(info, str(storeDoc.country) || "PK")) return Response.json({ error: `${info.name} isn’t available for stores in your country.` }, { status: 400 });

    // required settings: typed now, or (keys) saved before
    const existing = await getConnection(req.payload, store, info.id, { all: true, fresh: true });
    const config: Record<string, unknown> = {};
    const secrets: Record<string, string> = {};
    const missing: string[] = [];
    for (const f of info.fields) {
      const raw = f.type === "secret" ? body?.secrets?.[f.key] : body?.config?.[f.key];
      if (f.type === "secret") {
        const v = str(raw).trim();
        if (v) secrets[f.key] = v.slice(0, 4000);
        if (f.required && !v && !existing?.secrets[f.key]) missing.push(f.label);
        continue;
      }
      if (f.type === "checkbox") {
        config[f.key] = raw === true;
        continue;
      }
      const v = str(raw).trim().slice(0, 2000);
      if (f.type === "select" && v && !f.options?.some((o) => o.value === v)) return Response.json({ error: `Choose a valid “${f.label}”.` }, { status: 400 });
      config[f.key] = v;
      if (f.required && !v) missing.push(f.label);
    }
    if (missing.length) return Response.json({ error: `Fill in: ${missing.join(", ")}.` }, { status: 400 });

    const enabled = body?.enabled !== false;
    // one of each kind at a time (one email sender, one chat widget …)
    let switchedOff: string[] = [];
    if (enabled && info.exclusive) {
      const others = (await connectionsOf(req.payload, store, { all: true, fresh: true })).filter((c) => c.provider !== info.id && c.enabled && integrationInfo(c.provider)?.exclusive === info.exclusive);
      for (const o of others) await saveConnection(req.payload, { storeId: store, provider: o.provider, enabled: false });
      switchedOff = others.map((o) => integrationInfo(o.provider)?.name ?? o.provider);
    }
    const saved = await saveConnection(req.payload, { storeId: store, provider: info.id, enabled, mode: info.modes && body?.mode === "test" ? "test" : "live", config, secrets });
    const result = await testAndRecord(req, saved);
    await audit(req, store, info, existing ? `settings changed${result.ok ? "" : " (check failed)"}` : "connected", existing ? "update" : "create");
    return Response.json({ ok: result.ok, message: result.message, switchedOff });
  },
};

const test: Endpoint = {
  path: "/integration-tools/test",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager");
    if (gate instanceof Response) return gate;
    const body = (await req.json?.().catch(() => null)) as { provider?: string } | null;
    const c = await getConnection(req.payload, gate.store, str(body?.provider), { all: true, fresh: true });
    if (!c) return Response.json({ error: "Not connected." }, { status: 404 });
    const r = await testAndRecord(req, c);
    return Response.json(r);
  },
};

const toggle: Endpoint = {
  path: "/integration-tools/toggle",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const body = (await req.json?.().catch(() => null)) as { provider?: string; enabled?: boolean } | null;
    const info = integrationInfo(str(body?.provider));
    const c = info ? await getConnection(req.payload, store, info.id, { all: true, fresh: true }) : null;
    if (!info || !c) return Response.json({ error: "Not connected." }, { status: 404 });
    const denied = await canConnect(req, store, info);
    if (denied) return Response.json({ error: denied }, { status: 403 });
    const enabled = body?.enabled === true;
    if (enabled && info.exclusive)
      for (const o of await connectionsOf(req.payload, store, { fresh: true })) if (o.provider !== info.id && integrationInfo(o.provider)?.exclusive === info.exclusive) await saveConnection(req.payload, { storeId: store, provider: o.provider, enabled: false });
    await saveConnection(req.payload, { storeId: store, provider: info.id, enabled });
    await audit(req, store, info, enabled ? "switched on" : "switched off");
    return Response.json({ ok: true });
  },
};

const remove: Endpoint = {
  path: "/integration-tools/remove",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const body = (await req.json?.().catch(() => null)) as { provider?: string } | null;
    const info = integrationInfo(str(body?.provider));
    if (!info) return Response.json({ error: "Unknown integration." }, { status: 400 });
    const denied = await canConnect(req, store, info);
    if (denied) return Response.json({ error: denied }, { status: 403 });
    await removeConnection(req.payload, store, info.id);
    await audit(req, store, info, "removed", "delete");
    return Response.json({ ok: true });
  },
};

/** POST /cms-api/integration-tools/sync { provider } – a marketplace sync now (instead of waiting up to 30 minutes). */
const syncNow: Endpoint = {
  path: "/integration-tools/sync",
  method: "post",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const body = (await req.json?.().catch(() => null)) as { provider?: string } | null;
    const info = integrationInfo(str(body?.provider));
    const c = info ? await getConnection(req.payload, store, info.id, { fresh: true }) : null;
    if (!info || !c) return Response.json({ error: "Not connected (or switched off)." }, { status: 404 });
    const denied = await canConnect(req, store, info);
    if (denied) return Response.json({ error: denied }, { status: 403 });
    const { providerImpl } = await import("../../lib/integrations/providers");
    const impl = await providerImpl(info.id);
    if (!impl?.sync) return Response.json({ error: `${info.name} has nothing to sync.` }, { status: 400 });
    const { runSync } = await import("../../lib/integrations/server");
    const r = await runSync(req.payload, c, (ctx) => impl.sync!(ctx));
    if (!r.ran) return Response.json({ ok: false, message: "A sync is already running – try again in a few minutes." }, { status: 409 });
    await audit(req, store, info, r.error ? "sync failed" : "synced now");
    return Response.json(r.error ? { ok: false, message: r.error } : { ok: true, message: r.summary ?? "Done – nothing needed changing." });
  },
};

/* ───────────── OAuth (accounting, marketplaces): signed state, the provider's sign-in page, back here ───────────── */

const signState = (payloadText: string) => createHmac("sha256", `${process.env.PAYLOAD_SECRET ?? ""}:integrations-oauth`).update(payloadText).digest("base64url");

type OAuthState = { s: number; p: string; u: number; o?: Record<string, string> };

function makeState(data: OAuthState) {
  const body = Buffer.from(JSON.stringify({ ...data, e: Date.now() + 15 * 60_000 })).toString("base64url");
  return `${body}.${signState(body)}`;
}
function readState(state: string): OAuthState | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = signState(body);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState & { e: number };
  return d.e > Date.now() ? d : null;
}

/** The choices made before signing in (?opt_marketplace=US …): only the integration's own select fields, valid values. */
function oauthOptions(info: IntegrationInfo, params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of info.fields) {
    if (!f.beforeConnect) continue;
    const v = params.get(`opt_${f.key}`) ?? f.default ?? "";
    if (f.options?.some((o) => o.value === v)) out[f.key] = v;
  }
  return out;
}

const oauthStart: Endpoint = {
  path: "/integration-tools/oauth/start",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return gate;
    const store = gate.store!;
    const query = new URL(req.url ?? "", "http://x").searchParams;
    const info = integrationInfo(query.get("provider"));
    if (!info?.oauth) return Response.json({ error: "Unknown integration." }, { status: 400 });
    const denied = await canConnect(req, store, info);
    if (denied) return Response.json({ error: denied }, { status: 403 });
    const { providerImpl } = await import("../../lib/integrations/providers");
    const impl = await providerImpl(info.id);
    if (!impl?.oauth?.configured()) return Response.json({ error: `${info.name} isn’t set up on ShopEngine yet – ask ShopEngine support.` }, { status: 503 });
    const { oauthRedirectUri } = await import("../../lib/integrations/oauth");
    const storeDoc = (await req.payload.findByID({ collection: "stores", id: store, depth: 0, overrideAccess: true })) as unknown as Doc;
    const options = oauthOptions(info, query);
    const url = impl.oauth.authorizeUrl({ state: makeState({ s: store, p: info.id, u: Number(gate.t.userId), o: options }), redirectUri: oauthRedirectUri(requestOrigin(req)), country: str(storeDoc.country) || "PK", options });
    return Response.redirect(url, 302);
  },
};

const oauthCallback: Endpoint = {
  path: "/integration-tools/oauth/callback",
  method: "get",
  handler: async (req) => {
    const url = new URL(req.url ?? "", "http://x");
    const back = (q: string) => Response.redirect(`${requestOrigin(req)}/cms/integrations?${q}`, 302);
    const state = readState(url.searchParams.get("state") ?? "");
    if (!state) return back("error=expired");
    const gate = await storeGate(req, "store_manager", { write: true });
    if (gate instanceof Response) return back("error=signin");
    if (gate.store !== state.s || Number(gate.t.userId) !== state.u) return back("error=store");
    const info = integrationInfo(state.p);
    if (!info) return back("error=unknown");
    if (url.searchParams.get("error")) return back(`error=denied&provider=${info.id}`);
    const { providerImpl } = await import("../../lib/integrations/providers");
    const impl = await providerImpl(info.id);
    if (!impl?.oauth) return back("error=unknown");
    const { oauthRedirectUri } = await import("../../lib/integrations/oauth");
    try {
      const options = state.o ?? {};
      const r = await impl.oauth.finish({ payload: req.payload, storeId: state.s }, { code: url.searchParams.get("code") ?? "", redirectUri: oauthRedirectUri(requestOrigin(req)), params: url.searchParams, options });
      const saved = await saveConnection(req.payload, { storeId: state.s, provider: info.id, enabled: true, config: { ...(r.config ?? {}), ...options }, secrets: r.secrets, state: r.state, status: "connected", lastError: null, checked: true });
      await testAndRecord(req, saved);
      await audit(req, state.s, info, "connected", "create");
      return back(`connected=${info.id}`);
    } catch (e) {
      const { log } = await import("../../lib/log");
      log.error("integrations.oauth_failed", e, { provider: info.id });
      return back(`error=failed&provider=${info.id}`);
    }
  },
};

export const integrationEndpoints: Endpoint[] = [list, save, test, toggle, remove, syncNow, oauthStart, oauthCallback];
