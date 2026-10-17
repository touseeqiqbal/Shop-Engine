import { http, providerMessage } from "../http";
import { oauthReady } from "../oauth";
import { loadOrder, type OrderForIntegrations } from "../order-data";
import { rememberForConnection } from "../server";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";
import { accessToken, basicAuth } from "./oauth-tokens";

/**
 * QuickBooks Online (the store's own company, signed in through ShopEngine's Intuit app): each order whose money is in
 * (paid online, or delivered) becomes a SalesReceipt numbered with the order number – never twice.
 *   QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET   the app (developer.intuit.com)
 *   QUICKBOOKS_SANDBOX=true                           the app's development keys (sandbox companies)
 */

const AUTH = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const api = () => (process.env.QUICKBOOKS_SANDBOX === "true" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com");
const MINOR = "minorversion=75";

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

async function tokenCall(body: Record<string, string>) {
  return http<TokenResponse>(TOKEN, { provider: "QuickBooks", method: "POST", headers: { authorization: basicAuth(process.env.QUICKBOOKS_CLIENT_ID, process.env.QUICKBOOKS_CLIENT_SECRET) }, body: new URLSearchParams(body) });
}

const token = (ctx: Ctx) =>
  accessToken(ctx, "QuickBooks", async (refresh) => {
    const r = await tokenCall({ grant_type: "refresh_token", refresh_token: refresh });
    if (r.data?.error === "invalid_grant") return "expired";
    if (!r.ok || !r.data.access_token) throw new IntegrationError(`QuickBooks: ${providerMessage(r.data) ?? `couldn’t renew the sign-in (${r.status})`}`, 502);
    return { accessToken: r.data.access_token, refreshToken: r.data.refresh_token, expiresIn: r.data.expires_in ?? 3600 };
  });

function realm(ctx: Ctx) {
  const id = String(ctx.connection.state.realmId ?? "");
  if (!/^\d+$/.test(id)) throw new IntegrationError("QuickBooks: no company chosen – connect again.", 400);
  return id;
}

async function qbo<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await http<T & { Fault?: { Error?: { Message?: string; Detail?: string }[] } }>(`${api()}/v3/company/${realm(ctx)}${path}${sep}${MINOR}`, { provider: "QuickBooks", method: init.method, body: init.body, headers: { authorization: `Bearer ${await token(ctx)}` } });
  if (!r.ok) {
    const e = r.data?.Fault?.Error?.[0];
    throw new IntegrationError(`QuickBooks: ${e?.Detail ?? e?.Message ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  }
  return r.data as T;
}

const query = <T>(ctx: Ctx, q: string) => qbo<{ QueryResponse?: T }>(ctx, `/query?query=${encodeURIComponent(q)}`).then((r) => r.QueryResponse ?? ({} as T));
const quote = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const money = (n: number) => Math.round(n * 100) / 100;

/** The service item every line is booked to (found by name, else made with the first income account). */
async function itemId(ctx: Ctx): Promise<string> {
  const name = String(ctx.connection.config.itemName || "ShopEngine sales").slice(0, 100);
  if (ctx.connection.state.itemId && ctx.connection.state.itemName === name) return String(ctx.connection.state.itemId);
  let id = (await query<{ Item?: { Id: string }[] }>(ctx, `select Id from Item where Name = '${quote(name)}'`)).Item?.[0]?.Id;
  if (!id) {
    const account = (await query<{ Account?: { Id: string }[] }>(ctx, "select Id from Account where AccountType = 'Income' maxresults 1")).Account?.[0]?.Id;
    if (!account) throw new IntegrationError("QuickBooks: the company has no income account to book sales to.", 400);
    id = (await qbo<{ Item: { Id: string } }>(ctx, "/item", { method: "POST", body: { Name: name, Type: "Service", IncomeAccountRef: { value: account } } })).Item.Id;
  }
  await rememberForConnection(ctx.payload, ctx.connection, { state: { itemId: id, itemName: name } });
  return id;
}

/** The receipt's lines: items, delivery, whatever else makes up the total (tax added on top), minus the discount. */
export function receiptLines(o: OrderForIntegrations, item: string) {
  const line = (description: string, qty: number, unit: number) => ({ Amount: money(qty * unit), DetailType: "SalesItemLineDetail", Description: description.slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: item }, Qty: qty, UnitPrice: money(unit) } });
  const lines: Record<string, unknown>[] = o.items.map((i) => line(i.sku ? `${i.title} (${i.sku})` : i.title, i.qty, i.unitPrice));
  if (o.deliveryCharge > 0) lines.push(line("Delivery", 1, o.deliveryCharge));
  const sum = lines.reduce((s, l) => s + Number(l.Amount), 0);
  const rest = money(o.total - (sum - o.discount));
  if (rest > 0.004) lines.push(line("Tax and charges", 1, rest));
  if (o.discount > 0) lines.push({ Amount: money(o.discount), DetailType: "DiscountLineDetail", DiscountLineDetail: { PercentBased: false } });
  return lines;
}

/** A refund made through ShopEngine → a RefundReceipt paid from the company's first bank account (never twice). */
async function bookRefund(ctx: Ctx, d: Record<string, unknown>) {
  const amount = Number(d.amount);
  const orderId = Number(d.orderId);
  if (!(amount > 0) || !orderId || String(d.status) === "failed") return;
  const o = await loadOrder(ctx.payload, orderId);
  if (!o || o.storeId !== ctx.connection.store) return;
  const number = `R${String(d.refundId ?? `${orderId}-${amount}`).replace(/[^A-Za-z0-9-]/g, "").slice(-20)}`.slice(0, 21);
  if ((await query<{ RefundReceipt?: unknown[] }>(ctx, `select Id from RefundReceipt where DocNumber = '${quote(number)}'`)).RefundReceipt?.length) return;
  const bank = (await query<{ Account?: { Id: string }[] }>(ctx, "select Id from Account where AccountType = 'Bank' maxresults 1")).Account?.[0]?.Id;
  if (!bank) throw new IntegrationError("QuickBooks: add a bank account to the company so refunds can be recorded.", 400);
  await qbo(ctx, "/refundreceipt", {
    method: "POST",
    body: {
      TxnDate: new Date().toISOString().slice(0, 10),
      DocNumber: number,
      PrivateNote: `Refund for ShopEngine order ${o.orderNumber}`.slice(0, 4000),
      DepositToAccountRef: { value: bank },
      Line: [{ Amount: money(amount), DetailType: "SalesItemLineDetail", Description: `Refund – order ${o.orderNumber}`, SalesItemLineDetail: { ItemRef: { value: await itemId(ctx) }, Qty: 1, UnitPrice: money(amount) } }],
    },
  });
}

const moneyIn = (type: string, d: Record<string, unknown>) => type === "order.paid" || (type === "order.updated" && d.status === "delivered");

const impl: ProviderImpl = {
  async test(ctx) {
    const id = realm(ctx);
    const info = await qbo<{ CompanyInfo?: { CompanyName?: string } }>(ctx, `/companyinfo/${id}`);
    const name = info.CompanyInfo?.CompanyName ?? `company ${id}`;
    return { ok: true, message: `Connected to QuickBooks – ${name}.`, state: { account: name } };
  },
  async onEvent(ctx, event) {
    if (event.type === "refund.created") return bookRefund(ctx, event.data);
    if (!moneyIn(event.type, event.data)) return;
    const o = await loadOrder(ctx.payload, Number(event.data.id));
    if (!o || o.storeId !== ctx.connection.store || o.total <= 0) return;
    const number = o.orderNumber.slice(0, 21);
    // already booked (paid online, then delivered – or a retry)
    if ((await query<{ SalesReceipt?: unknown[] }>(ctx, `select Id from SalesReceipt where DocNumber = '${quote(number)}'`)).SalesReceipt?.length) return;
    await qbo(ctx, "/salesreceipt", { method: "POST", body: { TxnDate: (o.placedAt || new Date().toISOString()).slice(0, 10), DocNumber: number, PrivateNote: `ShopEngine order ${o.orderNumber} (${o.paymentMethod})`.slice(0, 4000), Line: receiptLines(o, await itemId(ctx)) } });
  },
  oauth: {
    configured: () => oauthReady("quickbooks"),
    authorizeUrl: ({ state, redirectUri }) => `${AUTH}?${new URLSearchParams({ client_id: process.env.QUICKBOOKS_CLIENT_ID ?? "", response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: redirectUri, state })}`,
    async finish(_ctx, { code, redirectUri, params }) {
      const realmId = params.get("realmId") ?? "";
      if (!/^\d+$/.test(realmId)) throw new IntegrationError("QuickBooks didn’t say which company was chosen.");
      const r = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
      if (!r.ok || !r.data.access_token || !r.data.refresh_token) throw new IntegrationError(`QuickBooks: ${providerMessage(r.data) ?? "sign-in failed"}`, 502);
      return { secrets: { accessToken: r.data.access_token, refreshToken: r.data.refresh_token }, state: { realmId, accessExpiresAt: Date.now() + (r.data.expires_in ?? 3600) * 1000, connectedAt: new Date().toISOString() }, config: { itemName: "ShopEngine sales" } };
    },
  },
};

export default impl;
