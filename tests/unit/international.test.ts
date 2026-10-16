import { describe, expect, it } from "vitest";
import { countryDefaults, DEFAULT_LOCALE, storeLocale, toCountryCode } from "@/lib/locale";
import { currencyDigits, currencySymbol, formatMoney, moneyFormatter, roundMoney } from "@/lib/money";
import { addDays, compactDay, dayIn, dayStart, zoneOffsetMinutes } from "@/lib/time";
import { intlDigits, normalizePhone, phoneKey } from "@/lib/phone";
import { checkoutMethods, findCheckoutMethod, manualMethodId, paymentLabel } from "@/lib/payments/methods";
import { gatewayInfo, gatewaySupports, gatewaysFor } from "@/lib/payments/catalog";
import { paidOnDelivery, paymentBlocksShipping } from "@/lib/order-money";
import { deliveryCharge, deliveryEstimate, freeDeliveryAbove, shippingZoneFor, shipsTo, shipToCountries } from "@/lib/cities";
import { cityLine } from "@/lib/order-display";
import { orderTotals } from "@/lib/order-totals";
import type { StoreSettings } from "@/lib/types";

const base: StoreSettings = {
  freeDeliveryThreshold: 0,
  defaultDeliveryCharge: 350,
  cityCharges: {},
  advanceThreshold: 100000,
  advanceAmount: 5000,
  bank: { bankName: "Meezan", accountTitle: "Urko", accountNumber: "0102-0105678901", iban: "PK36MEZN0001020105678901" },
  jazzcash: { title: "Urko", number: "0342-6693115" },
  easypaisa: { title: "Urko", number: "0343-5867409" },
};
const settings = (over: Partial<StoreSettings>) => ({ ...base, ...over }) as StoreSettings;
const ids = (s: StoreSettings) => checkoutMethods(s).map((m) => m.id);

describe("store locale", () => {
  it("country codes from codes or names; unknown → null", () => {
    expect(toCountryCode("Pakistan")).toBe("PK");
    expect(toCountryCode("pk")).toBe("PK");
    expect(toCountryCode("United States")).toBe("US");
    expect(toCountryCode("Atlantis")).toBeNull();
  });
  it("a country brings its currency, time zone and dialling code", () => {
    expect(countryDefaults("AE")).toEqual({ currency: "AED", timezone: "Asia/Dubai", dial: "971" });
    expect(countryDefaults("GB").currency).toBe("GBP");
  });
  it("the original shop stays Pakistan / PKR / Karachi; invalid values fall back to the country's", () => {
    expect(storeLocale({ country: "Pakistan", currency: "PKR", timezone: "Asia/Karachi" })).toEqual(DEFAULT_LOCALE);
    expect(storeLocale(null)).toEqual(DEFAULT_LOCALE);
    const us = storeLocale({ country: "US", currency: "nope", timezone: "Mars/Base" });
    expect(us).toMatchObject({ country: "US", currency: "USD", timezone: "America/New_York", dial: "1", locale: "en-US" });
    expect(storeLocale({ country: "DE", currency: "EUR", timezone: "Europe/Berlin", language: "de" }).locale).toBe("de-DE");
  });
});

describe("money in any currency", () => {
  it("the original shop's rupees look exactly as before", () => {
    expect(formatMoney(145000)).toBe("Rs 145,000");
    expect(formatMoney(1234.6, { currency: "PKR", locale: "en-PK" })).toBe("Rs 1,235");
    expect(currencySymbol()).toBe("Rs");
  });
  it("cents, no-cent and three-decimal currencies", () => {
    expect(formatMoney(1234.5, { currency: "USD", locale: "en-US" })).toBe("$1,234.50");
    expect(currencyDigits("USD")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("KWD")).toBe(3);
    expect(roundMoney(19.999, "USD")).toBe(20);
    expect(roundMoney(19.994, "USD")).toBe(19.99);
    expect(roundMoney(1234.5, "PKR")).toBe(1235);
    expect(roundMoney(1.23456, "KWD")).toBe(1.235);
    expect(roundMoney(999.6, "JPY")).toBe(1000);
  });
  it("a formatter bound to a store", () => {
    const money = moneyFormatter({ currency: "EUR", locale: "de-DE" });
    expect(money(1234.5)).toMatch(/1\.234,50\s?€/);
    expect(money.round(0.1 + 0.2)).toBe(0.3);
    expect(money.symbol).toBe("€");
  });
});

