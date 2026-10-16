import { createLocalReq, type Payload } from "payload";
import { http, providerMessage } from "../http";
import { oauthReady } from "../oauth";
import { rememberForConnection } from "../server";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";
import { accessToken } from "./oauth-tokens";

/**
 * Amazon Selling Partner API (the seller's own Seller Central account, authorised through ShopEngine's PUBLIC
 * developer app – Login with Amazon tokens; no AWS signing). Every ~30 minutes:
 *  1. new merchant-fulfilled (MFN) orders take their items off this store's stock (by seller SKU); cancelled ones
 *     put them back – Amazon's own warehouse stock (FBA) is never touched;
 *  2. then this store's stock (and price, if chosen and the currencies match) is sent to the matching listings.
 *   AMAZON_SPAPI_APP_ID, AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET   (AMAZON_SPAPI_DRAFT=true for a draft app)
 * Orders come from Orders API v0 (marked deprecated by Amazon, removal date not announced) – see docs/INTEGRATIONS.md.
 */

type Market = { id: string; region: "na" | "eu" | "fe"; central: string; currency: string };
/** Marketplace ids, regions and Seller Central addresses (developer-docs.amazon.com/sp-api/docs/marketplace-ids). */
const MARKETS: Record<string, Market> = {
  US: { id: "ATVPDKIKX0DER", region: "na", central: "sellercentral.amazon.com", currency: "USD" },
  CA: { id: "A2EUQ1WTGCTBG2", region: "na", central: "sellercentral.amazon.ca", currency: "CAD" },
  MX: { id: "A1AM78C64UM0Y8", region: "na", central: "sellercentral.amazon.com.mx", currency: "MXN" },
  BR: { id: "A2Q3Y263D00KWC", region: "na", central: "sellercentral.amazon.com.br", currency: "BRL" },
  UK: { id: "A1F83G8C2ARO7P", region: "eu", central: "sellercentral.amazon.co.uk", currency: "GBP" },
  DE: { id: "A1PA6795UKMFR9", region: "eu", central: "sellercentral.amazon.de", currency: "EUR" },
  FR: { id: "A13V1IB3VIYZZH", region: "eu", central: "sellercentral.amazon.fr", currency: "EUR" },
  IT: { id: "APJ6JRA9NG5V4", region: "eu", central: "sellercentral.amazon.it", currency: "EUR" },
  ES: { id: "A1RKKUPIHCS9HS", region: "eu", central: "sellercentral.amazon.es", currency: "EUR" },
  NL: { id: "A1805IZSGTT6HS", region: "eu", central: "sellercentral.amazon.nl", currency: "EUR" },
  SE: { id: "A2NODRKZP88ZB9", region: "eu", central: "sellercentral.amazon.se", currency: "SEK" },
  PL: { id: "A1C3SOZRARQ6R3", region: "eu", central: "sellercentral.amazon.pl", currency: "PLN" },
  TR: { id: "A33AVAJ2PDY3EV", region: "eu", central: "sellercentral.amazon.com.tr", currency: "TRY" },
  AE: { id: "A2VIGQ35RCS4UG", region: "eu", central: "sellercentral.amazon.ae", currency: "AED" },
  SA: { id: "A17E79C6D8DWNP", region: "eu", central: "sellercentral.amazon.sa", currency: "SAR" },
  EG: { id: "ARBP9OOSHTCHU", region: "eu", central: "sellercentral.amazon.eg", currency: "EGP" },
  IN: { id: "A21TJRUUN4KGV", region: "eu", central: "sellercentral.amazon.in", currency: "INR" },
  JP: { id: "A1VC38T7YXB528", region: "fe", central: "sellercentral.amazon.co.jp", currency: "JPY" },
  AU: { id: "A39IBJ37TRP1C6", region: "fe", central: "sellercentral.amazon.com.au", currency: "AUD" },
  SG: { id: "A19VAU5U5O7RUS", region: "fe", central: "sellercentral.amazon.sg", currency: "SGD" },
};
const market = (code: unknown) => MARKETS[String(code || "US")] ?? MARKETS.US;
const host = (m: Market) => `https://sellingpartnerapi-${m.region}.amazon.com`;
const LWA = "https://api.amazon.com/auth/o2/token";
const USER_AGENT = "ShopEngine/1.0 (Language=TypeScript; Platform=Node)";

type LwaToken = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

const lwa = (body: Record<string, string>) => http<LwaToken>(LWA, { provider: "Amazon", method: "POST", body: new URLSearchParams({ ...body, client_id: process.env.AMAZON_LWA_CLIENT_ID ?? "", client_secret: process.env.AMAZON_LWA_CLIENT_SECRET ?? "" }) });

const token = (ctx: Ctx) =>
  accessToken(ctx, "Amazon", async (refresh) => {
    const r = await lwa({ grant_type: "refresh_token", refresh_token: refresh });
    if (r.data?.error === "invalid_grant") return "expired";
    if (!r.ok || !r.data.access_token) throw new IntegrationError(`Amazon: ${r.data?.error_description ?? `couldn’t renew the sign-in (${r.status})`}`, 502);
    return { accessToken: r.data.access_token, expiresIn: r.data.expires_in ?? 3600 };
  });

