import "server-only";
import type { PaymentSettings, ShippingZone, StoreSettings } from "@/lib/types";
import { payloadClient } from "./catalog-source";

/**
 * A store's shipping & payment settings from /cms (Settings → Shipping / Payments), as a partial StoreSettings.
 * Settings never saved return nothing, so the built-in defaults stay in effect until then.
 */

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc => (v && typeof v === "object" ? (v as Doc) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function loadCommerceSettings(storeId: number | null): Promise<Partial<StoreSettings>> {
  const payload = await payloadClient();
  const { getStoreSettings } = await import("@/payload/store-settings");
  const [ship, pay] = await Promise.all([getStoreSettings<Doc>(payload, "shipping", storeId), getStoreSettings<Doc>(payload, "payments", storeId)]);
  // cards: only when the store's payment account (Stripe) is connected and can take charges, and the platform has a key
  const store = storeId == null ? null : ((await payload.findByID({ collection: "stores", id: storeId, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null);
  const out: Partial<StoreSettings> = {};

  if (ship.updatedAt) {
    out.freeDeliveryThreshold = num(ship.freeDeliveryThreshold);
    out.defaultDeliveryCharge = num(ship.defaultCharge);
    out.zones = (Array.isArray(ship.zones) ? (ship.zones as Doc[]) : []).map(
      (z): ShippingZone => ({
        name: str(z.name),
        cities: Array.isArray(z.cities) ? (z.cities as string[]) : [],
        rest: Boolean(z.rest),
        charge: num(z.charge),
        freeAbove: numOrNull(z.freeAbove),
        estimate: str(z.estimate),
      })
    );
  }

  if (pay.updatedAt) {
    const cod = obj(pay.cod), jc = obj(pay.jazzcash), ep = obj(pay.easypaisa), bank = obj(pay.bank);
    const payments: PaymentSettings = {
      cod: { enabled: cod.enabled !== false, note: str(cod.note), fee: num(cod.fee), maxOrder: numOrNull(cod.maxOrder) },
      jazzcash: { enabled: jc.enabled !== false, note: str(jc.note) },
      easypaisa: { enabled: ep.enabled !== false, note: str(ep.note) },
      bank: { enabled: bank.enabled !== false, note: str(bank.note) },
      card: { enabled: obj(pay.card).enabled === true, note: str(obj(pay.card).note) },
    };
    const tax = obj(pay.tax);
    out.tax = { enabled: tax.enabled === true && num(tax.rate) > 0, rate: Math.min(50, Math.max(0, num(tax.rate))), inclusive: tax.inclusive !== false, label: str(tax.label) || "Sales tax", taxDelivery: tax.taxDelivery === true };
    out.payments = payments;
    out.advanceThreshold = num(cod.advanceThreshold);
    out.advanceAmount = num(cod.advanceAmount);
    out.jazzcash = { title: str(jc.title), number: str(jc.number) };
    out.easypaisa = { title: str(ep.title), number: str(ep.number) };
    out.bank = { bankName: str(bank.bankName), accountTitle: str(bank.accountTitle), accountNumber: str(bank.accountNumber), iban: str(bank.iban) };
  }
  out.cardReady = Boolean(process.env.STRIPE_SECRET_KEY && store?.paymentsAccountId && store?.paymentsChargesEnabled);
  if (store?.currency) out.currency = str(store.currency).toUpperCase();
  return out;
}
