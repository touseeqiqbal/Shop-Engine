import { describe, expect, it } from "vitest";
import { deliveryCharge, hasShippingChoices, shippingOptions, weighedCharge } from "@/lib/cities";
import { orderTotals } from "@/lib/order-totals";
import type { ShippingZone, StoreSettings } from "@/lib/types";

const base: StoreSettings = {
  freeDeliveryThreshold: 15000,
  defaultDeliveryCharge: 350,
  cityCharges: { Lahore: 300 },
  advanceThreshold: 100000,
  advanceAmount: 5000,
  bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" },
  jazzcash: { title: "", number: "" },
  easypaisa: { title: "", number: "" },
  country: "PK",
  currency: "PKR",
};
const karachi: ShippingZone = { name: "Karachi", cities: ["Karachi"], charge: 200, freeAbove: 10000, estimate: "Same day" };
const rest: ShippingZone = { name: "Rest", cities: [], rest: true, charge: 300 };
const withZones = (zones: ShippingZone[]) => ({ ...base, zones }) as StoreSettings;

describe("weight pricing", () => {
  it("adds the per-kg price for each started kg above what's included", () => {
    expect(weighedCharge(200, 50, 2, 1.5)).toBe(200);
    expect(weighedCharge(200, 50, 2, 2)).toBe(200);
    expect(weighedCharge(200, 50, 2, 2.1)).toBe(250);
    expect(weighedCharge(200, 50, 2, 5)).toBe(350);
    expect(weighedCharge(200, null, 2, 50)).toBe(200);
    expect(weighedCharge(200, 50, null, 3)).toBe(350);
  });
  it("a zone that prices by weight charges heavy carts more – and is still free above its threshold", () => {
    const s = withZones([{ ...karachi, includedKg: 3, perKg: 100 }, rest]);
    expect(deliveryCharge("Karachi", 5000, s, "", null, { weightKg: 1 })).toBe(200);
    expect(deliveryCharge("Karachi", 5000, s, "", null, { weightKg: 5.5 })).toBe(200 + 3 * 100);
    expect(deliveryCharge("Karachi", 12000, s, "", null, { weightKg: 50 })).toBe(0);
  });
});

describe("delivery methods", () => {
  const s = withZones([{ ...karachi, methods: [{ name: "Express", charge: 500, estimate: "Within 3 hours", freeAbove: 20000 }, { name: "Standard", charge: 1 }] }, rest]);
  it("Standard (the zone's own charge) first, then the zone's other methods", () => {
    expect(shippingOptions("Karachi", 5000, s)).toEqual([
      { id: "standard", name: "Standard", charge: 200, estimate: "Same day" },
      { id: "express", name: "Express", charge: 500, estimate: "Within 3 hours" },
    ]);
  });
  it("a method's own free-above (empty = never free)", () => {
    expect(shippingOptions("Karachi", 12000, s).map((o) => o.charge)).toEqual([0, 500]);
    expect(shippingOptions("Karachi", 25000, s).map((o) => o.charge)).toEqual([0, 0]);
  });
  it("addresses in a zone without methods get Standard only", () => {
    expect(shippingOptions("Lahore", 5000, s).map((o) => o.id)).toEqual(["standard"]);
  });
  it("checkout asks the server only when there is a choice", () => {
    expect(hasShippingChoices(s)).toBe(true);
    expect(hasShippingChoices(withZones([karachi, rest]))).toBe(false);
    expect(hasShippingChoices(withZones([{ ...rest, perKg: 10 }]))).toBe(true);
    expect(hasShippingChoices(base)).toBe(false);
  });
  it("the order total uses the chosen method; an unknown choice falls back to Standard", () => {
    const pick = (shipping: string) => orderTotals({ subtotal: 5000, discount: 0, city: "Karachi", method: "bank", settings: s, shipping });
    expect(pick("express")).toMatchObject({ delivery: 500, total: 5500, shipping: { name: "Express" } });
    expect(pick("standard")).toMatchObject({ delivery: 200, total: 5200 });
    expect(pick("teleport")).toMatchObject({ delivery: 200, shipping: { id: "standard" } });
  });
  it("a free-delivery discount makes any method free", () => {
    expect(orderTotals({ subtotal: 5000, discount: 0, city: "Karachi", method: "bank", settings: s, shipping: "express", freeShipping: true }).delivery).toBe(0);
  });
});

describe("stores without delivery methods keep their old totals", () => {
  it("per-city charges and zones charge exactly as before", () => {
    for (const [settings, city, subtotal] of [
      [base, "Lahore", 5000],
      [base, "Quetta", 5000],
      [base, "Lahore", 16000],
      [withZones([karachi, rest]), "Karachi", 5000],
      [withZones([karachi, rest]), "Multan", 5000],
      [withZones([karachi, rest]), "Karachi", 11000],
    ] as const) {
      const t = orderTotals({ subtotal, discount: 0, city, method: "cod", settings });
      expect(t.delivery).toBe(deliveryCharge(city, subtotal, settings));
      expect(t.shipping?.id).toBe("standard");
    }
  });
});
