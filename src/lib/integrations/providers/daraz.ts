import { createHmac } from "node:crypto";
import { createLocalReq, type Payload } from "payload";
import { http } from "../http";
import { oauthReady } from "../oauth";
import { rememberForConnection } from "../server";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";
import { accessToken } from "./oauth-tokens";

/**
 * Daraz Open Platform (the seller's own Seller Center account, signed in through ShopEngine's Daraz app):
 *  1. new Daraz orders take their items off this store's stock (matched by Seller SKU); cancelled ones put them back;
 *  2. then this store's stock (and prices, if chosen) is sent to Daraz for SKUs that changed – ShopEngine is the master.
 * Runs about every 30 minutes (housekeeping → sync). Every call is signed: HMAC-SHA256(app secret, path + sorted k+v).
 *   DARAZ_APP_KEY / DARAZ_APP_SECRET   the app (open.daraz.com, an "ERP System" app so any seller can authorise it)
 */

const GATEWAYS: Record<string, string> = { PK: "https://api.daraz.pk", BD: "https://api.daraz.com.bd", LK: "https://api.daraz.lk", NP: "https://api.daraz.com.np", MM: "https://api.shop.com.mm" };
const gateway = (country: unknown) => GATEWAYS[String(country || "PK").toUpperCase()] ?? GATEWAYS.PK;

/** Daraz's signature (Lazada Open Platform doc 502). */
export function darazSign(apiPath: string, params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();
  let s = apiPath;
  for (const k of keys) s += k + params[k];
  return createHmac("sha256", secret).update(s, "utf8").digest("hex").toUpperCase();
}

type Envelope<T> = { code?: string; message?: string; request_id?: string; data?: T } & Record<string, unknown>;