async function sp<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const m = market(ctx.connection.config.marketplace);
  const r = await http<T & { errors?: { message?: string; code?: string }[] }>(`${host(m)}${path}`, { provider: "Amazon", method: init.method, body: init.body, headers: { "x-amz-access-token": await token(ctx), "user-agent": USER_AGENT, "x-amz-date": new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") } });
  if (!r.ok) throw new IntegrationError(`Amazon: ${r.data?.errors?.[0]?.message ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 || r.status === 403 ? 400 : 502);
  return r.data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Store products by SKU (products with options are matched by their options' SKUs). */
async function productsBySku(payload: Payload, storeId: number, skus?: string[]) {
  const res = await payload.find({ collection: "products", where: { and: [{ store: { equals: storeId } }, skus ? { sku: { in: skus } } : { sku: { exists: true } }] }, limit: skus ? skus.length + 10 : 2000, depth: 0, overrideAccess: true, pagination: false, select: { sku: true, price: true, stock: true } as never });
  const options = await payload.find({ collection: "products", where: { and: [{ store: { equals: storeId } }, { variantOf: { exists: true } }] }, limit: 5000, depth: 0, overrideAccess: true, pagination: false, select: { variantOf: true } as never });
  const parents = new Set((options.docs as unknown as { variantOf?: number | { id: number } | null }[]).map((d) => Number(d.variantOf && typeof d.variantOf === "object" ? d.variantOf.id : d.variantOf)));
  const out = new Map<string, { id: number; price: number; stock: number }>();
  for (const d of res.docs as unknown as { id: number; sku?: string | null; price?: number | null; stock?: number | null }[]) if (d.sku && !parents.has(d.id)) out.set(d.sku, { id: d.id, price: Number(d.price) || 0, stock: Math.max(0, Math.floor(Number(d.stock) || 0)) });
  return out;
}

type AmazonOrder = { AmazonOrderId: string; OrderStatus: string; FulfillmentChannel?: string; LastUpdateDate?: string };

/** MFN orders since the last run → stock taken once; cancelled → put back once. At most 20 orders a run (Amazon's limits). */
async function importOrders(ctx: Ctx) {
  const c = ctx.connection;
  const m = market(c.config.marketplace);
  const seen = { ...((c.state.orders as Record<string, string> | undefined) ?? {}) };
  const since = String(c.state.ordersCursor ?? c.state.connectedAt ?? new Date().toISOString());
  // Amazon wants the time at least 2 minutes in the past
  const after = new Date(Math.min(Date.parse(since) - 5 * 60_000, Date.now() - 3 * 60_000)).toISOString();
  const r = await sp<{ payload?: { Orders?: AmazonOrder[] } }>(ctx, `/orders/v0/orders?${new URLSearchParams({ MarketplaceIds: m.id, LastUpdatedAfter: after, MaxResultsPerPage: "100" })}`);
  const orders = (r.payload?.Orders ?? []).filter((o) => o.FulfillmentChannel !== "AFN");
  let cursor = since;
  let taken = 0;
  let returned = 0;
  let handled = 0;
  let capped = false;
  const { addStock, setStockLog } = await import("../../../payload/stock");
  for (const o of orders) {
    const cancelled = o.OrderStatus === "Canceled";
    const want = cancelled ? (seen[o.AmazonOrderId] === "taken" ? "put-back" : null) : seen[o.AmazonOrderId] ? null : "taken";
    if (want) {
      if (handled >= 20) {
        capped = true;
        break;
      }
      handled++;
      const items = await sp<{ payload?: { OrderItems?: { SellerSKU?: string; QuantityOrdered?: number }[] } }>(ctx, `/orders/v0/orders/${encodeURIComponent(o.AmazonOrderId)}/orderItems`);
      const qty = new Map<string, number>();
      for (const i of items.payload?.OrderItems ?? []) if (i.SellerSKU) qty.set(i.SellerSKU, (qty.get(i.SellerSKU) ?? 0) + (Number(i.QuantityOrdered) || 0));
      const products = await productsBySku(ctx.payload, c.store, [...qty.keys()]);
      const req = await createLocalReq({}, ctx.payload);
      setStockLog(req, { reason: "other", ref: o.AmazonOrderId, note: `Amazon order ${o.AmazonOrderId}${want === "put-back" ? " cancelled" : ""}` });
      for (const [sku, n] of qty) {
        const p = products.get(sku);
        if (p && n > 0) await addStock(ctx.payload, p.id, want === "taken" ? -n : n, req);
      }
      seen[o.AmazonOrderId] = want;
      if (want === "taken") taken++;
      else returned++;
      await sleep(2100);
    }
    if (o.LastUpdateDate && Date.parse(o.LastUpdateDate) > Date.parse(cursor)) cursor = new Date(Date.parse(o.LastUpdateDate)).toISOString();
  }
  const keys = Object.keys(seen);
  for (const k of keys.slice(0, Math.max(0, keys.length - 1500))) delete seen[k];
  // a run that stopped early looks at the same window again next time (handled orders are remembered)
  return { taken, returned, cursor: capped ? since : cursor, seen };
}

/** Our stock (and price) for SKUs that changed since last sent – one listing at a time (Amazon allows 5 a second), 100 a run. */
async function pushStock(ctx: Ctx) {
  const c = ctx.connection;
  const m = market(c.config.marketplace);
  const sellerId = String(c.state.sellerId ?? "");
  if (!sellerId) throw new IntegrationError("Amazon: the seller account isn’t known – connect again.", 400);
  const store = (await ctx.payload.findByID({ collection: "stores", id: c.store, depth: 0, overrideAccess: true })) as unknown as { currency?: string };
  const withPrice = c.config.sendPrices === true && String(store.currency || "").toUpperCase() === m.currency;
  const pushed = { ...((c.state.pushed as Record<string, string> | undefined) ?? {}) };
  let sent = 0;
  for (const [sku, p] of await productsBySku(ctx.payload, c.store)) {
    const mark = withPrice ? `${p.stock}|${p.price}` : `${p.stock}`;
    if (pushed[sku] === mark) continue;
    if (sent >= 100) break;
    const patches: Record<string, unknown>[] = [{ op: "merge", path: "/attributes/fulfillment_availability", value: [{ fulfillment_channel_code: "DEFAULT", quantity: p.stock }] }];
    if (withPrice && p.price > 0) patches.push({ op: "merge", path: "/attributes/purchasable_offer", value: [{ currency: m.currency, audience: "ALL", marketplace_id: m.id, our_price: [{ schedule: [{ value_with_tax: p.price }] }] }] });
    try {
      await sp(ctx, `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${m.id}`, { method: "PATCH", body: { productType: "PRODUCT", patches } });
      pushed[sku] = mark;
      sent++;
    } catch (e) {
      // a SKU that isn't listed on Amazon: remember it as "sent" so it isn't retried every run until it changes
      if (/not found|does not exist|404/i.test(String((e as Error).message))) pushed[sku] = mark;
      else throw e;
    }
    await sleep(250);
  }
  return { sent, pushed };
}

const impl: ProviderImpl = {
  async test(ctx) {
    const m = market(ctx.connection.config.marketplace);
    const r = await sp<{ payload?: { marketplace?: { id?: string; name?: string } }[] }>(ctx, "/sellers/v1/marketplaceParticipations");
    const here = (r.payload ?? []).find((x) => x.marketplace?.id === m.id);
    if (!here) return { ok: false, message: "This Amazon account doesn’t sell on the chosen marketplace – choose another and connect again." };
    return { ok: true, message: `Connected to Amazon – ${here.marketplace?.name ?? m.central}.`, state: { account: here.marketplace?.name ?? "" } };
  },
  async sync(ctx) {
    const orders = await importOrders(ctx);
    await rememberForConnection(ctx.payload, ctx.connection, { state: { ordersCursor: orders.cursor, orders: orders.seen } });
    ctx.connection.state = { ...ctx.connection.state, ordersCursor: orders.cursor, orders: orders.seen };
    const stock = await pushStock(ctx);
    await rememberForConnection(ctx.payload, ctx.connection, { state: { pushed: stock.pushed } });
    const parts = [orders.taken ? `${orders.taken} Amazon order(s) taken off stock` : "", orders.returned ? `${orders.returned} cancelled order(s) put back` : "", stock.sent ? `${stock.sent} SKU(s) sent to Amazon` : ""].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  },
  oauth: {
    configured: () => oauthReady("amazon"),
    authorizeUrl: ({ state, redirectUri, options }) =>
      `https://${market(options.marketplace).central}/apps/authorize/consent?${new URLSearchParams({ application_id: process.env.AMAZON_SPAPI_APP_ID ?? "", state, redirect_uri: redirectUri, ...(process.env.AMAZON_SPAPI_DRAFT === "true" ? { version: "beta" } : {}) })}`,
    async finish(_ctx, { redirectUri, params, options }) {
      const code = params.get("spapi_oauth_code") ?? "";
      const sellerId = params.get("selling_partner_id") ?? "";
      if (!code || !sellerId) throw new IntegrationError("Amazon didn’t finish the authorisation.");
      const r = await lwa({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
      if (!r.ok || !r.data.refresh_token || !r.data.access_token) throw new IntegrationError(`Amazon: ${r.data?.error_description ?? "sign-in failed"}`, 502);
      return {
        secrets: { accessToken: r.data.access_token, refreshToken: r.data.refresh_token },
        state: { sellerId, accessExpiresAt: Date.now() + (r.data.expires_in ?? 3600) * 1000, connectedAt: new Date().toISOString() },
        config: { marketplace: options.marketplace ?? "US" },
      };
    },
  },
};

export default impl;
