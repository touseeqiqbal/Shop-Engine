import { http } from "../http";
import { cachedCities, matchCity, pkMobile } from "../couriers";
import { statusFromText } from "./courier-status";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";

/**
 * Call Courier (Pakistan, now part of PostEx) – the legacy COD API: booking and tracking only. Cancelling, labels and
 * COD payouts are done in the Call Courier portal (no API for them).
 */

const API = "https://cod.callcourier.com.pk/api/CallCourier";

type City = { id: number; name: string };
const cities = (ctx: Ctx) =>
  cachedCities<City>(ctx, "cities", async () => {
    const r = await http<{ CityID: number; CityName: string }[]>(`${API}/GetCityListByService?serviceID=${encodeURIComponent(String(ctx.connection.config.serviceTypeId || 7))}`, { provider: "Call Courier" });
    return Array.isArray(r.data) ? r.data.map((c) => ({ id: Number(c.CityID), name: String(c.CityName) })) : [];
  });

/** The consignment number in whatever shape the booking answer has. */
function cnFrom(data: unknown, text: string): string | null {
  if (data && typeof data === "object") {
    const d = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    for (const k of ["CNNO", "CNNo", "CN", "ConsignmentNo", "consignmentNo", "Cn", "cn"]) if (d?.[k]) return String(d[k]);
    for (const k of ["Response", "response", "message", "Message"]) {
      const m = typeof d?.[k] === "string" ? (d[k] as string).match(/\d{3,6}-\d{2}-\d{6,12}|\d{12,17}/) : null;
      if (m) return m[0];
    }
  }
  return text.match(/\d{3,6}-\d{2}-\d{6,12}|\d{12,17}/)?.[0] ?? null;
}

const impl: ProviderImpl = {
  async test(ctx) {
    const types = await http<{ ServiceTypeID: number; ServiceType1: string }[]>(`${API}/GetServiceType/${encodeURIComponent(String(ctx.connection.config.accountId ?? ""))}`, { provider: "Call Courier" });
    if (!Array.isArray(types.data) || !types.data.length) return { ok: false, message: "Call Courier: the account id isn’t right." };
    const list = await cities(ctx);
    return { ok: true, message: `Connected to Call Courier – ${list.length} cities. Cancel parcels and check COD payouts in your Call Courier portal.`, state: { account: String(ctx.connection.config.accountId) } };
  },
  courier: {
    name: "Call Courier",
    async bookingOptions(ctx) {
      return [{ key: "city", label: "Call Courier city", options: (await cities(ctx)).map((c) => ({ label: c.name, value: String(c.id) })) }];
    },
    async book(ctx, p) {
      const c = ctx.connection.config;
      const city = p.options?.city ? Number(p.options.city) : matchCity(await cities(ctx), p.customer.city)?.id;
      if (!city) throw new IntegrationError(`Call Courier doesn’t list “${p.customer.city}” – choose the Call Courier city.`);
      const q = new URLSearchParams({
        loginId: ctx.connection.secrets.loginId ?? "",
        ConsigneeName: p.customer.name,
        ConsigneeRefNo: p.orderNumber,
        ConsigneeCellNo: pkMobile(p.customer.phone),
        Address: [p.customer.address, p.customer.area].filter(Boolean).join(", "),
        Origin: String(c.origin ?? ""),
        DestCityId: String(city),
        ServiceTypeId: String(c.serviceTypeId || 7),
        Pcs: String(p.pieces).padStart(2, "0"),
        Weight: String(Math.max(1, Math.round(p.weightKg))).padStart(2, "0"),
        Description: p.description.slice(0, 100),
        SelOrigin: "Domestic",
        CodAmount: String(Math.max(1, Math.round(p.codAmount))),
        SpecialHandling: "false",
        MyBoxId: "1",
        Holiday: "false",
        remarks: (p.note ?? "").slice(0, 200),
        ShipperName: String(c.shipperName ?? ""),
        ShipperCellNo: pkMobile(String(c.shipperCell ?? "")),
        ShipperArea: String(c.shipperAreaId ?? ""),
        ShipperCity: String(c.shipperCityId ?? ""),
        ShipperAddress: String(c.shipperAddress ?? ""),
        ShipperLandLineNo: String(c.shipperLandline || c.shipperCell || ""),
        ShipperEmail: String(c.shipperEmail ?? ""),
      });
      const r = await http(`${API}/SaveBooking?${q}`, { provider: "Call Courier" });
      const cn = cnFrom(r.data, r.text);
      if (!r.ok || !cn) throw new IntegrationError(`Call Courier didn’t return a consignment number: ${r.text.slice(0, 200)}`);
      return { trackingNumber: cn, courierName: "Call Courier" };
    },
    async track(_ctx, tn) {
      const r = await http<{ TransactionDate?: string; ProcessDescForPortal?: string; OperationDesc?: string; ReasonDesc?: string }[]>(`${API}/GetTackingHistory?cn=${encodeURIComponent(tn)}`, { provider: "Call Courier" });
      const events = Array.isArray(r.data) ? [...r.data].sort((a, b) => Date.parse(b.TransactionDate ?? "") - Date.parse(a.TransactionDate ?? "")) : [];
      const text = events[0]?.ProcessDescForPortal ?? events[0]?.OperationDesc ?? "";
      return { status: statusFromText(text), detail: events[0]?.ReasonDesc ? `${text} (${events[0].ReasonDesc})` : text };
    },
  },
};

export default impl;
