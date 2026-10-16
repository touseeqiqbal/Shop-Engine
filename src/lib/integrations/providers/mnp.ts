import { http } from "../http";
import { cachedCities, matchCity, pkMobile } from "../couriers";
import { statusFromText } from "./courier-status";
import { IntegrationError, type Ctx, type ProviderImpl } from "../types";

/**
 * M&P Express (Muller & Phipps, Pakistan) COD API – credentials in the body, city names from its list, public tracking
 * with the COD payment fields. No label endpoint we can rely on: print from the M&P portal.
 */

const API = "https://mnpcourier.com/mycodapi/api";
const TRACKING = "https://tracking.mulphilog.com.pk/api/CNTracking";
const truthy = (v: unknown) => v === true || String(v).toLowerCase() === "true";

const auth = (ctx: Ctx) => ({ username: String(ctx.connection.config.username ?? ""), password: ctx.connection.secrets.password ?? "", AccountNo: String(ctx.connection.config.accountNo ?? "") });

type City = { name: string };
const cities = (ctx: Ctx) =>
  cachedCities<City>(ctx, "cities", async () => {
    const a = auth(ctx);
    const r = await http<{ City?: string[] }[]>(`${API}/Branches/Get_Cities_All?username=${encodeURIComponent(a.username)}&password=${encodeURIComponent(a.password)}&AccountNo=${encodeURIComponent(a.AccountNo)}`, { provider: "M&P" });
    const list = Array.isArray(r.data) ? (r.data[0]?.City ?? []) : [];
    if (!list.length) throw new IntegrationError("M&P: the username, password or account number isn’t right.");
    return list.map((name) => ({ name }));
  });

const impl: ProviderImpl = {
  async test(ctx) {
    const list = await cities(ctx);
    return { ok: true, message: `Connected to M&P – ${list.length} cities.`, state: { account: String(ctx.connection.config.accountNo ?? "M&P") } };
  },
  courier: {
    name: "M&P",
    async bookingOptions(ctx) {
      return [
        { key: "city", label: "M&P city", options: (await cities(ctx)).map((c) => ({ label: c.name.trim(), value: c.name })) },
        { key: "service", label: "Service", options: [{ label: "Overnight", value: "Overnight" }, { label: "Second Day", value: "Second Day" }], default: String(ctx.connection.config.service || "Overnight") },
      ];
    },
    async book(ctx, p) {
      const c = ctx.connection.config;
      const city = p.options?.city || matchCity(await cities(ctx), p.customer.city)?.name;
      if (!city) throw new IntegrationError(`M&P doesn’t list “${p.customer.city}” – choose the M&P city.`);
      const r = await http<{ isSuccess?: string | boolean; message?: string; orderReferenceId?: string }[]>(`${API}/Booking/InsertBookingData`, {
        provider: "M&P",
        method: "POST",
        body: {
          ...auth(ctx),
          consigneeName: p.customer.name.slice(0, 50),
          consigneeAddress: [p.customer.address, p.customer.area].filter(Boolean).join(", ").slice(0, 255),
          consigneeMobNo: pkMobile(p.customer.phone),
          consigneeEmail: (p.customer.email ?? "").slice(0, 50),
          destinationCityName: city,
          pieces: Math.min(99, p.pieces),
          weight: p.weightKg,
          codAmount: Math.round(p.codAmount),
          custRefNo: p.orderNumber.slice(0, 50),
          productDetails: p.description.slice(0, 50),
          fragile: "No",
          service: p.options?.service || String(c.service || "Overnight"),
          remarks: (p.note ?? "").slice(0, 400),
          insuranceValue: "0",
          locationID: String(c.locationId ?? ""),
          InsertType: Number(c.insertType || 19),
          ReturnLocation: Number(c.returnLocation || c.locationId || 0),
          subAccountId: Number(c.subAccountId || 0),
        },
      });
      const row = Array.isArray(r.data) ? r.data[0] : undefined;
      if (!row || !truthy(row.isSuccess) || !row.orderReferenceId) throw new IntegrationError(`M&P: ${row?.message ?? `booking failed (${r.status})`}`);
      return { trackingNumber: String(row.orderReferenceId), courierName: "M&P" };
    },
    async track(_ctx, tn) {
      const r = await http<{ isSuccess?: string; tracking_Details?: { CNTrackingDetail?: { TransactionTime?: string; TrackingStatus?: string; TrackingNarration?: string }[]; PaymentID?: string | null; PaymentDate?: string | null; AmountPaid?: number | string | null; InstrumentNumber?: string | null }[] | null }[]>(`${TRACKING}?consignment=${encodeURIComponent(tn)}&id=4`, { provider: "M&P" });
      const d = Array.isArray(r.data) ? r.data[0]?.tracking_Details?.[0] : undefined;
      if (!d) return { status: "unknown", detail: "" };
      const events = [...(d.CNTrackingDetail ?? [])].sort((a, b) => Date.parse(b.TransactionTime ?? "") - Date.parse(a.TransactionTime ?? ""));
      const text = events[0]?.TrackingStatus ?? "";
      const paid = d.PaymentID && String(d.PaymentID).trim() && String(d.PaymentID).trim() !== "0";
      return { status: statusFromText(text), detail: events[0]?.TrackingNarration ? `${text} (${events[0].TrackingNarration})` : text, codRemitted: paid ? { amount: Number(d.AmountPaid) || null, at: d.PaymentDate ?? null, ref: d.InstrumentNumber || String(d.PaymentID) } : null };
    },
    async cancel(ctx, tn) {
      const a = auth(ctx);
      const r = await http<{ isSuccess?: string | boolean; message?: string; orderReferenceIdList?: { success?: boolean; message?: string }[] }[]>(`${API}/Booking/VoidConsignment`, { provider: "M&P", method: "POST", body: { Username: a.username, password: a.password, locationID: String(ctx.connection.config.locationId ?? ""), consignmentNumberList: [tn] } });
      const row = Array.isArray(r.data) ? r.data[0] : undefined;
      const item = row?.orderReferenceIdList?.[0];
      if (!row || !truthy(row.isSuccess) || item?.success === false) throw new IntegrationError(`M&P: ${item?.message ?? row?.message ?? "couldn’t cancel"}`);
    },
  },
};

export default impl;
