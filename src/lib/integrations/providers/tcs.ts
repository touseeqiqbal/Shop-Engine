import { http } from "../http";
import { cachedCities, matchCity, pkMobile } from "../couriers";
import { statusFromText } from "./courier-status";
import { IntegrationError, type Ctx, type ProviderImpl, type TrackingStatus } from "../types";

/**
 * TCS (Pakistan) – the current eCom API (ociconnect): a Bearer token (given by TCS, or from client id + secret), then an
 * eCom access token from the ENVIO username + password. Labels are PDFs; COD settlement per consignment.
 */

const base = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://devconnect.tcscourier.com" : "https://ociconnect.tcscourier.com");

/** tokens per connection, kept until shortly before they expire */
const tokens = new Map<number, { bearer: string; bearerExp: number; access: string; accessExp: number }>();

async function auth(ctx: Ctx, fresh = false) {
  const c = ctx.connection;
  const now = Date.now();
  const cached = tokens.get(c.id);
  if (!fresh && cached && cached.accessExp > now + 60_000 && cached.bearerExp > now + 60_000) return cached;
  let bearer = c.secrets.bearerToken ?? "";
  let bearerExp = now + 3600_000 * 24 * 30;
  if (!bearer) {
    const r = await http<{ result?: { accessToken?: string; expiry?: string } }>(`${base(ctx)}/auth/api/auth`, { provider: "TCS", method: "POST", body: { clientid: String(c.config.clientId ?? ""), clientsecret: c.secrets.clientSecret ?? "" } });
    if (!r.ok || !r.data.result?.accessToken) throw new IntegrationError("TCS: the client id or client secret isn’t right.");
    bearer = r.data.result.accessToken;
    bearerExp = Date.parse(r.data.result.expiry ?? "") || now + 3600_000;
  }
  const t = await http<{ accesstoken?: string; expiry?: string; message?: string }>(`${base(ctx)}/ecom/api/authentication/token?username=${encodeURIComponent(String(c.config.username ?? ""))}&password=${encodeURIComponent(c.secrets.password ?? "")}`, { provider: "TCS", headers: { authorization: `Bearer ${bearer}` } });
  if (!t.ok || !t.data.accesstoken) throw new IntegrationError(`TCS: ${t.data.message ?? "the ENVIO username or password isn’t right"}.`);
  const out = { bearer, bearerExp, access: t.data.accesstoken, accessExp: Date.parse(t.data.expiry ?? "") || now + 3600_000 };
  tokens.set(c.id, out);
  return out;
}

async function get<T>(ctx: Ctx, path: string, withAccess = true): Promise<T> {
  for (const fresh of [false, true]) {
    const a = await auth(ctx, fresh);
    const url = `${base(ctx)}${path}${withAccess ? `${path.includes("?") ? "&" : "?"}accesstoken=${encodeURIComponent(a.access)}` : ""}`;
    const r = await http<T>(url, { provider: "TCS", headers: { authorization: `Bearer ${a.bearer}` } });
    if (r.status === 401 && !fresh) continue;
    return r.data;
  }
  throw new IntegrationError("TCS: sign-in failed.");
}

type City = { name: string; code: string };
const cities = (ctx: Ctx) =>
  cachedCities<City>(ctx, `cities-${ctx.connection.mode}`, async () => ((await get<{ data?: { citycode: string; cityname: string }[] }>(ctx, "/ecom/api/setup/citylistbycountry?countrycode=PK", false)).data ?? []).map((c) => ({ name: c.cityname, code: c.citycode })));

/** TCS delivery codes (deliveryinfo[].code) – checked before the words. */
const CODES: Record<string, TrackingStatus> = { OK: "delivered", BR: "delivered", DH: "delivered", DE: "delivered", DC: "delivered", TP: "delivered", OD: "out_for_delivery", RS: "returned", RD: "failed", CL: "cancelled", BT: "booked", PO: "in_transit", ATF: "in_transit", DTF: "in_transit", HN: "failed", RC: "failed", NM: "failed", BA: "failed", IA: "failed" };

