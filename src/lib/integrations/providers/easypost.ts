import { http } from "../http";
import { box, international, lineWeights, receiver, sender } from "./intl-shipping";
import { IntegrationError, type Ctx, type ProviderImpl, type TrackingStatus } from "../types";

/**
 * EasyPost: rates from the store's carrier accounts, the cheapest (or the preferred carrier) is bought; PDF label.
 * Units: inches and ounces. Tracking is read from the shipment's tracker.
 */

const API = "https://api.easypost.com/v2";
const auth = (ctx: Ctx) => ({ authorization: `Basic ${Buffer.from(`${ctx.connection.secrets.apiKey ?? ""}:`).toString("base64")}` });
const inches = (cm: number) => Math.round((cm / 2.54) * 10) / 10;
const ounces = (kg: number) => Math.round(kg * 35.274 * 10) / 10;

type Rate = { id: string; carrier: string; service: string; rate: string };
type ShipmentResp = { id?: string; rates?: Rate[]; messages?: { message?: string }[]; error?: { message?: string } };

const STATUS: Record<string, TrackingStatus> = { pre_transit: "booked", in_transit: "in_transit", out_for_delivery: "out_for_delivery", delivered: "delivered", available_for_pickup: "out_for_delivery", return_to_sender: "returned", failure: "failed", cancelled: "cancelled", error: "failed", unknown: "unknown" };

const impl: ProviderImpl = {
  async test(ctx) {
    const r = await http<{ error?: { message?: string } }>(`${API}/shipments?page_size=1`, { provider: "EasyPost", headers: auth(ctx) });
    if (!r.ok) return { ok: false, message: `EasyPost: ${r.data.error?.message ?? "the API key isn’t right"}` };
    return { ok: true, message: "Connected to EasyPost." };
  },
  courier: {
    name: "EasyPost",
    async book(ctx, p) {
      const from = sender(ctx);
      const b = box(ctx);
      const weights = lineWeights(p);
      const to = receiver(p);
      const s = await http<ShipmentResp>(`${API}/shipments`, {
        provider: "EasyPost",
        method: "POST",
        headers: auth(ctx),
        body: {
          shipment: {
            to_address: to,
            from_address: { ...from, company: from.company || undefined },
            parcel: { length: inches(b.l), width: inches(b.w), height: inches(b.h), weight: ounces(p.weightKg) },
            ...(international(ctx, p)
              ? {
                  customs_info: {
                    customs_certify: true,
                    customs_signer: String(ctx.connection.config.customsSigner || from.name),
                    contents_type: "merchandise",
                    restriction_type: "none",
                    eel_pfc: "NOEEI 30.37(a)",
                    non_delivery_option: "return",
                    customs_items: p.items.map((i, k) => ({ description: i.title.slice(0, 100), quantity: i.qty, value: Math.round(i.unitPrice * i.qty * 100) / 100, weight: ounces(weights[k]), origin_country: from.country, currency: p.currency, ...(i.sku ? { code: i.sku } : {}) })),
                  },
                }
              : {}),
            options: { label_format: "PDF" },
            reference: p.orderNumber,
          },
        },
      });
      if (!s.ok || !s.data.id || !s.data.rates?.length) throw new IntegrationError(`EasyPost: no rates – ${s.data.error?.message ?? s.data.messages?.map((m) => m.message).join("; ") ?? "check the addresses"}`);
      const preferred = String(ctx.connection.config.carrier ?? "").trim().toLowerCase();
      const rates = preferred ? s.data.rates.filter((r) => r.carrier.toLowerCase() === preferred) : s.data.rates;
      const rate = [...(rates.length ? rates : s.data.rates)].sort((a, b) => Number(a.rate) - Number(b.rate))[0];
      const bought = await http<{ tracking_code?: string; postage_label?: { label_url?: string; label_pdf_url?: string }; selected_rate?: Rate; error?: { message?: string } }>(`${API}/shipments/${encodeURIComponent(s.data.id)}/buy`, { provider: "EasyPost", method: "POST", headers: auth(ctx), body: { rate: { id: rate.id } } });
      if (!bought.ok || !bought.data.tracking_code) throw new IntegrationError(`EasyPost: the label wasn’t bought – ${bought.data.error?.message ?? bought.status}`);
      return { trackingNumber: bought.data.tracking_code, labelUrl: bought.data.postage_label?.label_pdf_url ?? bought.data.postage_label?.label_url ?? null, courierRef: s.data.id, courierName: `${rate.carrier} ${rate.service}`.slice(0, 60) };
    },
    async track(ctx, ref) {
      const r = await http<{ tracker?: { status?: string; status_detail?: string } }>(`${API}/shipments/${encodeURIComponent(ref)}`, { provider: "EasyPost", headers: auth(ctx) });
      const st = r.data.tracker?.status ?? "unknown";
      return { status: STATUS[st] ?? "unknown", detail: r.data.tracker?.status_detail?.replace(/_/g, " ") ?? "" };
    },
    async cancel(ctx, ref) {
      const r = await http<{ refund_status?: string; error?: { message?: string } }>(`${API}/shipments/${encodeURIComponent(ref)}/refund`, { provider: "EasyPost", method: "POST", headers: auth(ctx) });
      if (!r.ok) throw new IntegrationError(`EasyPost: ${r.data.error?.message ?? "couldn’t refund the label"}`);
    },
  },
};

export default impl;