async function call<T>(country: unknown, apiPath: string, params: Record<string, string>, opts: { method?: "GET" | "POST"; token?: string } = {}): Promise<Envelope<T>> {
  const p: Record<string, string> = { app_key: process.env.DARAZ_APP_KEY ?? "", timestamp: String(Date.now()), sign_method: "sha256", ...(opts.token ? { access_token: opts.token } : {}) };
  for (const [k, v] of Object.entries(params)) if (v !== "") p[k] = v;
  p.sign = darazSign(apiPath, p, process.env.DARAZ_APP_SECRET ?? "");
  const url = `${gateway(country)}/rest${apiPath}`;
  const body = new URLSearchParams(p);
  const r = opts.method === "POST" ? await http<Envelope<T>>(url, { provider: "Daraz", method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" } }) : await http<Envelope<T>>(`${url}?${body}`, { provider: "Daraz" });
  if (String(r.data?.code ?? "") !== "0") throw new IntegrationError(`Daraz: ${r.data?.message ?? `request failed (${r.status})`}${r.data?.code ? ` (${r.data.code})` : ""}`, r.status === 401 ? 400 : 502);
  return r.data;
}

type TokenData = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; account?: string; country?: string; country_user_info?: { seller_id?: string; short_code?: string }[] };

const token = (ctx: Ctx) =>
  accessToken(ctx, "Daraz", async (refresh) => {
    if (Number(ctx.connection.state.refreshExpiresAt ?? Infinity) < Date.now()) return "expired";
    let r: Envelope<never> & TokenData;
    try {
      r = (await call(ctx.connection.state.country, "/auth/token/refresh", { refresh_token: refresh }, { method: "POST" })) as Envelope<never> & TokenData;
    } catch (e) {
      if (/IllegalRefreshToken|refresh.*(invalid|expired)/i.test(String((e as Error).message))) return "expired";
      throw e;
    }
    if (!r.access_token) throw new IntegrationError("Daraz didn’t renew the sign-in.", 502);
    return { accessToken: r.access_token, refreshToken: r.refresh_token, expiresIn: r.expires_in ?? 3600, state: r.refresh_expires_in ? { refreshExpiresAt: Date.now() + r.refresh_expires_in * 1000 } : {} };
  });

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type DarazOrder = { order_id: number | string; order_number?: number | string; statuses?: string[]; updated_at?: string };
type DarazItem = { sku?: string; status?: string };

/** Store products by SKU (variant options have their own SKUs; parents with options hold no stock). */
async function productsBySku(payload: Payload, storeId: number, skus?: string[]) {
  const res = await payload.find({ collection: "products", where: { and: [{ store: { equals: storeId } }, skus ? { sku: { in: skus } } : { sku: { exists: true } }] }, limit: skus ? skus.length + 10 : 2000, depth: 0, overrideAccess: true, pagination: false, select: { sku: true, price: true, stock: true, title: true } as never });
  const docs = res.docs as unknown as { id: number; sku?: string | null; price?: number | null; stock?: number | null; title?: string }[];
  // products that have options: their stock is their options' – only the options are matched
  const options = await payload.find({ collection: "products", where: { and: [{ store: { equals: storeId } }, { variantOf: { exists: true } }] }, limit: 5000, depth: 0, overrideAccess: true, pagination: false, select: { variantOf: true } as never });
  const parents = new Set((options.docs as unknown as { variantOf?: number | { id: number } | null }[]).map((d) => Number(d.variantOf && typeof d.variantOf === "object" ? d.variantOf.id : d.variantOf)));
  const out = new Map<string, (typeof docs)[number]>();
  for (const d of docs) if (d.sku && !parents.has(d.id)) out.set(d.sku, d);
  return out;
}

/** Daraz orders since the last run: take their items off our stock (once); cancelled ones put back (once). */
async function importOrders(ctx: Ctx, t: string): Promise<{ taken: number; returned: number; cursor: string; seen: Record<string, string> }> {
  const c = ctx.connection;
  const seen = { ...((c.state.orders as Record<string, string> | undefined) ?? {}) };
  const since = String(c.state.ordersCursor ?? c.state.connectedAt ?? new Date().toISOString());
  let cursor = since;
  let taken = 0;
  let returned = 0;
  const { addStock, setStockLog } = await import("../../../payload/stock");
  for (let offset = 0; offset < 500; offset += 100) {
    const r = await call<{ orders?: DarazOrder[] }>(c.state.country, "/orders/get", { update_after: new Date(Date.parse(since) - 5 * 60_000).toISOString().replace(/\.\d{3}Z$/, "+00:00"), sort_by: "updated_at", sort_direction: "ASC", offset: String(offset), limit: "100" }, { token: t });
    const orders = r.data?.orders ?? [];
    for (const o of orders) {
      const id = String(o.order_id);
      const statuses = (o.statuses ?? []).map((s) => s.toLowerCase());
      const cancelled = statuses.includes("canceled") || statuses.includes("cancelled");
      const unpaid = statuses.length > 0 && statuses.every((s) => s === "unpaid");
      const want = cancelled ? (seen[id] === "taken" ? "put-back" : null) : unpaid || seen[id] ? null : "taken";
      if (want) {
        const items = (await call<DarazItem[]>(c.state.country, "/order/items/get", { order_id: id }, { token: t })).data ?? [];
        const qty = new Map<string, number>();
        for (const i of items) if (i.sku) qty.set(i.sku, (qty.get(i.sku) ?? 0) + 1);
        const products = await productsBySku(ctx.payload, c.store, [...qty.keys()]);
        const req = await createLocalReq({}, ctx.payload);
        setStockLog(req, { reason: "other", ref: String(o.order_number ?? id), note: `Daraz order ${String(o.order_number ?? id)}${want === "put-back" ? " cancelled" : ""}` });
        for (const [sku, n] of qty) {
          const p = products.get(sku);
          if (p) await addStock(ctx.payload, p.id, want === "taken" ? -n : n, req);
        }
        seen[id] = want;
        if (want === "taken") taken++;
        else returned++;
      }
      if (o.updated_at && Date.parse(o.updated_at) > Date.parse(cursor)) cursor = new Date(Date.parse(o.updated_at)).toISOString();
    }
    if (orders.length < 100) break;
  }
  // keep the newest 1500 orders' marks
  const keys = Object.keys(seen);
  for (const k of keys.slice(0, Math.max(0, keys.length - 1500))) delete seen[k];
  return { taken, returned, cursor, seen };
}

/** Our stock (and prices) for SKUs that changed since they were last sent – 20 per call, at most 200 a run. */
async function pushStock(ctx: Ctx, t: string): Promise<{ sent: number; pushed: Record<string, string> }> {
  const c = ctx.connection;
  const pushed = { ...((c.state.pushed as Record<string, string> | undefined) ?? {}) };
  const withPrice = c.config.sendPrices === true;
  const warehouse = String(c.config.warehouseCode ?? "").trim();
  const products = await productsBySku(ctx.payload, c.store);
  const changed: { sku: string; stock: number; price: number; mark: string }[] = [];
  for (const [sku, p] of products) {
    const stock = Math.max(0, Math.floor(Number(p.stock) || 0));
    const price = Number(p.price) || 0;
    const mark = withPrice ? `${stock}|${price}` : `${stock}`;
    if (pushed[sku] !== mark) changed.push({ sku, stock, price, mark });
    if (changed.length >= 200) break;
  }
  let sent = 0;
  for (let i = 0; i < changed.length; i += 20) {
    const batch = changed.slice(i, i + 20);
    const skus = batch
      .map((b) => {
        const qty = warehouse ? `<MultiWarehouseInventories><MultiWarehouseInventory><WarehouseCode>${xml(warehouse)}</WarehouseCode><Quantity>${b.stock}</Quantity></MultiWarehouseInventory></MultiWarehouseInventories>` : `<Quantity>${b.stock}</Quantity>`;
        return `<Sku><SellerSku>${xml(b.sku)}</SellerSku>${withPrice && b.price > 0 ? `<Price>${b.price.toFixed(2)}</Price>` : ""}${qty}</Sku>`;
      })
      .join("");
    await call(c.state.country, "/product/price_quantity/update", { payload: `<Request><Product><Skus>${skus}</Skus></Product></Request>` }, { method: "POST", token: t });
    for (const b of batch) pushed[b.sku] = b.mark;
    sent += batch.length;
  }
  return { sent, pushed };
}

const impl: ProviderImpl = {
  async test(ctx) {
    const r = await call<{ name?: string; short_code?: string }>(ctx.connection.state.country, "/seller/get", {}, { token: await token(ctx) });
    const name = r.data?.name ?? String(ctx.connection.state.account ?? "Daraz seller");
    return { ok: true, message: `Connected to Daraz – ${name}.`, state: { account: name } };
  },
  async sync(ctx) {
    const t = await token(ctx);
    const orders = await importOrders(ctx, t);
    await rememberForConnection(ctx.payload, ctx.connection, { state: { ordersCursor: orders.cursor, orders: orders.seen } });
    ctx.connection.state = { ...ctx.connection.state, ordersCursor: orders.cursor, orders: orders.seen };
    const stock = await pushStock(ctx, t);
    await rememberForConnection(ctx.payload, ctx.connection, { state: { pushed: stock.pushed } });
    const parts = [orders.taken ? `${orders.taken} Daraz order(s) taken off stock` : "", orders.returned ? `${orders.returned} cancelled order(s) put back` : "", stock.sent ? `${stock.sent} SKU(s) sent to Daraz` : ""].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  },
  oauth: {
    configured: () => oauthReady("daraz"),
    authorizeUrl: ({ state, redirectUri, country }) => `${gateway(country)}/oauth/authorize?${new URLSearchParams({ response_type: "code", force_auth: "true", redirect_uri: redirectUri, client_id: process.env.DARAZ_APP_KEY ?? "", state })}`,
    async finish(ctx, { code }) {
      const store = (await ctx.payload.findByID({ collection: "stores", id: ctx.storeId, depth: 0, overrideAccess: true })) as unknown as { country?: string };
      const country = String(store.country || "PK").toUpperCase();
      const r = (await call(country, "/auth/token/create", { code }, { method: "POST" })) as Envelope<never> & TokenData;
      if (!r.access_token || !r.refresh_token) throw new IntegrationError("Daraz didn’t finish the sign-in.", 502);
      const now = Date.now();
      return {
        secrets: { accessToken: r.access_token, refreshToken: r.refresh_token },
        state: { country, account: r.account ?? "", sellerId: r.country_user_info?.[0]?.seller_id ?? "", accessExpiresAt: now + (r.expires_in ?? 3600) * 1000, ...(r.refresh_expires_in ? { refreshExpiresAt: now + r.refresh_expires_in * 1000 } : {}), connectedAt: new Date().toISOString() },
      };
    },
  },
};

export default impl;
