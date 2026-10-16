import { http } from "../http";
import { box, international, lineWeights, sender } from "./intl-shipping";
import { IntegrationError, type Ctx, type ParcelInput, type ProviderImpl, type TrackingStatus } from "../types";

/**
 * DHL Express (MyDHL API 3.3.4) with the store's own DHL Express account: books the shipment, keeps the PDF label (DHL
 * returns it only once – stored privately, printed from the order), and tracking by polling (DHL has no webhooks).
 */

const VERSION = "3.3.4";
const base = (ctx: Ctx) => (ctx.connection.mode === "test" ? "https://express.api.dhl.com/mydhlapi/test" : "https://express.api.dhl.com/mydhlapi");
const headers = (ctx: Ctx) => ({ authorization: `Basic ${Buffer.from(`${String(ctx.connection.config.username ?? "")}:${ctx.connection.secrets.password ?? ""}`).toString("base64")}`, "x-version": VERSION });

const STATUS: Record<string, TrackingStatus> = {
  OK: "delivered", PD: "delivered", DD: "delivered",
  WC: "out_for_delivery",
  RT: "returned",
  PU: "in_transit", PL: "in_transit", DF: "in_transit", AF: "in_transit", AR: "in_transit", CR: "in_transit", RR: "in_transit", IC: "in_transit", TR: "in_transit",
  BA: "failed", NH: "failed", CA: "failed", MD: "failed", ND: "failed", RD: "failed", OH: "failed",
};

/** Tomorrow 10:00 in the sender's time zone, as DHL wants it ("2026-10-17T10:00:00 GMT+05:00"). */
async function plannedTime(ctx: Ctx) {
  const store = (await ctx.payload.findByID({ collection: "stores", id: ctx.connection.store, depth: 0, overrideAccess: true }).catch(() => null)) as { timezone?: string } | null;
  const tz = store?.timezone || "UTC";
  const day = new Date(Date.now() + 24 * 3600_000).toLocaleDateString("en-CA", { timeZone: tz });
  const offset = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  return `${day}T10:00:00 ${offset === "GMT" ? "GMT+00:00" : offset}`;
}

const contact = (name: string, phone: string, email?: string | null, company?: string) => ({ fullName: name.slice(0, 255), companyName: (company || name).slice(0, 100), phone: phone.slice(0, 70), ...(email ? { email } : {}) });

async function body(ctx: Ctx, p: ParcelInput) {
  const from = sender(ctx);
  const b = box(ctx);
  const intl = international(ctx, p);
  const weights = lineWeights(p);
  const value = Math.round(p.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) * 100) / 100;
  const hs = String(ctx.connection.config.hsCode ?? "").replace(/\D/g, "");
  if (intl && !hs) throw new IntegrationError("DHL needs a customs (HS) code for parcels to other countries – add the usual one in the DHL Express settings.");
  return {
    plannedShippingDateAndTime: await plannedTime(ctx),
    pickup: { isRequested: false },
    productCode: String(ctx.connection.config[intl ? "productCode" : "domesticProductCode"] || (intl ? "P" : "N")),
    accounts: [{ typeCode: "shipper", number: String(ctx.connection.config.accountNumber ?? "") }],
    outputImageProperties: { encodingFormat: "pdf", imageOptions: [{ typeCode: "label", templateName: "ECOM26_84_001", isRequested: true }] },
    customerReferences: [{ value: p.orderNumber.slice(0, 35), typeCode: "CU" }],
    customerDetails: {
      shipperDetails: { postalAddress: { postalCode: from.zip, cityName: from.city.slice(0, 45), countryCode: from.country, addressLine1: from.street1.slice(0, 45) }, contactInformation: contact(from.name, from.phone, from.email, from.company) },
      receiverDetails: { postalAddress: { postalCode: p.customer.postalCode ?? "", cityName: p.customer.city.slice(0, 45), countryCode: p.customer.country, addressLine1: p.customer.address.slice(0, 45), ...(p.customer.area ? { addressLine2: p.customer.area.slice(0, 45) } : {}) }, contactInformation: contact(p.customer.name, p.customer.phone, p.customer.email) },
    },
    content: {
      packages: [{ weight: p.weightKg, dimensions: { length: b.l, width: b.w, height: b.h } }],
      isCustomsDeclarable: intl,
      declaredValue: value,
      declaredValueCurrency: p.currency,
      description: p.description.slice(0, 70),
      incoterm: "DAP",
      unitOfMeasurement: "metric",
      ...(intl
        ? {
            exportDeclaration: {
              lineItems: p.items.map((i, k) => ({ number: k + 1, description: i.title.slice(0, 512), price: i.unitPrice, quantity: { value: i.qty, unitOfMeasurement: "PCS" }, commodityCodes: [{ typeCode: "outbound", value: hs }], manufacturerCountry: from.country, weight: { netValue: weights[k], grossValue: weights[k] } })),
              invoice: { number: p.orderNumber.slice(0, 35), date: new Date().toISOString().slice(0, 10) },
            },
          }
        : {}),
    },
  };
}

