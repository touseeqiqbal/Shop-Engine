import { http, decimal } from "../http";
import { box, international, lineWeights, receiver, sender } from "./intl-shipping";
import { IntegrationError, type Ctx, type ProviderImpl, type TrackingStatus } from "../types";

/**
 * Shippo: rates from the carriers on the store's Shippo account, the cheapest (or the preferred service) is bought, and
 * Shippo returns the tracking number and a label link. Tracking is asked from the label's transaction.
 */

const API = "https://api.goshippo.com";
const headers = (ctx: Ctx) => ({ authorization: `ShippoToken ${ctx.connection.secrets.apiToken ?? ""}`, "shippo-api-version": "2018-02-08" });

type Rate = { object_id: string; amount: string; currency: string; provider: string; servicelevel?: { name?: string; token?: string }; attributes?: string[] };

const STATUS: Record<string, TrackingStatus> = { PRE_TRANSIT: "booked", TRANSIT: "in_transit", DELIVERED: "delivered", RETURNED: "returned", FAILURE: "failed", UNKNOWN: "unknown" };

const impl: ProviderImpl = {
  async test(ctx) {
    const r = await http<{ results?: unknown[]; detail?: string }>(`${API}/carrier_accounts/?results=25`, { provider: "Shippo", headers: headers(ctx) });
    if (!r.ok) return { ok: false, message: `Shippo: ${r.data.detail ?? "the API token isn’t right"}` };
    const test = (ctx.connection.secrets.apiToken ?? "").startsWith("shippo_test_");
    return { ok: true, message: `Connected to Shippo${test ? " (test token – labels aren’t real)" : ""} – ${r.data.results?.length ?? 0} carrier account(s).`, state: { account: test ? "test token" : "live" } };
  },
  courier: {
    name: "Shippo",
    async book(ctx, p) {
      const from = sender(ctx);
      const b = box(ctx);
      const intl = international(ctx, p);
      const weights = lineWeights(p);
      const shipment = await http<{ object_id?: string; status?: string; rates?: Rate[]; messages?: { text?: string }[] }>(`${API}/shipments/`, {
        provider: "Shippo",
        method: "POST",
        headers: headers(ctx),
        body: {
          address_from: from,
          address_to: receiver(p),
          parcels: [{ length: String(b.l), width: String(b.w), height: String(b.h), distance_unit: "cm", weight: String(p.weightKg), mass_unit: "kg" }],
          ...(intl
            ? {
                customs_declaration: {
                  contents_type: "MERCHANDISE",
                  non_delivery_option: "RETURN",
                  certify: true,
                  certify_signer: String(ctx.connection.config.customsSigner || from.name),
                  incoterm: "DDU",
                  items: p.items.map((i, k) => ({ description: i.title.slice(0, 100), quantity: i.qty, net_weight: String(weights[k]), mass_unit: "kg", value_amount: decimal(i.unitPrice * i.qty), value_currency: p.currency, origin_country: from.country })),
                },
              }
            : {}),
          metadata: `Order ${p.orderNumber}`,
          async: false,
        },
      });
      const rates = shipment.data.rates ?? [];
      if (!shipment.ok || !rates.length) throw new IntegrationError(`Shippo: no rates – ${shipment.data.messages?.map((m) => m.text).filter(Boolean).join("; ") || "check the addresses and your carrier accounts"}`);
      const preferred = String(ctx.connection.config.serviceToken ?? "").trim();
      const rate = (preferred && rates.find((r) => r.servicelevel?.token === preferred)) || rates.find((r) => r.attributes?.includes("CHEAPEST")) || [...rates].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
      const t = await http<{ object_id?: string; status?: string; tracking_number?: string; label_url?: string; messages?: { text?: string }[] }>(`${API}/transactions`, { provider: "Shippo", method: "POST", headers: headers(ctx), body: { rate: rate.object_id, label_file_type: "PDF_4x6", async: false, metadata: `Order ${p.orderNumber}` } });
      if (t.data.status !== "SUCCESS" || !t.data.tracking_number) throw new IntegrationError(`Shippo: the label wasn’t bought – ${t.data.messages?.map((m) => m.text).filter(Boolean).join("; ") || t.data.status || t.status}`);
      return { trackingNumber: t.data.tracking_number, labelUrl: t.data.label_url ?? null, courierRef: t.data.object_id ?? null, courierName: `${rate.provider}${rate.servicelevel?.name ? ` ${rate.servicelevel.name}` : ""}`.slice(0, 60) };
    },
    async track(ctx, ref) {
      const r = await http<{ tracking_status?: string | { status?: string; status_details?: string } }>(`${API}/transactions/${encodeURIComponent(ref)}`, { provider: "Shippo", headers: headers(ctx) });
      const ts = r.data.tracking_status;
      const code = typeof ts === "string" ? ts : (ts?.status ?? "UNKNOWN");
      return { status: STATUS[code] ?? "unknown", detail: typeof ts === "object" ? (ts?.status_details ?? "") : "" };
    },
    async cancel(ctx, ref) {
      // an unused label is refunded by Shippo
      const r = await http<{ status?: string; detail?: string }>(`${API}/refunds/`, { provider: "Shippo", method: "POST", headers: headers(ctx), body: { transaction: ref, async: false } });
      if (!r.ok) throw new IntegrationError(`Shippo: ${r.data.detail ?? "couldn’t refund the label"}`);
    },
  },
};

export default impl;
