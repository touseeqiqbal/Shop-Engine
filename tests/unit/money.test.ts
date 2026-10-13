import { describe, expect, it } from "vitest";
import { amountToCollect, creditedAdvance, paymentBlocksShipping } from "@/lib/order-money";
import { codFee, deliveryCharge, freeDeliveryAbove, paymentEnabled } from "@/lib/cities";
import { couponDiscount } from "@/lib/coupons";
import type { Coupon, StoreSettings } from "@/lib/types";

const base: StoreSettings = {
  freeDeliveryThreshold: 15000,
  defaultDeliveryCharge: 350,
  cityCharges: { Lahore: 300 },
  advanceThreshold: 100000,
  advanceAmount: 5000,
  bank: { bankName: "Meezan", accountTitle: "Urko", accountNumber: "0102-0105678901", iban: "PK36MEZN0001020105678901" },
  jazzcash: { title: "Urko", number: "0342-6693115" },
  easypaisa: { title: "Urko", number: "0343-5867409" },
};
const settings = (over: Record<string, unknown>) => ({ ...base, ...over }) as StoreSettings;

describe("what the rider collects", () => {
  it("COD with nothing paid: the whole total", () => {
    expect(amountToCollect({ paymentMethod: "cod", paymentStatus: "unpaid", total: 150000 })).toBe(150000);
  });
  it("an advance only counts once approved", () => {
    expect(amountToCollect({ paymentMethod: "cod", paymentStatus: "awaiting-verification", total: 150000, advancePaid: 5000 })).toBe(150000);
    expect(amountToCollect({ paymentMethod: "cod", paymentStatus: "unpaid", total: 150000, advancePaid: 5000 })).toBe(150000);
    expect(amountToCollect({ paymentMethod: "cod", paymentStatus: "partial", total: 150000, advancePaid: 5000 })).toBe(145000);
    expect(creditedAdvance({ paymentStatus: "awaiting-verification", advancePaid: 5000 })).toBe(0);
  });
  it("paid or refunded: nothing; never negative", () => {
    expect(amountToCollect({ paymentMethod: "jazzcash", paymentStatus: "paid", total: 9000 })).toBe(0);
    expect(amountToCollect({ paymentMethod: "cod", paymentStatus: "refunded", total: 9000 })).toBe(0);
    expect(amountToCollect({ paymentMethod: "cod", paymentStatus: "partial", total: 1000, advancePaid: 5000 })).toBe(0);
  });
  it("online payments must be Paid before confirming or shipping", () => {
    for (const m of ["jazzcash", "easypaisa", "bank", "card"]) {
      expect(paymentBlocksShipping({ paymentMethod: m, paymentStatus: "awaiting-verification" })).toBe(true);
      expect(paymentBlocksShipping({ paymentMethod: m, paymentStatus: "paid" })).toBe(false);
    }
    expect(paymentBlocksShipping({ paymentMethod: "cod", paymentStatus: "unpaid" })).toBe(false);
  });
});

describe("delivery fee", () => {
  const zoned = settings({
    zones: [
      { name: "Karachi", cities: ["Karachi"], charge: 200, freeAbove: 10000, rest: false },
      { name: "Rest", cities: [], charge: 400, freeAbove: 0, rest: true },
    ],
  });
  it("uses the city's zone, else the rest-of-Pakistan zone", () => {
    expect(deliveryCharge("karachi", 5000, zoned)).toBe(200);
    expect(deliveryCharge("Quetta", 5000, zoned)).toBe(400);
  });
  it("free above the zone amount; 0 means never free", () => {
    expect(deliveryCharge("Karachi", 10000, zoned)).toBe(0);
    expect(deliveryCharge("Quetta", 999999, zoned)).toBe(400);
    expect(freeDeliveryAbove("Quetta", zoned)).toBe(0);
    expect(freeDeliveryAbove("Karachi", zoned)).toBe(10000);
  });
  it("without zones: city overrides, and a store-wide 0 means never free", () => {
    expect(deliveryCharge("Lahore", 5000, base)).toBe(300);
    expect(deliveryCharge("Multan", 5000, base)).toBe(350);
    expect(deliveryCharge("Lahore", 15000, base)).toBe(0);
    expect(deliveryCharge("Lahore", 500000, settings({ freeDeliveryThreshold: 0 }))).toBe(300);
  });
  it("COD fee", () => {
    expect(codFee(base)).toBe(0);
    expect(codFee(settings({ payments: { cod: { enabled: true, fee: 100 } } }))).toBe(100);
  });
});

describe("payment methods", () => {
  it("never offers a method without real account details", () => {
    expect(paymentEnabled("bank", base)).toBe(true);
    expect(paymentEnabled("bank", settings({ bank: { bankName: "Meezan", accountTitle: "Urko", accountNumber: "0000-0000000000", iban: "PK00MEZN0000000000000000" } }))).toBe(false);
    expect(paymentEnabled("jazzcash", settings({ jazzcash: { title: "Urko", number: " " } }))).toBe(false);
    expect(paymentEnabled("easypaisa", base)).toBe(true);
    expect(paymentEnabled("card", base)).toBe(false);
  });
});

describe("coupons", () => {
  const coupon = (kind: "percent" | "fixed", value: number) => ({ code: "X", kind, value }) as unknown as Coupon;
  it("percent and fixed, rounded, never more than the cart or below 0", () => {
    expect(couponDiscount(coupon("percent", 10), 12345)).toBe(1235);
    expect(couponDiscount(coupon("fixed", 500), 12345)).toBe(500);
    expect(couponDiscount(coupon("fixed", 50000), 12345)).toBe(12345);
    expect(couponDiscount(coupon("percent", 150), 1000)).toBe(1000);
    expect(couponDiscount(coupon("fixed", -500), 1000)).toBe(0);
  });
});
