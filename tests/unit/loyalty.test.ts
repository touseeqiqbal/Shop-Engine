import { describe, expect, it } from "vitest";
import { LOYALTY_DEFAULTS, pointsFor, voucherValue } from "@/payload/loyalty";

const on = { ...LOYALTY_DEFAULTS, enabled: true, pointsPer100: 1 };

describe("loyalty points", () => {
  it("points on the items after discount – not delivery, not what a voucher paid – whole points only", () => {
    expect(pointsFor({ subtotal: 1499, discount: 0 }, on)).toBe(14);
    expect(pointsFor({ subtotal: 1500, discount: 200 }, on)).toBe(13);
    expect(pointsFor({ subtotal: 1500, discount: 0, giftCardAmount: 500 }, on)).toBe(10);
    expect(pointsFor({ subtotal: 1500, discount: 0 }, { ...on, pointsPer100: 5 })).toBe(75);
  });
  it("nothing when switched off, or for nothing paid", () => {
    expect(pointsFor({ subtotal: 5000 }, LOYALTY_DEFAULTS)).toBe(0);
    expect(pointsFor({ subtotal: 100, giftCardAmount: 100 }, on)).toBe(0);
    expect(pointsFor({ subtotal: 5000 }, { ...on, pointsPer100: 0 })).toBe(0);
  });
  it("a voucher's value: whole amounts stay whole, cents to the cent", () => {
    expect(voucherValue(150, { ...on, pointValue: 1 })).toBe(150);
    expect(voucherValue(333, { ...on, pointValue: 0.1 })).toBe(33.3);
    expect(voucherValue(7, { ...on, pointValue: 0.05 })).toBe(0.35);
  });
});
