import { http } from "../http";
import { cachedCities, matchCity, pkMobile } from "../couriers";
import { statusFromText } from "./courier-status";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";

/**
 * Leopards Courier (Pakistan) eCom Merchant API v2 – key + password in the body, city ids, weight in grams, a slip link
 * as the label. Errors come back as HTTP 200 with status 0.
 */

const base = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://merchantapistaging.leopardscourier.com/api" : "https://merchantapi.leopardscourier.com/api");
type Envelope = { status?: number | string; error?: unknown } & Record<string, unknown>;

const errorText = (e: unknown) => (typeof e === "string" ? e : e && typeof e === "object" ? Object.values(e as Record<string, unknown>).map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join("; ") : "request failed");

async function call(ctx: Ctx, method: string, body: Record<string, unknown> = {}): Promise<Envelope> {
  const r = await http<Envelope>(`${base(ctx)}/${method}/format/json/`, { provider: "Leopards", method: "POST", body: { api_key: ctx.connection.secrets.apiKey ?? "", api_password: ctx.connection.secrets.apiPassword ?? "", ...body } });
  if (Number(r.data?.status) !== 1) throw new IntegrationError(`Leopards: ${errorText(r.data?.error)}`, 502);
  return r.data;
}

type City = { id: number; name: string; destination: boolean };
const cities = (ctx: Ctx) =>
  cachedCities<City>(ctx, `cities-${ctx.connection.mode}`, async () =>
    (((await call(ctx, "getAllCities")).city_list as { id: number; name: string; allow_as_destination?: boolean }[] | undefined) ?? []).map((c) => ({ id: Number(c.id), name: String(c.name), destination: c.allow_as_destination !== false })),
  );

const impl: ProviderImpl = {
  async test(ctx) {
    const list = await cities(ctx);
    return { ok: true, message: `Connected to Leopards${ctx.connection.mode === "test" ? " (staging)" : ""} – ${list.length} cities.`, state: { account: `${list.length} cities` } };
  },
  courier: {
    name: "Leopards",
    async bookingOptions(ctx) {
      const list = (await cities(ctx)).filter((c) => c.destination);
      return [
        { key: "city", label: "Leopards city", options: list.map((c) => ({ label: c.name, value: String(c.id) })) },
        { key: "shipmentType", label: "Service", options: [{ label: "Overnight", value: "overnight" }, { label: "Overland", value: "overland" }, { label: "Detain", value: "detain" }], default: String(ctx.connection.config.shipmentType || "overnight") },
      ];
    },
    async book(ctx, p) {
      const list = (await cities(ctx)).filter((c) => c.destination);
      const city = p.options?.city ? Number(p.options.city) : matchCity(list, p.customer.city)?.id;
      if (!city) throw new IntegrationError(`Leopards doesn’t list “${p.customer.city}” – choose the Leopards city.`);
      const r = await call(ctx, "bookPacket", {
        booked_packet_weight: Math.max(1, Math.round(p.weightKg * 1000)),
        booked_packet_no_piece: p.pieces,
        booked_packet_collect_amount: Math.round(p.codAmount),
        booked_packet_order_id: p.orderNumber,
        origin_city: "self",
        destination_city: city,
        shipment_name_eng: "self",
        shipment_email: "self",
        shipment_phone: "self",
        shipment_address: "self",
        consignment_name_eng: p.customer.name,
        consignment_email: p.customer.email ?? "",
        consignment_phone: pkMobile(p.customer.phone),
        consignment_address: [p.customer.address, p.customer.area].filter(Boolean).join(", "),
        special_instructions: (p.note || p.description || "-").slice(0, 250),
        shipment_type: p.options?.shipmentType || String(ctx.connection.config.shipmentType || "overnight"),
      });
      if (!r.track_number) throw new IntegrationError("Leopards didn’t return a tracking number.");
      return { trackingNumber: String(r.track_number), labelUrl: typeof r.slip_link === "string" ? r.slip_link : null, courierName: "Leopards" };
    },
    async track(ctx, tn) {
      const r = await call(ctx, "trackBookedPacket", { track_numbers: tn });
      const p = ((r.packet_list as Record<string, unknown>[] | undefined) ?? [])[0];
      const text = String(p?.booked_packet_status ?? "");
      const remarks = String(p?.status_remarks ?? p?.status_reamrks ?? "").trim();
      return { status: statusFromText(text), detail: remarks && remarks !== "-" ? `${text} (${remarks})` : text };
    },
    async remittance(ctx, tn) {
      const r = await http<Envelope>(`${base(ctx)}/getPaymentDetails/format/json/?api_key=${encodeURIComponent(ctx.connection.secrets.apiKey ?? "")}&api_password=${encodeURIComponent(ctx.connection.secrets.apiPassword ?? "")}&cn_numbers=${encodeURIComponent(tn)}`, { provider: "Leopards" });
      const p = ((r.data?.payment_list as Record<string, unknown>[] | undefined) ?? [])[0];
      const ref = String(p?.invoice_cheque_no ?? "").trim();
      const paid = /paid/i.test(String(p?.status ?? "")) && !/un\s*paid|pending/i.test(String(p?.status ?? ""));
      return paid || (ref && ref !== "-") ? { at: String(p?.invoice_cheque_date ?? "") || null, ref: ref && ref !== "-" ? ref : null } : null;
    },
    async cancel(ctx, tn) {
      await call(ctx, "cancelBookedPackets", { cn_numbers: tn });
    },
  },
};

export default impl;