describe("dates in the store's time zone", () => {
  const at = Date.parse("2026-10-14T20:00:00Z");
  it("the day depends on the store's clock", () => {
    expect(dayIn(at, "Asia/Karachi")).toBe("2026-10-15");
    expect(dayIn(at, "America/New_York")).toBe("2026-10-14");
    expect(compactDay("Asia/Karachi", at)).toBe("261015");
    expect(zoneOffsetMinutes("Asia/Karachi", at)).toBe(300);
  });
  it("Pakistan time matches the old fixed +5 hours", () => {
    for (const t of [Date.parse("2026-01-01T18:59:59Z"), Date.parse("2026-01-01T19:00:00Z"), Date.parse("2026-06-30T23:30:00Z")])
      expect(dayIn(t, "Asia/Karachi")).toBe(new Date(t + 5 * 3600e3).toISOString().slice(0, 10));
    expect(dayStart("2026-10-15", "Asia/Karachi")).toBe(Date.parse("2026-10-15T00:00:00Z") - 5 * 3600e3);
  });
  it("a day starts at local midnight, also across daylight saving changes", () => {
    expect(new Date(dayStart("2026-03-08", "America/New_York")).toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(new Date(dayStart("2026-03-09", "America/New_York")).toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(new Date(dayStart("2026-11-01", "America/New_York")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(dayStart("2026-07-01", "Europe/London")).toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("phone numbers from any country", () => {
  it("Pakistan keeps 0300-1234567", () => {
    expect(normalizePhone("03001234567", "PK")).toBe("0300-1234567");
    expect(normalizePhone("+92 300 1234567", "PK")).toBe("0300-1234567");
    expect(normalizePhone("0092 300 1234567", "PK")).toBe("0300-1234567");
    expect(normalizePhone("12345", "PK")).toBeNull();
  });
  it("a foreign number in full is fine anywhere; local numbers get the store's code", () => {
    expect(normalizePhone("+44 7700 900123", "PK")).toBe("+447700900123");
    expect(normalizePhone("07700 900123", "GB")).toBe("+447700900123");
    expect(normalizePhone("(212) 555-0123", "US")).toBe("+12125550123");
    expect(normalizePhone("050 123 4567", "AE")).toBe("+971501234567");
    expect(normalizePhone("12", "US")).toBeNull();
    expect(normalizePhone("+1234567890123456", "US")).toBeNull();
  });
  it("WhatsApp digits and comparison keys", () => {
    expect(intlDigits("0300-1234567")).toBe("923001234567");
    expect(intlDigits("0423-5551234", "PK")).toBe("924235551234");
    expect(intlDigits("07700 900123", "GB")).toBe("447700900123");
    expect(intlDigits("+12125550123", "PK")).toBe("12125550123");
    expect(phoneKey("+92 300 1234567")).toBe("03001234567");
    expect(phoneKey("+447700900123")).toBe("447700900123");
  });
});

describe("payment methods by country", () => {
  it("Pakistan: cash on delivery, JazzCash, EasyPaisa and bank (as before)", () => {
    expect(ids(base)).toEqual(["cod", "jazzcash", "easypaisa", "bank"]);
  });
  it("elsewhere: no Pakistani wallets", () => {
    expect(ids(settings({ country: "IN" }))).toEqual(["cod", "bank"]);
  });
  it("a store's own methods: paid before shipping (with a receipt) or on delivery", () => {
    const s = settings({
      country: "IN",
      manualMethods: [
        { id: "upi", name: "UPI", enabled: true, details: [{ label: "UPI ID", value: "shop@okbank" }], due: "upfront" },
        { id: "card-on-delivery", name: "Card on delivery", enabled: true, details: [], due: "on-delivery" },
        { id: "nowhere", name: "Nowhere", enabled: true, details: [], due: "upfront" },
        { id: "off", name: "Off", enabled: false, details: [{ label: "x", value: "y" }], due: "upfront" },
      ],
    });
    expect(ids(s)).toEqual(["cod", "bank", "upi", "card-on-delivery"]);
    expect(findCheckoutMethod("upi", s)).toMatchObject({ kind: "manual", due: "upfront", proof: true, account: [{ label: "UPI ID", value: "shop@okbank" }] });
    expect(findCheckoutMethod("card-on-delivery", s)).toMatchObject({ due: "on-delivery", proof: false });
  });
  it("cards only where the store's provider works", () => {
    const card = { cardReady: true, cardGateway: "stripe", payments: { cod: { enabled: true, fee: 0, maxOrder: null }, jazzcash: { enabled: true }, easypaisa: { enabled: true }, bank: { enabled: true }, card: { enabled: true } } };
    expect(ids(settings({ ...card, country: "US", currency: "USD" }))).toContain("card");
    expect(ids(settings({ ...card, country: "PK", currency: "PKR" }))).not.toContain("card");
    expect(ids(settings({ ...card, cardReady: false, country: "US" }))).not.toContain("card");
    expect(gatewaySupports(gatewayInfo("stripe")!, "GB", "GBP")).toBe(true);
    expect(gatewaysFor("PK").map((g) => g.id)).toEqual([]);
  });
  it("ids and names", () => {
    expect(manualMethodId("M-Pesa")).toBe("m-pesa");
    expect(manualMethodId("Bank")).toBe("bank-own");
    expect(paymentLabel("cod")).toBe("Cash on Delivery");
    expect(paymentLabel("upi", "UPI")).toBe("UPI");
  });
  it("only methods paid before shipping hold the order until paid", () => {
    expect(paymentBlocksShipping({ paymentMethod: "card-on-delivery", paymentDue: "on-delivery", paymentStatus: "unpaid" })).toBe(false);
    expect(paymentBlocksShipping({ paymentMethod: "upi", paymentDue: "upfront", paymentStatus: "awaiting-verification" })).toBe(true);
    expect(paymentBlocksShipping({ paymentMethod: "upi", paymentStatus: "awaiting-verification" })).toBe(true);
    expect(paidOnDelivery({ paymentMethod: "cod" })).toBe(true);
  });
});

describe("shipping and totals outside Pakistan", () => {
  const zones = settings({
    country: "GB",
    currency: "GBP",
    defaultDeliveryCharge: 9.99,
    zones: [
      { name: "London", cities: [], places: ["London", "SW1*", "EC1A 1BB"], charge: 3.5, rest: false },
      { name: "Rest of UK", cities: [], charge: 5.99, rest: true },
    ],
  });
  it("zones match typed cities and postcodes", () => {
    expect(shippingZoneFor("london", zones)?.name).toBe("London");
    expect(shippingZoneFor("Westminster", zones, "SW1A 2AA")?.name).toBe("London");
    expect(shippingZoneFor("City", zones, "ec1a1bb")?.name).toBe("London");
    expect(shippingZoneFor("Leeds", zones, "LS1 4AP")?.name).toBe("Rest of UK");
    expect(deliveryCharge("Leeds", 20, zones, "LS1 4AP")).toBe(5.99);
    expect(deliveryEstimate("Leeds", zones).label).toBe("2–5 working days");
  });
  it("totals keep cents", () => {
    const t = orderTotals({ subtotal: 19.99 * 3, discount: 0, city: "Leeds", method: "bank", settings: { ...zones, tax: { enabled: true, rate: 20, inclusive: false, label: "VAT", taxDelivery: false } } });
    expect(t).toMatchObject({ subtotal: 59.97, delivery: 5.99, tax: 11.99, total: 77.95 });
  });
});

describe("delivering abroad", () => {
  const s = settings({
    country: "GB",
    currency: "GBP",
    defaultDeliveryCharge: 9.99,
    freeDeliveryThreshold: 50,
    shipTo: ["IE", "FR"],
    zones: [
      { name: "London", cities: [], places: ["London"], charge: 3.5, rest: false },
      { name: "Rest of UK", cities: [], charge: 5.99, rest: true },
      { name: "Dublin", cities: [], places: ["Dublin"], countries: ["IE"], charge: 8, rest: false },
      { name: "Europe", cities: [], countries: ["IE", "FR"], charge: 15, freeAbove: 0, estimate: "4–6 working days", rest: true },
    ],
  });
  it("the store's own country first, then the others; nowhere else", () => {
    expect(shipToCountries(s)).toEqual(["GB", "IE", "FR"]);
    expect(shipsTo(s, "FR")).toBe(true);
    expect(shipsTo(s, "US")).toBe(false);
    expect(shipToCountries(settings({ country: "PK" }))).toEqual(["PK"]);
  });
  it("zones without countries are for the store's country; zones abroad only for theirs", () => {
    expect(shippingZoneFor("London", s)?.name).toBe("London");
    expect(shippingZoneFor("Leeds", s)?.name).toBe("Rest of UK");
    expect(shippingZoneFor("Dublin", s, "", "IE")?.name).toBe("Dublin");
    expect(shippingZoneFor("Cork", s, "", "IE")?.name).toBe("Europe");
    expect(shippingZoneFor("Paris", s, "", "FR")?.name).toBe("Europe");
    // a city with the same name abroad doesn't use the home zone
    expect(shippingZoneFor("London", s, "", "FR")?.name).toBe("Europe");
  });
  it("charges, free delivery and estimates follow the address's country", () => {
    expect(deliveryCharge("Leeds", 60, s)).toBe(0);
    expect(deliveryCharge("Paris", 60, s, "", "FR")).toBe(15);
    expect(freeDeliveryAbove("Paris", s, "", "FR")).toBe(0);
    expect(deliveryEstimate("Paris", s, "", "FR").label).toBe("4–6 working days");
    expect(deliveryEstimate("Lyon", settings({ country: "GB", shipTo: ["FR"] }), "", "FR").label).toBe("5–10 working days");
    expect(orderTotals({ subtotal: 40, discount: 0, city: "Paris", country: "FR", method: "bank", settings: s }).total).toBe(55);
  });
  it("an address abroad names its country", () => {
    expect(cityLine({ city: "Paris", postalCode: "75001", country: "FR" }, "GB")).toBe("Paris, 75001, France");
    expect(cityLine({ city: "Leeds", country: "GB" }, "GB")).toBe("Leeds");
    expect(cityLine({ city: "Lahore" })).toBe("Lahore");
  });
});