const impl: ProviderImpl = {
  async test(ctx) {
    const from = sender(ctx);
    const r = await http<{ detail?: string; title?: string; address?: unknown[] }>(`${base(ctx)}/address-validate?type=pickup&countryCode=${encodeURIComponent(from.country)}&postalCode=${encodeURIComponent(from.zip)}&cityName=${encodeURIComponent(from.city)}`, { provider: "DHL Express", headers: headers(ctx) });
    if (r.status === 401 || r.status === 403) return { ok: false, message: "DHL Express: the API username or password isn’t right." };
    if (!r.ok) return { ok: false, message: `DHL Express: ${r.data.detail ?? r.data.title ?? `check failed (${r.status})`}` };
    return { ok: true, message: `Connected to DHL Express${ctx.connection.mode === "test" ? " (test – 500 calls a day; test parcels can’t be tracked)" : ""}.`, state: { account: String(ctx.connection.config.accountNumber ?? "") } };
  },
  courier: {
    name: "DHL Express",
    async book(ctx, p) {
      const r = await http<{ shipmentTrackingNumber?: string; documents?: { typeCode?: string; imageFormat?: string; content?: string }[]; detail?: string; additionalDetails?: string[] }>(`${base(ctx)}/shipments`, { provider: "DHL Express", method: "POST", headers: headers(ctx), body: await body(ctx, p), timeoutMs: 45_000 });
      if (!r.ok || !r.data.shipmentTrackingNumber) throw new IntegrationError(`DHL Express: ${[r.data.detail, ...(r.data.additionalDetails ?? [])].filter(Boolean).join("; ") || `booking failed (${r.status})`}`);
      const tn = r.data.shipmentTrackingNumber;
      // the label comes only now: keep it (private storage) so it can be printed later
      const label = r.data.documents?.find((d) => d.typeCode === "label" && /pdf/i.test(d.imageFormat ?? "pdf"));
      let labelUrl: string | null = null;
      if (label?.content) {
        const { uploadObject } = await import("@/lib/storage");
        labelUrl = await uploadObject(`labels/${ctx.connection.store}/${p.orderNumber.replace(/[^A-Za-z0-9-]/g, "")}-${tn}.pdf`, Buffer.from(label.content, "base64"), "application/pdf").catch(() => null);
      }
      return { trackingNumber: tn, labelUrl, courierName: "DHL Express" };
    },
    async track(ctx, tn) {
      const r = await http<{ shipments?: { events?: { typeCode?: string; description?: string; date?: string; time?: string }[] }[] }>(`${base(ctx)}/shipments/${encodeURIComponent(tn)}/tracking?trackingView=all-checkpoints&levelOfDetail=shipment`, { provider: "DHL Express", headers: headers(ctx) });
      const events = r.data.shipments?.[0]?.events ?? [];
      const last = [...events].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0];
      return { status: (last?.typeCode && STATUS[last.typeCode]) || (events.length ? "in_transit" : "booked"), detail: last?.description ?? "" };
    },
  },
};

export default impl;
