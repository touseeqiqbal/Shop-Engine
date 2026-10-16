import { http } from "../http";
import { cachedCities, matchCity, pkMobile } from "../couriers";
import { statusFromText } from "./courier-status";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";

/**
 * PostEx (Pakistan) merchant API v4 – header "token", cities by name, PDF airway bills, COD settlement per parcel.
 * New orders are "Unbooked" until a load sheet is generated in PostEx (or the parcel is picked up).
 */

const BASE = "https://api.postex.pk/services/integration/api/order";
type Envelope<T> = { statusCode?: string | number; statusMessage?: string; dist?: T; message?: string; error?: string };

async function call<T>(ctx: Ctx, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await http<Envelope<T>>(`${BASE}${path}`, { provider: "PostEx", method: init.method, body: init.body, headers: { token: ctx.connection.secrets.apiToken ?? "" } });
  if (String(r.data?.statusCode ?? "") !== "200") throw new IntegrationError(`PostEx: ${r.data?.statusMessage ?? r.data?.message ?? r.data?.error ?? `request failed (${r.status})`}`, r.status === 401 ? 400 : 502);
  return r.data.dist as T;
}

type City = { name: string; delivery: boolean };
const cities = (ctx: Ctx) =>
  cachedCities<City>(ctx, "cities", async () =>
    (await call<{ operationalCityName: string; isDeliveryCity: boolean | string }[]>(ctx, "/v2/get-operational-city")).map((c) => ({ name: c.operationalCityName, delivery: c.isDeliveryCity === true || c.isDeliveryCity === "true" })),
  );

const impl: ProviderImpl = {
  async test(ctx) {
    const list = await call<{ operationalCityName: string }[]>(ctx, "/v2/get-operational-city");
    const addresses = await call<{ addressCode: string }[]>(ctx, "/v1/get-merchant-address").catch(() => []);
    return { ok: true, message: `Connected to PostEx – ${list.length} cities, ${addresses.length} pickup address(es).`, state: { account: `${list.length} cities` } };
  },
  courier: {
    name: "PostEx",
    async bookingOptions(ctx) {
      const [list, addresses] = await Promise.all([cities(ctx), call<{ addressCode: string; address: string; cityName: string }[]>(ctx, "/v1/get-merchant-address").catch(() => [])]);
      return [
        { key: "city", label: "PostEx city", options: list.filter((c) => c.delivery).map((c) => ({ label: c.name, value: c.name })) },
        ...(addresses.length ? [{ key: "pickupAddressCode", label: "Pickup address", options: addresses.map((a) => ({ label: `${a.cityName} – ${a.address}`.slice(0, 90), value: a.addressCode })), default: String(ctx.connection.config.pickupAddressCode || addresses[0].addressCode) }] : []),
      ];
    },
    async book(ctx, p) {
      const city = p.options?.city || matchCity((await cities(ctx)).filter((c) => c.delivery), p.customer.city)?.name;
      if (!city) throw new IntegrationError(`PostEx doesn’t deliver to “${p.customer.city}” under that name – choose the PostEx city.`);
      const dist = await call<{ trackingNumber?: string; orderStatus?: string }>(ctx, "/v3/create-order", {
        method: "POST",
        body: {
          orderRefNumber: p.orderNumber,
          invoicePayment: Math.round(p.codAmount),
          orderDetail: p.description,
          customerName: p.customer.name,
          customerPhone: pkMobile(p.customer.phone),
          deliveryAddress: [p.customer.address, p.customer.area].filter(Boolean).join(", "),
          transactionNotes: p.note ?? "",
          cityName: city,
          invoiceDivision: 1,
          items: p.pieces,
          ...(p.options?.pickupAddressCode || ctx.connection.config.pickupAddressCode ? { pickupAddressCode: p.options?.pickupAddressCode || String(ctx.connection.config.pickupAddressCode) } : {}),
          orderType: "Normal",
        },
      });
      if (!dist?.trackingNumber) throw new IntegrationError("PostEx didn’t return a tracking number.");
      return { trackingNumber: String(dist.trackingNumber), courierName: "PostEx" };
    },
    async track(ctx, tn) {
      const d = await call<{ transactionStatus?: string; transactionStatusHistory?: { transactionStatusMessage?: string }[] }>(ctx, `/v1/track-order/${encodeURIComponent(tn)}`);
      const text = d?.transactionStatus ?? d?.transactionStatusHistory?.[0]?.transactionStatusMessage ?? "";
      return { status: statusFromText(text), detail: text };
    },
    async remittance(ctx, tn) {
      const d = await call<{ settle?: boolean; settlementDate?: string; cprNumber_1?: string; cprNumber_2?: string; upfrontPaymentDate?: string }>(ctx, `/v1/payment-status/${encodeURIComponent(tn)}`);
      return d?.settle ? { at: d.settlementDate || d.upfrontPaymentDate || null, ref: d.cprNumber_2 || d.cprNumber_1 || null } : null;
    },
    async cancel(ctx, tn) {
      await call(ctx, "/v1/cancel-order", { method: "PUT", body: { trackingNumber: tn } });
    },
    async label(ctx, tn) {
      const res = await fetch(`${BASE}/v1/get-invoice?trackingNumbers=${encodeURIComponent(tn)}`, { headers: { token: ctx.connection.secrets.apiToken ?? "" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) throw new IntegrationError("PostEx didn’t return the airway bill – try again, or print it from your PostEx portal.");
      return { pdf: Buffer.from(await res.arrayBuffer()) };
    },
  },
};

export default impl;
