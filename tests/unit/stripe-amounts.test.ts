import { describe, expect, it } from "vitest";
import { fromMinor, toMinor } from "@/lib/payments/stripe";

describe("Stripe amounts in each currency's smallest unit", () => {
  it("cents for most currencies, whole units for zero-decimal ones", () => {
    expect(toMinor(12.34, "usd")).toBe(1234);
    expect(toMinor(1500, "PKR")).toBe(150000);
    expect(toMinor(1500, "jpy")).toBe(1500);
    expect(fromMinor(1234, "usd")).toBe(12.34);
    expect(fromMinor(1500, "jpy")).toBe(1500);
  });
  it("thousandths for 3-decimal currencies – with the last digit 0, as Stripe requires", () => {
    expect(toMinor(10, "kwd")).toBe(10000); // was 1000: a tenth of the amount charged
    expect(toMinor(12.345, "KWD") % 10).toBe(0);
    expect(toMinor(12.34, "bhd")).toBe(12340);
    expect(fromMinor(10000, "kwd")).toBe(10);
    expect(fromMinor(toMinor(7.25, "omr"), "omr")).toBe(7.25);
  });
});