const impl: ProviderImpl = {
  async test(ctx) {
    await auth(ctx, true);
    const list = await cities(ctx);
    return { ok: true, message: `Connected to TCS${ctx.connection.mode === "test" ? " (sandbox)" : ""} – ${list.length} cities.`, state: { account: String(ctx.connection.config.tcsAccount ?? "TCS") } };
  },
  courier: {
    name: "TCS",
    async bookingOptions(ctx) {
      return [{ key: "city", label: "TCS city", options: (await cities(ctx)).map((c) => ({ label: c.name, value: `${c.code}|${c.name}` })) }];
    },
    async book(ctx, p) {
      const c = ctx.connection.config;
      const chosen = p.options?.city?.split("|");
      const match = chosen?.length === 2 ? { code: chosen[0], name: chosen[1] } : matchCity(await cities(ctx), p.customer.city);
      if (!match) throw new IntegrationError(`TCS doesn’t list “${p.customer.city}” – choose the TCS city.`);
      const name = p.customer.name.trim().length >= 3 ? p.customer.name.trim() : `${p.customer.name.trim()}   `.slice(0, 3);
      const body = {
        consignmentno: null,
        shipperinfo: { tcsaccount: String(c.tcsAccount), shippername: String(c.shipperName), address1: String(c.shipperAddress), countrycode: "PK", countryname: "Pakistan", citycode: String(c.shipperCityCode ?? ""), cityname: String(c.shipperCityName), mobile: pkMobile(String(c.shipperMobile ?? "")) },
        consigneeinfo: { firstname: name.slice(0, 50), address1: [p.customer.address, p.customer.area].filter(Boolean).join(", ").slice(0, 120), countrycode: "PK", countryname: "Pakistan", citycode: match.code, cityname: match.name, mobile: pkMobile(p.customer.phone), ...(p.customer.email ? { email: p.customer.email } : {}) },
        vendorinfo: {},
        shipmentinfo: { costcentercode: String(c.costCenterCode ?? ""), referenceno: p.orderNumber, contentdesc: p.description.slice(0, 999), servicecode: "O", currency: "PKR", codamount: Math.round(p.codAmount), weightinkg: Math.max(0.5, p.weightKg), pieces: p.pieces, fragile: false, remarks: (p.note ?? "").slice(0, 500) },
      };
      for (const fresh of [false, true]) {
        const a = await auth(ctx, fresh);
        const r = await http<{ consignmentNo?: string; message?: string; error?: Record<string, string>[] }>(`${base(ctx)}/ecom/api/booking/create`, { provider: "TCS", method: "POST", headers: { authorization: `Bearer ${a.bearer}` }, body: { accesstoken: a.access, ...body } });
        if (r.status === 401 && !fresh) continue;
        if (!r.data.consignmentNo) throw new IntegrationError(`TCS: ${r.data.error?.map((e) => Object.values(e).join(" ")).join("; ") || r.data.message || "booking failed"}`);
        return { trackingNumber: String(r.data.consignmentNo), courierName: "TCS" };
      }
      throw new IntegrationError("TCS: sign-in failed.");
    },
    async track(ctx, tn) {
      const d = await get<{ deliveryinfo?: { status?: string; code?: string | null }[]; checkpoints?: { status?: string }[]; message?: string }>(ctx, `/tracking/api/Tracking/GetDynamicTrackDetail?consignee=${encodeURIComponent(tn)}&timezone=false`, false);
      const latest = d.deliveryinfo?.[0];
      const text = latest?.status ?? d.checkpoints?.[0]?.status ?? "";
      const byCode = latest?.code ? CODES[latest.code.toUpperCase()] : undefined;
      return { status: byCode ?? statusFromText(text), detail: text };
    },
    async remittance(ctx, tn) {
      const d = await get<{ detail?: Record<string, unknown>[] | null }>(ctx, `/ecom/api/Payment/status?customerno=${encodeURIComponent(String(ctx.connection.config.customerNo ?? ""))}&cnno=${encodeURIComponent(tn)}`, false);
      const row = d.detail?.[0];
      return row && String(row["payment status"] ?? "").toUpperCase() === "Y" ? { amount: Number(row["amount paid"]) || null, at: (row["payment date"] as string) || null } : null;
    },
    async cancel(ctx, tn) {
      const a = await auth(ctx);
      const r = await http<{ message?: string }>(`${base(ctx)}/ecom/api/booking/cancel`, { provider: "TCS", method: "POST", headers: { authorization: `Bearer ${a.bearer}` }, body: { accesstoken: a.access, consignmentnumber: tn } });
      if (!/success/i.test(r.data.message ?? "")) throw new IntegrationError(`TCS: ${r.data.message ?? "couldn’t cancel"}`);
    },
    async label(ctx, tn) {
      const a = await auth(ctx);
      const res = await fetch(`${base(ctx)}/ecom/api/print/label?accesstoken=${encodeURIComponent(a.access)}&consignmentno=${encodeURIComponent(tn)}&shipperDetails=true&printtype=3`, { headers: { authorization: `Bearer ${a.bearer}` }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) throw new IntegrationError("TCS didn’t return the label – try again, or print it from ENVIO.");
      return { pdf: Buffer.from(await res.arrayBuffer()) };
    },
  },
};

export default impl;
