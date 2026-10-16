import { http } from "../http";
import { cachedCities, matchCity, pkMobile } from "../couriers";
import { statusFromText } from "./courier-status";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";

/**
 * Trax (sonic.pk, Pakistan) merchant API – the raw API key in "Authorization", form fields, city ids, status 0 = OK.
 */

const base = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://app.sonic.pk/api" : "https://sonic.pk/api");
type Envelope = { status?: number | string; message?: string; errors?: Record<string, string[]> } & Record<string, unknown>;

async function call(ctx: Ctx, path: string, form?: URLSearchParams): Promise<Envelope> {
  const r = await http<Envelope>(`${base(ctx)}${path}`, { provider: "Trax", method: form ? "POST" : "GET", headers: { authorization: ctx.connection.secrets.apiKey ?? "" }, ...(form ? { body: form } : {}) });
  if (Number(r.data?.status) !== 0) {
    const detail = r.data?.errors ? Object.values(r.data.errors).flat().join("; ") : "";
    throw new IntegrationError(`Trax: ${[r.data?.message, detail].filter(Boolean).join(" – ") || `request failed (${r.status})`}`, 502);
  }
  return r.data;
}

type City = { id: number; name: string };
const cities = (ctx: Ctx) => cachedCities<City>(ctx, `cities-${ctx.connection.mode}`, async () => (((await call(ctx, "/cities")).cities as { id: number; name: string }[] | undefined) ?? []).map((c) => ({ id: Number(c.id), name: String(c.name) })));

const impl: ProviderImpl = {
  async test(ctx) {
    const [list, pickups] = await Promise.all([cities(ctx), call(ctx, "/pickup_addresses").then((r) => (r.pickup_addresses as unknown[] | undefined) ?? [])]);
    return { ok: true, message: `Connected to Trax${ctx.connection.mode === "test" ? " (staging)" : ""} – ${list.length} cities, ${pickups.length} pickup address(es).`, state: { account: `${list.length} cities` } };
  },
  courier: {
    name: "Trax",
    async bookingOptions(ctx) {
      const [list, pickups] = await Promise.all([cities(ctx), call(ctx, "/pickup_addresses").then((r) => (r.pickup_addresses as { id: number; address: string; city?: { name?: string }; default?: unknown }[] | undefined) ?? [])]);
      return [
        { key: "city", label: "Trax city", options: list.map((c) => ({ label: c.name, value: String(c.id) })) },
        { key: "pickupAddressId", label: "Pickup address", options: pickups.map((p) => ({ label: `${p.city?.name ?? ""} – ${p.address}`.slice(0, 90), value: String(p.id) })), default: String(ctx.connection.config.pickupAddressId || pickups.find((p) => Number(p.default) === 1)?.id || pickups[0]?.id || "") },
        { key: "shippingMode", label: "Service", options: [{ label: "Rush", value: "1" }, { label: "Saver Plus", value: "2" }, { label: "Swift", value: "3" }], default: String(ctx.connection.config.shippingMode || "1") },
      ];
    },
    async book(ctx, p) {
      const c = ctx.connection.config;
      const city = p.options?.city ? Number(p.options.city) : matchCity(await cities(ctx), p.customer.city)?.id;
      if (!city) throw new IntegrationError(`Trax doesn’t list “${p.customer.city}” – choose the Trax city.`);
      const pickup = p.options?.pickupAddressId || String(c.pickupAddressId ?? "");
      if (!pickup) throw new IntegrationError("Choose the Trax pickup address.");
      const form = new URLSearchParams({
        service_type_id: "1",
        pickup_address_id: pickup,
        information_display: "1",
        consignee_city_id: String(city),
        consignee_name: p.customer.name.slice(0, 100),
        consignee_address: [p.customer.address, p.customer.area].filter(Boolean).join(", ").slice(0, 190),
        consignee_phone_number_1: pkMobile(p.customer.phone),
        consignee_email_address: p.customer.email || String(c.fallbackEmail ?? ""),
        order_id: p.orderNumber.slice(0, 100),
        item_product_type_id: String(c.productType || "24"),
        item_description: p.description.slice(0, 190),
        item_quantity: String(p.items.reduce((n, i) => n + i.qty, 0) || 1),
        item_insurance: "0",
        pickup_date: new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10),
        estimated_weight: String(p.weightKg),
        shipping_mode_id: p.options?.shippingMode || String(c.shippingMode || "1"),
        amount: String(Math.round(p.codAmount)),
        payment_mode_id: "1",
        charges_mode_id: String(c.chargesMode || "4"),
        pieces_quantity: String(Math.min(10, p.pieces)),
        ...(p.note ? { special_instructions: p.note.slice(0, 190) } : {}),
      });
      const r = await call(ctx, "/shipment/book", form);
      const tn = r.tracking_number ?? r["tracking number"];
      if (!tn) throw new IntegrationError("Trax didn’t return a tracking number.");
      return { trackingNumber: String(tn), courierName: "Trax" };
    },
    async track(ctx, tn) {
      const r = await call(ctx, `/shipment/track?tracking_number=${encodeURIComponent(tn)}&type=0`);
      const history = (((r.details as { tracking_history?: { status?: string; status_reason?: string | null; timestamp?: number }[] } | undefined)?.tracking_history) ?? []).filter((h) => !/^payment/i.test(h.status ?? ""));
      const latest = [...history].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0];
      const text = latest?.status ?? "";
      return { status: statusFromText(text), detail: latest?.status_reason ? `${text} (${latest.status_reason})` : text };
    },
    async remittance(ctx, tn) {
      const r = await call(ctx, `/shipment/payments?tracking_number=${encodeURIComponent(tn)}`).catch(() => null);
      if (!r || !/processed/i.test(String(r.current_payment_status ?? ""))) return null;
      const last = ((r.payments as { id?: number; datetime?: string; payable?: string | number }[] | undefined) ?? []).slice(-1)[0];
      return { amount: last ? Number(last.payable) || null : null, at: last?.datetime ?? null, ref: last?.id != null ? String(last.id) : null };
    },
    async cancel(ctx, tn) {
      await call(ctx, "/shipment/cancel", new URLSearchParams({ tracking_number: tn }));
    },
    async label(ctx, tn) {
      const res = await fetch(`${base(ctx)}/shipment/air_waybill?tracking_number=${encodeURIComponent(tn)}&type=1`, { headers: { authorization: ctx.connection.secrets.apiKey ?? "" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok || (res.headers.get("content-type") ?? "").includes("json")) throw new IntegrationError("Trax didn’t return the airway bill – try again, or print it from your Trax portal.");
      return { pdf: Buffer.from(await res.arrayBuffer()) };
    },
  },
};

export default impl;
