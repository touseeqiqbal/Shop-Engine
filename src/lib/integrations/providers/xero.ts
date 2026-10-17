import { http, providerMessage } from "../http";
import { oauthReady } from "../oauth";
import { loadOrder, type OrderForIntegrations } from "../order-data";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";
import { accessToken, basicAuth } from "./oauth-tokens";

/**
 * Xero (the store's own organisation, signed in through ShopEngine's Xero app): each order whose money is in (paid
 * online, or delivered) becomes an approved sales invoice with the order number as its reference – and its payment,
 * when the store gave a bank account code. Never twice (looked up by reference, plus Xero's idempotency key).
 *   XERO_CLIENT_ID / XERO_CLIENT_SECRET   the app (developer.xero.com) – granular scopes (apps made after March 2026)
 */

const AUTH = "https://login.xero.com/identity/connect/authorize";
const TOKEN = "https://identity.xero.com/connect/token";
const API = "https://api.xero.com/api.xro/2.0";
const SCOPES = "offline_access accounting.invoices accounting.payments accounting.contacts accounting.settings.read";

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

async function tokenCall(body: Record<string, string>) {
  return http<TokenResponse>(TOKEN, { provider: "Xero", method: "POST", headers: { authorization: basicAuth(process.env.XERO_CLIENT_ID, process.env.XERO_CLIENT_SECRET) }, body: new URLSearchParams(body) });
}

const token = (ctx: Ctx) =>
  accessToken(ctx, "Xero", async (refresh) => {
    const r = await tokenCall({ grant_type: "refresh_token", refresh_token: refresh });
    if (r.data?.error === "invalid_grant") return "expired";
    if (!r.ok || !r.data.access_token) throw new IntegrationError(`Xero: ${providerMessage(r.data) ?? `couldn’t renew the sign-in (${r.status})`}`, 502);
    return { accessToken: r.data.access_token, refreshToken: r.data.refresh_token, expiresIn: r.data.expires_in ?? 1800 };
  });

function tenant(ctx: Ctx) {
  const id = String(ctx.connection.state.tenantId ?? "");
  if (!id) throw new IntegrationError("Xero: no organisation chosen – connect again.", 400);
  return id;
}

async function xero<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const r = await http<T & { Elements?: { ValidationErrors?: { Message?: string }[] }[]; Message?: string; Detail?: string }>(`${API}${path}`, { provider: "Xero", method: init.method, body: init.body, headers: { authorization: `Bearer ${await token(ctx)}`, "xero-tenant-id": tenant(ctx), ...(init.headers ?? {}) } });
  if (!r.ok) {
    const v = r.data?.Elements?.[0]?.ValidationErrors?.[0]?.Message;
    throw new IntegrationError(`Xero: ${v ?? r.data?.Detail ?? r.data?.Message ?? providerMessage(r.data) ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  }
  return r.data as T;
}

const money = (n: number) => Math.round(n * 100) / 100;

/** The invoice's lines (no tax calculated by Xero – our total is the total): items, delivery, the rest, the discount. */
export function invoiceLines(o: OrderForIntegrations, account: string, taxType: string) {
  const line = (description: string, qty: number, unit: number) => ({ Description: description.slice(0, 4000), Quantity: qty, UnitAmount: money(unit), AccountCode: account, TaxType: taxType });
  const lines = o.items.map((i) => line(i.sku ? `${i.title} (${i.sku})` : i.title, i.qty, i.unitPrice));
  if (o.deliveryCharge > 0) lines.push(line("Delivery", 1, o.deliveryCharge));
  const sum = lines.reduce((s, l) => s + money(l.Quantity * l.UnitAmount), 0);
  const rest = money(o.total - (sum - o.discount));
  if (rest > 0.004) lines.push(line("Tax and charges", 1, rest));
  if (o.discount > 0) lines.push(line("Discount", 1, -o.discount));
  return lines;
}

/**
 * A refund made through ShopEngine → an approved credit note with the order number as its reference, allocated to the
 * order's invoice while that still has something to pay (never twice: Xero's idempotency key per refund).
 */
async function bookRefund(ctx: Ctx, d: Record<string, unknown>) {
  const amount = Number(d.amount);
  const orderId = Number(d.orderId);
  if (!(amount > 0) || !orderId || String(d.status) === "failed") return;
  const o = await loadOrder(ctx.payload, orderId);
  if (!o || o.storeId !== ctx.connection.store) return;
  const cfg = ctx.connection.config;
  const date = new Date().toISOString().slice(0, 10);
  const key = `shopengine-credit-${o.storeId}-${String(d.refundId ?? `${orderId}-${amount}`)}`.slice(0, 128);
  const r = await xero<{ CreditNotes?: { CreditNoteID?: string; HasErrors?: boolean; ValidationErrors?: { Message?: string }[] }[] }>(ctx, "/CreditNotes?summarizeErrors=false", {
    method: "PUT",
    headers: { "Idempotency-Key": key },
    body: { CreditNotes: [{ Type: "ACCRECCREDIT", Contact: { Name: String(cfg.contactName || "Online shop customers").slice(0, 255) }, Date: date, Reference: o.orderNumber, Status: "AUTHORISED", LineAmountTypes: "NoTax", CurrencyCode: o.currency, LineItems: [{ Description: `Refund – order ${o.orderNumber}`, Quantity: 1, UnitAmount: money(amount), AccountCode: String(cfg.salesAccount || "200"), TaxType: String(cfg.taxType || "NONE") }] }] },
  });
  const note = r.CreditNotes?.[0];
  if (!note?.CreditNoteID || note.HasErrors) throw new IntegrationError(`Xero: ${note?.ValidationErrors?.[0]?.Message ?? "the credit note wasn’t accepted"}`, 400);
  // put it against the order's invoice while that is still open
  const where = encodeURIComponent(`Reference=="${o.orderNumber.replace(/"/g, "")}" AND Type=="ACCREC" AND Status=="AUTHORISED"`);
  const inv = (await xero<{ Invoices?: { InvoiceID?: string; AmountDue?: number }[] }>(ctx, `/Invoices?where=${where}`)).Invoices?.[0];
  if (inv?.InvoiceID && Number(inv.AmountDue) > 0)
    await xero(ctx, `/CreditNotes/${note.CreditNoteID}/Allocations`, { method: "PUT", body: { Allocations: [{ Invoice: { InvoiceID: inv.InvoiceID }, Amount: money(Math.min(amount, Number(inv.AmountDue))), Date: date }] } }).catch(() => undefined);
}

