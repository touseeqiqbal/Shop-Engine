import { createHash, randomBytes } from "node:crypto";
import type { Payload } from "payload";
import { isCmsConfigured } from "@/lib/db/config";
import { rateLimitKey } from "@/lib/rate-limit";

/**
 * Store API (/api/v1/*) – for a store's own systems: an ERP or warehouse keeping stock and prices in step, an
 * accounting tool reading orders, Zapier / Make / n8n. Authenticated with an API key made in /cms → Integrations →
 * Store API ("Authorization: Bearer se_live_…"). A key only ever reaches its own store, and only what its permissions
 * allow. 120 requests a minute per key. See docs/STORE-API.md.
 */

type Doc = Record<string, unknown>;
export type ApiScope = "products:read" | "products:write" | "orders:read" | "orders:write";
export type ApiCaller = { payload: Payload; storeId: number; keyId: number; keyName: string; scopes: Set<string> };

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const newApiKey = () => `se_live_${randomBytes(24).toString("base64url")}`;

export function apiError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { status, message, ...extra } }, { status, headers: { "cache-control": "no-store" } });
}

/** The caller, or the Response to send back (401 / 403 / 429). */
export async function authenticate(req: Request, scope: ApiScope): Promise<ApiCaller | Response> {
  if (!isCmsConfigured) return apiError(503, "The store API isn’t available.");
  const header = req.headers.get("authorization") ?? "";
  const key = header.match(/^Bearer\s+(se_live_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (!key) return apiError(401, "Send your API key: Authorization: Bearer se_live_…");
  const { payloadClient } = await import("@/lib/cms/catalog-source");
  const payload = await payloadClient();
  const doc = (await payload.find({ collection: "api-keys" as never, where: { hash: { equals: hashKey(key) } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (!doc) return apiError(401, "This API key doesn’t exist or was removed.");
  if (!rateLimitKey(`store-api:${String(doc.id)}`, 120, 60_000)) return apiError(429, "Too many requests – at most 120 a minute per key.");
  const scopes = new Set(((doc.scopes as string[] | undefined) ?? []).map(String));
  if (!scopes.has(scope)) return apiError(403, `This key can’t do that – it needs the “${scope}” permission.`);
  const storeId = Number(doc.store && typeof doc.store === "object" ? (doc.store as Doc).id : doc.store);
  // the store must be open for business (not suspended / plan ended) to be changed through the API
  if (scope.endsWith(":write")) {
    const store = (await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null;
    // read-only like in /cms: suspended or closed by ShopEngine, or its plan ended
    if (!store || ["suspended", "closed"].includes(String(store.status)) || ["expired", "suspended"].includes(String(store.subscriptionStatus))) return apiError(403, "This store is read-only right now (suspended, closed or its plan ended).");
  }
  // "last used" – at most once a minute
  const last = Date.parse(String(doc.lastUsedAt ?? "")) || 0;
  if (Date.now() - last > 60_000) await payload.update({ collection: "api-keys" as never, id: Number(doc.id), data: { lastUsedAt: new Date().toISOString() } as never, overrideAccess: true, context: { system: true } }).catch(() => undefined);
  return { payload, storeId, keyId: Number(doc.id), keyName: String(doc.name ?? ""), scopes };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const relId = (v: unknown) => (v && typeof v === "object" ? Number((v as Doc).id) : v == null ? null : Number(v));

/** A product as the API shows it. */
export const productOut = (p: Doc) => ({
  id: Number(p.id),
  sku: str(p.sku) || null,
  title: str(p.title),
  slug: str(p.slug),
  status: str(p.status),
  price: num(p.price),
  compareAtPrice: num(p.compareAtPrice),
  stock: num(p.stock),
  stockStatus: str(p.stockStatus) || null,
  variantOf: relId(p.variantOf),
  updatedAt: str(p.updatedAt),
});

/** An order as the API shows it (no internal notes). */
export const orderOut = (o: Doc) => {
  const c = (o.customer ?? {}) as Doc;
  return {
    id: Number(o.id),
    orderNumber: str(o.orderNumber),
    status: str(o.status),
    paymentStatus: str(o.paymentStatus),
    paymentMethod: str(o.paymentMethod),
    currency: str(o.currency) || null,
    subtotal: num(o.subtotal),
    discount: num(o.discount),
    deliveryCharge: num(o.deliveryCharge),
    tax: num(o.taxTotal),
    total: num(o.total),
    couponCode: str(o.couponCode) || null,
    courier: str(o.courier) || null,
    trackingNumber: str(o.trackingNumber) || null,
    placedAt: str(o.placedAt),
    updatedAt: str(o.updatedAt),
    customer: { name: str(c.name), phone: str(c.phone), email: str(c.email) || null, address: str(c.address), area: str(c.area) || null, city: str(c.city), postalCode: str(c.postalCode) || null, country: str(c.country) || null },
    items: ((o.items as Doc[] | undefined) ?? []).map((i) => ({ productId: relId(i.product), sku: str(i.sku) || null, title: str(i.title), options: i.options ?? null, qty: num(i.qty), unitPrice: num(i.unitPrice) })),
    shipments: ((o.shipments as Doc[] | undefined) ?? []).map((s) => ({ courier: str(s.courier) || null, trackingNumber: str(s.trackingNumber) || null, status: str(s.status), shippedAt: str(s.shippedAt) || null, deliveredAt: str(s.deliveredAt) || null })),
  };
};

/** ?page=&limit= (max 100) */
export function paging(url: URL) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return { limit, page };
}

/** ?updated_since=ISO */
export function updatedSince(url: URL) {
  const v = url.searchParams.get("updated_since");
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? [{ updatedAt: { greater_than: new Date(t).toISOString() } }] : [];
}
