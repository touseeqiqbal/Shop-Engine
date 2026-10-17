import { describe, expect, it } from "vitest";
import { orderTotals } from "@/lib/order-totals";
import { taxLines } from "@/lib/order-money";
import type { StoreSettings, TaxSettings } from "@/lib/types";

const store = (tax: Partial<TaxSettings>): StoreSettings =>
  ({
    freeDeliveryThreshold: 0,
    defaultDeliveryCharge: 100,
    cityCharges: {},
    advanceThreshold: 0,
    advanceAmount: 0,
    bank: { bankName: "", accountTitle: "", accountNumber: "", iban: "" },
    jazzcash: { title: "", number: "" },
    easypaisa: { title: "", number: "" },
    country: "GB",
    currency: "GBP",
    tax: { enabled: true, rate: 20, inclusive: false, label: "VAT", taxDelivery: false, ...tax },
  }) as StoreSettings;
const base = { subtotal: 300, discount: 0, city: "London", method: "card" };

describe("tax per product", () => {
  it("without lines (or all normal-rate lines) the tax is exactly as before", () => {
    const s = store({});
    const old = orderTotals({ ...base, settings: s });
    expect(old).toMatchObject({ tax: 60, taxAdded: 60, total: 460 });
    expect(orderTotals({ ...base, settings: s, lines: [{ amount: 100 }, { amount: 200, taxClass: "standard" }] })).toMatchObject({ tax: 60, total: 460 });
    expect(old.taxBreakdown).toEqual([{ rate: 20, base: 300, tax: 60 }]);
  });
  it("each line at its product's rate: normal, reduced, exempt (added on top)", () => {
    const t = orderTotals({ ...base, settings: store({ reducedRate: 5 }), lines: [{ amount: 100 }, { amount: 100, taxClass: "reduced" }, { amount: 100, taxClass: "exempt" }] });
    expect(t.taxBreakdown).toEqual([
      { rate: 20, base: 100, tax: 20 },
      { rate: 5, base: 100, tax: 5 },
    ]);
    expect(t).toMatchObject({ tax: 25, taxAdded: 25, total: 300 + 100 + 25 });
  });
  it("prices that include tax: the tax inside each rate's share", () => {
    const t = orderTotals({ ...base, settings: store({ inclusive: true, reducedRate: 5 }), lines: [{ amount: 120 }, { amount: 105, taxClass: "reduced" }, { amount: 75, taxClass: "exempt" }] });
    expect(t.taxBreakdown.map((b) => b.tax)).toEqual([20, 5]);
    expect(t).toMatchObject({ tax: 25, taxAdded: 0, total: 400 });
  });
  it("a discount is shared out by value before tax", () => {
    const t = orderTotals({ ...base, discount: 100, settings: store({ reducedRate: 0 }), lines: [{ amount: 150 }, { amount: 150, taxClass: "reduced" }] });
    // 200 left after the discount: 100 at 20 %, 100 at 0 %
    expect(t.taxBreakdown).toEqual([{ rate: 20, base: 100, tax: 20 }]);
    expect(t.total).toBe(200 + 100 + 20);
  });
  it("taxed delivery goes with the normal rate", () => {
    const t = orderTotals({ ...base, settings: store({ taxDelivery: true, reducedRate: 5 }), lines: [{ amount: 300, taxClass: "reduced" }] });
    expect(t.taxBreakdown).toEqual([
      { rate: 20, base: 100, tax: 20 },
      { rate: 5, base: 300, tax: 15 },
    ]);
  });
  it("a reduced rate left empty means the normal rate", () => {
    expect(orderTotals({ ...base, settings: store({}), lines: [{ amount: 300, taxClass: "reduced" }] }).tax).toBe(60);
  });
});

describe("tax lines on invoices", () => {
  it("one line per rate; added before the total, included after", () => {
    expect(taxLines({ subtotal: 300, discount: 0, deliveryCharge: 100, total: 425, taxTotal: 25, taxBreakdown: [{ rate: 20, tax: 20 }, { rate: 5, tax: 5 }] })).toEqual({
      added: true,
      lines: [{ label: "Tax 20%", amount: 20 }, { label: "Tax 5%", amount: 5 }],
    });
    expect(taxLines({ subtotal: 300, discount: 0, deliveryCharge: 100, total: 400, taxTotal: 25, taxBreakdown: [{ rate: 20, tax: 25 }] })).toEqual({ added: false, lines: [{ label: "incl. tax 20%", amount: 25 }] });
  });
  it("older orders without the per-rate lines, and orders without tax", () => {
    expect(taxLines({ subtotal: 100, deliveryCharge: 0, total: 100, taxTotal: 15 })).toEqual({ added: false, lines: [{ label: "Tax included", amount: 15 }] });
    expect(taxLines({ subtotal: 100, total: 100, taxTotal: 0 }).lines).toEqual([]);
  });
});