const moneyIn = (type: string, d: Record<string, unknown>) => type === "order.paid" || (type === "order.updated" && d.status === "delivered");

const impl: ProviderImpl = {
  async test(ctx) {
    const r = await xero<{ Organisations?: { Name?: string; BaseCurrency?: string }[] }>(ctx, "/Organisation");
    const org = r.Organisations?.[0];
    return { ok: true, message: `Connected to Xero – ${org?.Name ?? "organisation"}${org?.BaseCurrency ? ` (${org.BaseCurrency})` : ""}.`, state: { account: org?.Name ?? "" } };
  },
  async onEvent(ctx, event) {
    if (event.type === "refund.created") return bookRefund(ctx, event.data);
    if (!moneyIn(event.type, event.data)) return;
    const o = await loadOrder(ctx.payload, Number(event.data.id));
    if (!o || o.storeId !== ctx.connection.store || o.total <= 0) return;
    const where = encodeURIComponent(`Reference=="${o.orderNumber.replace(/"/g, "")}" AND Type=="ACCREC" AND Status!="VOIDED" AND Status!="DELETED"`);
    if ((await xero<{ Invoices?: unknown[] }>(ctx, `/Invoices?where=${where}&summaryOnly=true`)).Invoices?.length) return;
    const cfg = ctx.connection.config;
    const date = (o.placedAt || new Date().toISOString()).slice(0, 10);
    const created = await xero<{ Invoices?: { InvoiceID?: string; HasErrors?: boolean; ValidationErrors?: { Message?: string }[] }[] }>(ctx, "/Invoices?summarizeErrors=false", {
      method: "PUT",
      headers: { "Idempotency-Key": `shopengine-invoice-${o.storeId}-${o.id}` },
      body: {
        Invoices: [
          {
            Type: "ACCREC",
            Contact: { Name: String(cfg.contactName || "Online shop customers").slice(0, 255) },
            Date: date,
            DueDate: date,
            Reference: o.orderNumber,
            Status: "AUTHORISED",
            LineAmountTypes: "NoTax",
            CurrencyCode: o.currency,
            LineItems: invoiceLines(o, String(cfg.salesAccount || "200"), String(cfg.taxType || "NONE")),
          },
        ],
      },
    });
    const inv = created.Invoices?.[0];
    if (!inv?.InvoiceID || inv.HasErrors) throw new IntegrationError(`Xero: ${inv?.ValidationErrors?.[0]?.Message ?? "the invoice wasn’t accepted"}`, 400);
    const bank = String(cfg.paymentAccount || "").trim();
    if (bank) await xero(ctx, "/Payments", { method: "PUT", headers: { "Idempotency-Key": `shopengine-payment-${o.storeId}-${o.id}` }, body: { Payments: [{ Invoice: { InvoiceID: inv.InvoiceID }, Account: { Code: bank }, Date: date, Amount: money(o.total), Reference: o.paymentMethod.slice(0, 255) }] } });
  },
  oauth: {
    configured: () => oauthReady("xero"),
    authorizeUrl: ({ state, redirectUri }) => `${AUTH}?${new URLSearchParams({ response_type: "code", client_id: process.env.XERO_CLIENT_ID ?? "", redirect_uri: redirectUri, scope: SCOPES, state })}`,
    async finish(_ctx, { code, redirectUri }) {
      const r = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
      if (!r.ok || !r.data.access_token || !r.data.refresh_token) throw new IntegrationError(`Xero: ${providerMessage(r.data) ?? "sign-in failed"}`, 502);
      // which organisation: the one chosen on Xero's page (the newest connection)
      const conns = await http<{ tenantId: string; tenantType: string; tenantName: string; updatedDateUtc?: string }[]>("https://api.xero.com/connections", { provider: "Xero", headers: { authorization: `Bearer ${r.data.access_token}` } });
      const orgs = (Array.isArray(conns.data) ? conns.data : []).filter((t) => t.tenantType === "ORGANISATION").sort((a, b) => String(b.updatedDateUtc ?? "").localeCompare(String(a.updatedDateUtc ?? "")));
      if (!orgs.length) throw new IntegrationError("Xero: no organisation was chosen.");
      return { secrets: { accessToken: r.data.access_token, refreshToken: r.data.refresh_token }, state: { tenantId: orgs[0].tenantId, account: orgs[0].tenantName, accessExpiresAt: Date.now() + (r.data.expires_in ?? 1800) * 1000, connectedAt: new Date().toISOString() }, config: { salesAccount: "200", taxType: "NONE", contactName: "Online shop customers" } };
    },
  },
};

export default impl;
